"""Async wrapper over the OpenAI SDK for template parsing and section drafting."""
from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI

from . import config


_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set. Copy .env.example to .env and fill it in.")
        _client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
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

PEOPLE / TEAM — 특별히 엄격하게 지킬 것:
- 팀원의 이름·직함·역할은 원본에 **표기된 문자열 그대로** 인용한다. 한 글자도 추측하지 말 것.
- 원본에 "대표 김철수, CTO 박영희" 로 되어있으면 그 매핑을 절대 바꾸지 말 것. CTO 를 대표로, 디자이너를 대표로 바꾸지 말 것.
- 원본에 대표자 이름이 명확히 표시되어 있지 않으면 `[확인 필요: 대표자 이름]` 으로 표기. 아무나 대표로 추정해서 쓰지 말 것.
- "팀 구성" / "Team" / "About us" / "대표" / "Founder" / "CEO" / "CTO" 등의 키워드 주변 문맥만 근거로 삼고, 다른 섹션의 등장인물을 팀원으로 오해하지 말 것.

서식:
- Match the section's guidance and 글자/페이지 제약 as closely as possible.
- Produce Markdown. Use `##` for internal headings inside the section if helpful, and bullet lists / tables where appropriate.
- Target: a 50% draft the user will edit. Skeletons + grounded content > polished prose with hallucinations.
- Do NOT include the section title at the top — the editor adds it.
- At the end, append a line beginning with `<!-- refs: ` listing the 원본 file names you drew from, e.g. `<!-- refs: ir_deck.pdf, 2024_사업계획서.docx -->`.
"""


async def parse_template(template_text: str) -> dict[str, Any]:
    resp = await client().chat.completions.create(
        model=config.MODEL,
        max_tokens=8000,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": TEMPLATE_PARSE_SYSTEM},
            {"role": "user", "content": template_text[:120_000]},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    data = json.loads(raw)
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
    resp = await client().chat.completions.create(
        model=config.MODEL,
        max_tokens=4000,
        messages=[
            {"role": "system", "content": SECTION_DRAFT_SYSTEM},
            {"role": "user", "content": user},
        ],
    )
    return (resp.choices[0].message.content or "").strip()
