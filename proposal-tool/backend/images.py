"""Image extraction from uploaded PDFs + persistence for user-uploaded images.

Each page of every source PDF is rasterized to a single PNG — users want the
whole slide/page as one image (e.g. an IR-deck page), not the tiny sub-images
embedded inside it. Captions are added separately via
`llm_client.caption_images_batch`.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def extract_from_pdf(pdf_path: Path, out_dir: Path, counter_start: int = 0, zoom: float = 2.0) -> list[dict[str, Any]]:
    """Rasterize every page of `pdf_path` into a PNG in `out_dir`.

    Returns one dict per page: {id, filename, source, page, caption}.
    `zoom=2.0` gives ~144 DPI which is readable in the final DOCX/HWP while
    keeping file size manageable.
    """
    import fitz  # PyMuPDF

    out_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    doc = fitz.open(str(pdf_path))
    counter = counter_start
    matrix = fitz.Matrix(zoom, zoom)

    try:
        for page_no, page in enumerate(doc, start=1):
            try:
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                png_bytes = pix.tobytes("png")
            except Exception:
                continue
            finally:
                pix = None  # noqa: F841 — release the Pixmap promptly
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
