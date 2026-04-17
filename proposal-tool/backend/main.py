"""FastAPI app: uploads, generation orchestration, editor API, export."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import llm_client, config, exporters, parsers, storage

ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title="Gov Proposal Automation")
app.mount("/static", StaticFiles(directory=str(ROOT / "frontend" / "static")), name="static")
templates = Jinja2Templates(directory=str(ROOT / "frontend" / "templates"))


# ───── in-memory progress bus (one session = one generation job at a time) ─────
_progress: dict[str, list[dict[str, Any]]] = {}
_progress_lock = asyncio.Lock()


async def _emit(session_id: str, event: dict[str, Any]) -> None:
    async with _progress_lock:
        _progress.setdefault(session_id, []).append(event)


# ───── pages ─────
@app.get("/", response_class=HTMLResponse)
async def page_home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "sessions": storage.list_sessions()})


@app.get("/editor/{session_id}", response_class=HTMLResponse)
async def page_editor(request: Request, session_id: str):
    try:
        meta = storage.load_meta(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")
    return templates.TemplateResponse(
        "editor.html",
        {"request": request, "session_id": session_id, "meta": meta},
    )


# ───── session lifecycle ─────
async def _save_uploads(files: list[UploadFile], dest: Path) -> list[dict[str, str]]:
    saved: list[dict[str, str]] = []
    for uf in files:
        if not uf.filename:
            continue
        safe_name = Path(uf.filename).name
        target = dest / safe_name
        data = await uf.read()
        target.write_bytes(data)
        saved.append({"name": safe_name, "path": str(target)})
    return saved


def _extract_source_chunks(source_files: list[dict[str, str]]) -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []
    for f in source_files:
        try:
            text = parsers.extract_text(Path(f["path"]))
        except parsers.UnsupportedFileType:
            continue
        except Exception as e:
            text = f"(파일 파싱 실패: {e})"
        if text.strip():
            chunks.append({"name": f["name"], "text": text})
    return chunks


def _extract_template_text(template_files: list[dict[str, str]]) -> str:
    parts: list[str] = []
    for f in template_files:
        try:
            text = parsers.extract_text(Path(f["path"]))
        except Exception as e:
            text = f"(파일 파싱 실패: {e})"
        parts.append(f"=== {f['name']} ===\n{text}")
    return "\n\n".join(parts)


async def _run_pipeline(session_id: str, saved_sources: list[dict[str, str]], saved_templates: list[dict[str, str]]) -> None:
    """Parse uploaded files (in a thread) then run generation."""
    try:
        await _emit(session_id, {"stage": "parse_files", "message": "파일 파싱 중..."})
        loop = asyncio.get_running_loop()
        source_chunks = await loop.run_in_executor(None, _extract_source_chunks, saved_sources)
        template_text = await loop.run_in_executor(None, _extract_template_text, saved_templates)
        await _run_generation(session_id, source_chunks, template_text)
    except Exception as e:
        await _emit(session_id, {"stage": "error", "message": str(e)})


async def _run_generation(session_id: str, source_chunks: list[dict[str, str]], template_text: str) -> None:
    try:
        await _emit(session_id, {"stage": "parse_template", "message": "양식 파싱 중..."})
        outline = await llm_client.parse_template(template_text)
        sections: list[dict[str, Any]] = outline.get("sections", [])
        title = outline.get("title") or "사업계획서 초안"

        meta = storage.load_meta(session_id)
        meta["title"] = title
        meta["outline"] = {"title": title, "sections": [{k: s.get(k) for k in ("id", "title", "guidance", "char_limit")} for s in sections]}
        meta["status"] = "generating"
        meta["progress"] = {"total": len(sections), "done": 0}
        storage.save_meta(session_id, meta)

        await _emit(session_id, {
            "stage": "outline_ready",
            "message": f"{len(sections)}개 섹션 확인됨",
            "sections": meta["outline"]["sections"],
        })

        # generate sections with a concurrency cap
        semaphore = asyncio.Semaphore(config.SECTION_CONCURRENCY)
        results: list[dict[str, Any]] = [dict(s) for s in sections]
        done_count = 0
        done_lock = asyncio.Lock()

        async def gen_one(idx: int, section: dict[str, Any]) -> None:
            nonlocal done_count
            async with semaphore:
                await _emit(session_id, {"stage": "section_start", "index": idx, "title": section["title"]})
                try:
                    content = await llm_client.generate_section(section, source_chunks)
                except Exception as e:
                    content = f"_(생성 실패: {e})_"
                results[idx]["content"] = content
                async with done_lock:
                    done_count += 1
                    meta["progress"] = {"total": len(sections), "done": done_count}
                    storage.save_meta(session_id, meta)
                await _emit(session_id, {
                    "stage": "section_done",
                    "index": idx,
                    "done": done_count,
                    "total": len(sections),
                })

        await asyncio.gather(*(gen_one(i, s) for i, s in enumerate(sections)))

        storage.save_sections(session_id, results)
        draft = storage.render_draft_from_sections(title, results)
        storage.save_draft(session_id, draft)

        meta["status"] = "ready"
        storage.save_meta(session_id, meta)
        await _emit(session_id, {"stage": "done", "session_id": session_id})
    except Exception as e:
        await _emit(session_id, {"stage": "error", "message": str(e)})
        try:
            meta = storage.load_meta(session_id)
            meta["status"] = "error"
            meta["error"] = str(e)
            storage.save_meta(session_id, meta)
        except Exception:
            pass


@app.post("/api/sessions")
async def create_session(
    sources: list[UploadFile] = File(...),
    templates_: list[UploadFile] = File(..., alias="templates"),
    name: str = Form(""),
):
    if not sources or not templates_:
        raise HTTPException(400, "원본과 양식 파일을 모두 업로드해야 합니다.")

    session_id = storage.new_session_id()
    sdir = storage.session_dir(session_id)
    saved_sources = await _save_uploads(sources, sdir / "sources")
    saved_templates = await _save_uploads(templates_, sdir / "templates")

    meta = {
        "name": name or session_id,
        "created_at": session_id.split("_", 2)[0] + " " + session_id.split("_", 2)[1],
        "title": name or "사업계획서 초안",
        "sources": saved_sources,
        "templates": saved_templates,
        "status": "pending",
        "progress": {"total": 0, "done": 0},
    }
    storage.save_meta(session_id, meta)

    # Parsing + generation run in the background so the client gets session_id
    # immediately and can subscribe to the SSE progress stream.
    asyncio.create_task(_run_pipeline(session_id, saved_sources, saved_templates))

    return {"session_id": session_id}


@app.get("/api/sessions")
async def api_list_sessions():
    return {"sessions": storage.list_sessions()}


@app.get("/api/sessions/{session_id}")
async def api_get_session(session_id: str):
    try:
        meta = storage.load_meta(session_id)
    except FileNotFoundError:
        raise HTTPException(404, "Session not found")
    return {"meta": meta, "draft": storage.load_draft(session_id), "sections": storage.load_sections(session_id)}


@app.delete("/api/sessions/{session_id}")
async def api_delete_session(session_id: str):
    storage.delete_session(session_id)
    return {"ok": True}


# ───── SSE progress stream ─────
@app.get("/api/sessions/{session_id}/stream")
async def sse_stream(session_id: str):
    async def gen():
        cursor = 0
        while True:
            async with _progress_lock:
                events = _progress.get(session_id, [])
                new = events[cursor:]
                cursor = len(events)
            for ev in new:
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                if ev.get("stage") in {"done", "error"}:
                    return
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream")


# ───── draft editing ─────
@app.put("/api/sessions/{session_id}/draft")
async def api_save_draft(session_id: str, payload: dict[str, Any]):
    markdown = payload.get("markdown", "")
    storage.save_draft(session_id, markdown)
    return {"ok": True}


@app.post("/api/sessions/{session_id}/sections/{index}/regenerate")
async def api_regenerate(session_id: str, index: int):
    meta = storage.load_meta(session_id)
    sections = storage.load_sections(session_id)
    if index < 0 or index >= len(sections):
        raise HTTPException(400, "섹션 인덱스가 잘못되었습니다.")

    source_chunks = _extract_source_chunks(meta.get("sources", []))
    content = await llm_client.generate_section(sections[index], source_chunks)
    sections[index]["content"] = content
    storage.save_sections(session_id, sections)

    # update the combined draft
    draft = storage.render_draft_from_sections(meta.get("title", ""), sections)
    storage.save_draft(session_id, draft)
    return {"content": content, "draft": draft}


# ───── export ─────
@app.get("/api/sessions/{session_id}/export/{fmt}")
async def api_export(session_id: str, fmt: str):
    meta = storage.load_meta(session_id)
    title = meta.get("title") or session_id
    markdown_text = storage.load_draft(session_id)
    if not markdown_text.strip():
        raise HTTPException(400, "초안이 비어 있습니다.")

    sdir = storage.session_dir(session_id)
    out_dir = sdir / "exports"
    out_dir.mkdir(exist_ok=True)

    safe_title = "".join(c if c.isalnum() or c in " -_가-힣" else "_" for c in title).strip() or session_id

    try:
        if fmt == "pdf":
            out = exporters.export_pdf(markdown_text, title, out_dir / f"{safe_title}.pdf")
            media = "application/pdf"
        elif fmt == "docx":
            out = exporters.export_docx(markdown_text, title, out_dir / f"{safe_title}.docx")
            media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif fmt == "hwp":
            out = exporters.export_hwp(markdown_text, title, out_dir / f"{safe_title}.hwp")
            media = "application/x-hwp"
        else:
            raise HTTPException(400, f"Unknown format: {fmt}")
    except exporters.ExportError as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    except ImportError as e:
        hint = (
            "PDF 내보내기는 WeasyPrint 와 네이티브 라이브러리(pango, cairo, gdk-pixbuf)가 필요합니다. "
            "macOS: `brew install pango cairo gdk-pixbuf libffi`"
        ) if fmt == "pdf" else ""
        return JSONResponse({"error": f"{type(e).__name__}: {e}\n\n{hint}".strip()}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": f"{type(e).__name__}: {e}"}, status_code=500)

    return FileResponse(str(out), media_type=media, filename=out.name)
