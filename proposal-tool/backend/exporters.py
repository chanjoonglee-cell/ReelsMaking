"""Markdown → PDF / DOCX / HWP.

PDF path: markdown → HTML → WeasyPrint (pure Python).
DOCX path: pandoc if available, else python-docx fallback.
HWP  path: DOCX → `libreoffice --convert-to hwp` (requires LibreOffice).
"""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import markdown as md_lib


_IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]*\})?")
_UNSAFE_ALT = re.compile(r"[\[\]()\"'`:]|\s+")

# A4 본문 폭 ≈ 16cm (21cm - 양쪽 2.5cm 여백). 14cm 로 조금 더 안전하게 cap.
IMAGE_MAX_WIDTH = "14cm"


def _prepare_images_for_export(markdown_text: str) -> str:
    """Sanitize image alt text and cap the rendered width.

    Without this each slide-as-image happily consumes a full A4 page, which
    is what made a "12장 내외" brief balloon to 146 pages.
    """
    def repl(m: "re.Match[str]") -> str:
        alt = _UNSAFE_ALT.sub(" ", m.group(1)).strip()
        if len(alt) > 40:
            alt = alt[:40]
        url = m.group(2)
        existing = m.group(3) or ""
        if "width" in existing:
            return f"![{alt}]({url}){existing}"
        # Inject width inside existing attrs, or add a fresh attr block.
        if existing:
            new_attrs = existing[:-1] + f' width="{IMAGE_MAX_WIDTH}"' + "}"
        else:
            new_attrs = f'{{width="{IMAGE_MAX_WIDTH}"}}'
        return f"![{alt}]({url}){new_attrs}"
    return _IMG_RE.sub(repl, markdown_text)


# Kept as a thin alias so old callers still work.
_sanitize_image_alt = _prepare_images_for_export


class ExportError(Exception):
    pass


HTML_TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>{title}</title>
<style>
  @page {{ size: A4; margin: 20mm; }}
  body {{ font-family: "Noto Sans CJK KR", "Malgun Gothic", sans-serif; line-height: 1.55; font-size: 11pt; color: #111; }}
  h1 {{ font-size: 20pt; border-bottom: 2px solid #333; padding-bottom: 6pt; }}
  h2 {{ font-size: 14pt; margin-top: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }}
  h3 {{ font-size: 12pt; margin-top: 12pt; }}
  table {{ border-collapse: collapse; width: 100%; margin: 8pt 0; }}
  th, td {{ border: 1px solid #999; padding: 4pt 6pt; }}
  code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }}
  pre {{ background: #f4f4f4; padding: 8pt; border-radius: 4px; }}
  blockquote {{ border-left: 3px solid #ccc; margin: 8pt 0; padding-left: 10pt; color: #555; }}
  img {{ max-width: 14cm; height: auto; display: block; margin: 8pt auto; page-break-inside: avoid; }}
</style></head><body>
{body}
</body></html>"""


def _markdown_to_html(markdown_text: str, title: str) -> str:
    body = md_lib.markdown(
        markdown_text,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
    )
    return HTML_TEMPLATE.format(title=title, body=body)


def export_pdf(markdown_text: str, title: str, out_path: Path, resource_dir: Path | None = None) -> Path:
    from weasyprint import HTML

    markdown_text = _prepare_images_for_export(markdown_text)
    # python-markdown ignores pandoc-style `{width=...}` attrs. Strip them
    # and rely on the stylesheet's `img { max-width: ... }` rule instead.
    markdown_text = re.sub(r"(\!\[[^\]]*\]\([^)\s]+\))\{[^}]*\}", r"\1", markdown_text)
    html = _markdown_to_html(markdown_text, title)
    # base_url lets WeasyPrint resolve relative image paths like `images/xxx.png`
    # against the session directory.
    base_url = str(resource_dir) + "/" if resource_dir else None
    HTML(string=html, base_url=base_url).write_pdf(str(out_path))
    return out_path


def export_docx(markdown_text: str, title: str, out_path: Path, reference_docx: Path | None = None, resource_dir: Path | None = None) -> Path:
    if shutil.which("pandoc"):
        return _export_docx_pandoc(markdown_text, out_path, reference_docx, resource_dir)
    return _export_docx_python(markdown_text, title, out_path)


def _export_docx_pandoc(markdown_text: str, out_path: Path, reference_docx: Path | None = None, resource_dir: Path | None = None) -> Path:
    markdown_text = _prepare_images_for_export(markdown_text)
    # Write the .md inside the resource_dir (if given) so pandoc resolves
    # relative image paths like `images/img_pdf_003.png` against it.
    if resource_dir:
        src = resource_dir / ".export.md"
        src.write_text(markdown_text, encoding="utf-8")
    else:
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(markdown_text)
            src = Path(f.name)
    try:
        cmd = ["pandoc", str(src), "-f", "markdown", "-t", "docx", "-o", str(out_path)]
        if reference_docx and reference_docx.exists():
            cmd.extend(["--reference-doc", str(reference_docx)])
        if resource_dir:
            cmd.extend(["--resource-path", str(resource_dir)])
        subprocess.run(cmd, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise ExportError(f"pandoc failed: {e.stderr.decode('utf-8', 'replace')}") from e
    finally:
        if not resource_dir:
            src.unlink(missing_ok=True)
        else:
            src.unlink(missing_ok=True)
    return out_path


def _export_docx_python(markdown_text: str, title: str, out_path: Path) -> Path:
    """Minimal fallback when pandoc isn't installed. Preserves headings and paragraphs; tables/code become plain text."""
    from docx import Document

    doc = Document()
    for raw_line in markdown_text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            doc.add_paragraph("")
            continue
        if line.startswith("# "):
            doc.add_heading(line[2:].strip(), level=1)
        elif line.startswith("## "):
            doc.add_heading(line[3:].strip(), level=2)
        elif line.startswith("### "):
            doc.add_heading(line[4:].strip(), level=3)
        elif line.startswith(("- ", "* ")):
            doc.add_paragraph(line[2:].strip(), style="List Bullet")
        elif line.lstrip().startswith(tuple(f"{i}." for i in range(10))):
            doc.add_paragraph(line.lstrip(), style="List Number")
        else:
            doc.add_paragraph(line)
    doc.save(str(out_path))
    return out_path


def export_hwp(markdown_text: str, title: str, out_path: Path, reference_docx: Path | None = None, resource_dir: Path | None = None) -> Path:
    """Two-step: markdown → DOCX → HWP via LibreOffice."""
    if not shutil.which("libreoffice") and not shutil.which("soffice"):
        raise ExportError(
            "HWP export requires LibreOffice (`libreoffice` or `soffice`) in PATH. "
            "Install it, or export as DOCX and convert in 아래아한글."
        )
    soffice = shutil.which("libreoffice") or shutil.which("soffice")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        docx_path = tmp_path / "intermediate.docx"
        export_docx(markdown_text, title, docx_path, reference_docx=reference_docx, resource_dir=resource_dir)
        try:
            subprocess.run(
                [soffice, "--headless", "--convert-to", "hwp", "--outdir", str(tmp_path), str(docx_path)],
                check=True,
                capture_output=True,
                timeout=120,
            )
        except subprocess.CalledProcessError as e:
            raise ExportError(
                f"libreoffice hwp conversion failed: {e.stderr.decode('utf-8', 'replace')}"
            ) from e
        produced = tmp_path / "intermediate.hwp"
        if not produced.exists():
            raise ExportError("libreoffice did not produce an .hwp file (the hwp filter may be unavailable).")
        shutil.move(str(produced), str(out_path))
    return out_path
