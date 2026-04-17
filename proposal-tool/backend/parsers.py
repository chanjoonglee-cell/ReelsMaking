"""Extract plain text from uploaded files."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


class UnsupportedFileType(Exception):
    pass


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _pdf(path)
    if suffix == ".docx":
        return _docx(path)
    if suffix == ".pptx":
        return _pptx(path)
    if suffix in {".hwp", ".hwpx"}:
        return _hwp_via_libreoffice(path)
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="replace")
    raise UnsupportedFileType(f"Unsupported file type: {suffix}")


def _pdf(path: Path) -> str:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
    return "\n\n".join(parts)


def _docx(path: Path) -> str:
    from docx import Document

    doc = Document(str(path))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            parts.append(" | ".join(c for c in cells if c))
    return "\n".join(parts)


def _hwp_via_libreoffice(path: Path) -> str:
    """Convert HWP/HWPX → TXT via LibreOffice headless, then read the text.

    Requires `libreoffice` (or `soffice`) in PATH. Falls back gracefully if
    the direct txt filter fails — tries DOCX as an intermediate, which works
    for HWPX in recent LibreOffice versions.
    """
    soffice = shutil.which("libreoffice") or shutil.which("soffice")
    if not soffice:
        raise UnsupportedFileType(
            "HWP/HWPX 파싱은 LibreOffice가 필요합니다. `brew install libreoffice` 로 설치하세요."
        )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        # Try direct txt first.
        try:
            subprocess.run(
                [soffice, "--headless", "--convert-to", "txt", "--outdir", str(tmp_dir), str(path)],
                check=True,
                capture_output=True,
                timeout=120,
            )
        except subprocess.CalledProcessError:
            pass
        txt_path = tmp_dir / f"{path.stem}.txt"
        if txt_path.exists():
            return txt_path.read_text("utf-8", errors="replace")

        # Fallback: HWP → DOCX → text (DOCX filter is more robust for HWPX).
        subprocess.run(
            [soffice, "--headless", "--convert-to", "docx", "--outdir", str(tmp_dir), str(path)],
            check=True,
            capture_output=True,
            timeout=120,
        )
        docx_path = tmp_dir / f"{path.stem}.docx"
        if not docx_path.exists():
            raise UnsupportedFileType(
                f"LibreOffice가 {path.name} 변환에 실패했습니다. "
                "HWP 버전이 너무 오래됐거나 암호가 걸려있을 수 있습니다."
            )
        return _docx(docx_path)


def _pptx(path: Path) -> str:
    from pptx import Presentation

    prs = Presentation(str(path))
    parts: list[str] = []
    for i, slide in enumerate(prs.slides, 1):
        parts.append(f"--- Slide {i} ---")
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    text = "".join(run.text for run in para.runs).strip()
                    if text:
                        parts.append(text)
    return "\n".join(parts)
