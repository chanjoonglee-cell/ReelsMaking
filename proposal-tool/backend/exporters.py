"""Markdown → PDF / DOCX / HWP.

PDF path: markdown → HTML → WeasyPrint (pure Python).
DOCX path: pandoc if available, else python-docx fallback.
HWP  path: DOCX → `libreoffice --convert-to hwp` (requires LibreOffice).
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import markdown as md_lib


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
</style></head><body>
{body}
</body></html>"""


def _markdown_to_html(markdown_text: str, title: str) -> str:
    body = md_lib.markdown(
        markdown_text,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
    )
    return HTML_TEMPLATE.format(title=title, body=body)


def export_pdf(markdown_text: str, title: str, out_path: Path) -> Path:
    from weasyprint import HTML

    html = _markdown_to_html(markdown_text, title)
    HTML(string=html).write_pdf(str(out_path))
    return out_path


def export_docx(markdown_text: str, title: str, out_path: Path) -> Path:
    if shutil.which("pandoc"):
        return _export_docx_pandoc(markdown_text, out_path)
    return _export_docx_python(markdown_text, title, out_path)


def _export_docx_pandoc(markdown_text: str, out_path: Path) -> Path:
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(markdown_text)
        src = Path(f.name)
    try:
        subprocess.run(
            ["pandoc", str(src), "-f", "markdown", "-t", "docx", "-o", str(out_path)],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as e:
        raise ExportError(f"pandoc failed: {e.stderr.decode('utf-8', 'replace')}") from e
    finally:
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


def export_hwp(markdown_text: str, title: str, out_path: Path) -> Path:
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
        export_docx(markdown_text, title, docx_path)
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
