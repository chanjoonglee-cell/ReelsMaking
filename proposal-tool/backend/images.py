"""Image extraction from uploaded PDFs + persistence for user-uploaded images.

Captions are added separately via `llm_client.caption_images_batch`.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def extract_from_pdf(pdf_path: Path, out_dir: Path, counter_start: int = 0) -> list[dict[str, Any]]:
    """Pull embedded images out of a PDF into `out_dir`.

    Returns a list of {id, filename, source, page, caption} dicts. Tiny
    decorative images (< 40 KB) are skipped as they are usually icons /
    separators that would only confuse the draft.
    """
    import fitz  # PyMuPDF

    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    doc = fitz.open(str(pdf_path))
    seen: set[int] = set()
    counter = counter_start

    try:
        for page_no, page in enumerate(doc, start=1):
            for info in page.get_images(full=True):
                xref = info[0]
                if xref in seen:
                    continue
                seen.add(xref)
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n - pix.alpha >= 4:  # CMYK or similar → convert to RGB
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    png_bytes = pix.tobytes("png")
                finally:
                    pix = None  # noqa
                if len(png_bytes) < 40_000:
                    continue
                counter += 1
                filename = f"img_pdf_{counter:03d}.png"
                out_path = out_dir / filename
                out_path.write_bytes(png_bytes)
                results.append({
                    "id": filename.rsplit(".", 1)[0],
                    "filename": filename,
                    "source": pdf_path.name,
                    "page": page_no,
                    "caption": "",
                })
    finally:
        doc.close()

    return results


def save_uploaded_image(file_bytes: bytes, original_name: str, out_dir: Path, index: int) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(original_name).suffix.lstrip(".").lower() or "png"
    if ext == "jpg":
        ext = "jpg"
    filename = f"img_user_{index:03d}.{ext}"
    target = out_dir / filename
    target.write_bytes(file_bytes)
    return {
        "id": filename.rsplit(".", 1)[0],
        "filename": filename,
        "source": original_name,
        "page": None,
        "caption": "",
    }
