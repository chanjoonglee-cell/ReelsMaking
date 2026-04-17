"""Async wrapper over the Anthropic SDK for template parsing and section drafting."""
from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic

from . import config


_client: AsyncAnthropic | None = None


def client() -> AsyncAnthropic:
    global _client
    if _client is None:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.")
        _client = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


TEMPLATE_PARSE_SYSTEM = """You extract the outline of a Korean government-grant proposal template.

Given the announcement + template text, return a JSON object describing every section the applicant must fill in.

Rules:
- Preserve the original section titles and numbering exactly as they appear (Korean text is fine).
- Flatten sub-sections into separate entries — one entry per thing the applicant writes.
- For `char_limit`, extract any stated page/character/line limit (e.g. "2페이지 이내", "500자 이내"). Use null if none.
- For `guidance`, copy the short instruction sentence(s) that tell the applicant what to write. Keep it short (≤3 sentences).
- Do not invent sections that are not present.
- Return ONLY JSON. No prose, no code fences.

Schema:
{
  "title": "전체 사업계획서 제목",
  "sections": [
    {"id": "s1", "title": "1. 문제 인식 (Problem)", "guidance": "...", "char_limit": "2페이지 이내"}
  ]
}
"""


SECTION_DRAFT_SYSTEM = """You are drafting a single section of a Korean government-grant proposal.

Rules:
- Write in Korean.
- Ground every concrete claim (numbers, dates, names, metrics) in the provided 원본 자료. If the 원본 does not contain a fact, do not invent one — write a bracketed placeholder like [확인 필요: 2024년 매출] instead.
- Match the section's guidance and 글자/페이지 제약 as closely as possible.
- Produce Markdown. Use `##` for internal headings inside the section if helpful, and bullet lists / tables where appropriate.
- Target: a 50% draft the user will edit. Skeletons + grounded content > polished prose with hallucinations.
- Do NOT include the section title at the top — the editor adds it.
- At the end, append a line beginning with `<!-- refs: ` listing the 원본 file names you drew from, e.g. `<!-- refs: ir_deck.pdf, 2024_사업계획서.docx -->`.
"""


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    return match.group(1).strip() if match else text


async def parse_template(template_text: str) -> dict[str, Any]:
    resp = await client().messages.create(
        model=config.MODEL,
        max_tokens=8000,
        system=TEMPLATE_PARSE_SYSTEM,
        messages=[{"role": "user", "content": template_text[:120_000]}],
    )
    raw = "".join(block.text for block in resp.content if block.type == "text")
    data = json.loads(_strip_code_fence(raw))
    sections = data.get("sections") or []
    for i, s in enumerate(sections):
        s.setdefault("id", f"s{i+1}")
        s.setdefault("guidance", "")
        s.setdefault("char_limit", None)
    data["sections"] = sections
    return data


async def generate_section(
    section: dict[str, Any],
    source_chunks: list[dict[str, str]],
) -> str:
    source_block = "\n\n".join(
        f"=== 원본 파일: {c['name']} ===\n{c['text']}" for c in source_chunks
    )
    user = (
        f"# 섹션 제목\n{section['title']}\n\n"
        f"# 섹션 안내\n{section.get('guidance') or '(안내 없음)'}\n\n"
        f"# 글자/페이지 제약\n{section.get('char_limit') or '(명시 없음)'}\n\n"
        f"# 원본 자료\n{source_block[:150_000]}\n"
    )
    resp = await client().messages.create(
        model=config.MODEL,
        max_tokens=4000,
        system=SECTION_DRAFT_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(block.text for block in resp.content if block.type == "text").strip()
