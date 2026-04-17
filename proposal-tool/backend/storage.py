"""Local-filesystem session persistence.

Each session lives in SESSIONS_DIR/<session_id>/:
  meta.json         — title, created_at, template outline, source file names, progress state
  sources/          — original uploaded source files
  templates/        — original uploaded template files
  draft.md          — the combined markdown draft (source of truth the user edits)
  sections.json     — per-section drafts (for re-generation / counting)
"""
from __future__ import annotations

import json
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from . import config


def new_session_id() -> str:
    return time.strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]


def session_dir(session_id: str) -> Path:
    path = config.SESSIONS_DIR / session_id
    path.mkdir(parents=True, exist_ok=True)
    (path / "sources").mkdir(exist_ok=True)
    (path / "templates").mkdir(exist_ok=True)
    (path / "images").mkdir(exist_ok=True)
    return path


def save_images_meta(session_id: str, images: list[dict[str, Any]]) -> None:
    path = session_dir(session_id) / "images.json"
    path.write_text(json.dumps(images, ensure_ascii=False, indent=2), encoding="utf-8")


def load_images_meta(session_id: str) -> list[dict[str, Any]]:
    path = session_dir(session_id) / "images.json"
    if not path.exists():
        return []
    return json.loads(path.read_text("utf-8"))


def list_sessions() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for d in sorted(config.SESSIONS_DIR.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        meta_path = d / "meta.json"
        if not meta_path.exists():
            continue
        try:
            meta = json.loads(meta_path.read_text("utf-8"))
        except json.JSONDecodeError:
            continue
        out.append({"id": d.name, **meta})
    return out


def save_meta(session_id: str, meta: dict[str, Any]) -> None:
    path = session_dir(session_id) / "meta.json"
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def load_meta(session_id: str) -> dict[str, Any]:
    path = session_dir(session_id) / "meta.json"
    if not path.exists():
        raise FileNotFoundError(f"Session not found: {session_id}")
    return json.loads(path.read_text("utf-8"))


def save_sections(session_id: str, sections: list[dict[str, Any]]) -> None:
    path = session_dir(session_id) / "sections.json"
    path.write_text(json.dumps(sections, ensure_ascii=False, indent=2), encoding="utf-8")


def load_sections(session_id: str) -> list[dict[str, Any]]:
    path = session_dir(session_id) / "sections.json"
    if not path.exists():
        return []
    return json.loads(path.read_text("utf-8"))


def save_draft(session_id: str, markdown: str) -> None:
    (session_dir(session_id) / "draft.md").write_text(markdown, encoding="utf-8")


def load_draft(session_id: str) -> str:
    path = session_dir(session_id) / "draft.md"
    return path.read_text("utf-8") if path.exists() else ""


def render_draft_from_sections(title: str, sections: list[dict[str, Any]]) -> str:
    parts = [f"# {title}\n"] if title else []
    for s in sections:
        parts.append(f"## {s['title']}\n")
        body = s.get("content", "").strip()
        if body:
            parts.append(body + "\n")
        else:
            parts.append("_(아직 생성되지 않았습니다.)_\n")
    return "\n".join(parts)


def delete_session(session_id: str) -> None:
    path = config.SESSIONS_DIR / session_id
    if path.exists():
        shutil.rmtree(path)
