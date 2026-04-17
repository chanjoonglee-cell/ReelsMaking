# 정부사업 사업계획서 자동화 (MVP)

원본(IR · 기존 사업계획서) + 양식(공고문 · 계획서 양식) 2개만 업로드하면, Claude Opus 4.7이 섹션별로 초안을 만들고, 마크다운으로 편집한 뒤, HWP/DOCX/PDF로 내보내는 1인용 로컬 웹 도구.

## 요구사항

- Python 3.10+
- Anthropic API 키 (`claude-opus-4-7` 접근 권한)
- (선택) `pandoc` — 더 정돈된 DOCX 출력을 원할 때
- (선택) `libreoffice` 또는 `soffice` — HWP 내보내기에 필요

### 설치

```bash
# 프로젝트 루트에서
cd proposal-tool
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY를 채우세요.
```

macOS에서 외부 도구:

```bash
brew install pandoc libreoffice
```

Linux:

```bash
sudo apt install pandoc libreoffice
```

## 실행

```bash
python app.py
```

브라우저가 자동으로 `http://127.0.0.1:8000` 을 엽니다.

## 사용 흐름

1. 메인 화면에 두 개의 드롭존. 왼쪽은 **원본 자료**, 오른쪽은 **사업 양식**.
2. 각 드롭존에 파일을 드래그 앤 드롭 (PDF / DOCX / PPTX / TXT / MD).
3. `초안 생성하기 →` 클릭.
4. 진행 상황이 실시간으로 표시됨 (양식 파싱 → 섹션별 생성).
5. 완료되면 마크다운 에디터로 자동 이동.
6. 좌/우 split view에서 편집. 좌측 사이드바의 `↻` 버튼으로 섹션 개별 재생성.
7. 헤더 우측 `PDF / DOCX / HWP` 버튼으로 다운로드.

## 프로젝트 구조

```
proposal-tool/
├── app.py                    # 런처 (브라우저 자동 오픈 + uvicorn)
├── requirements.txt
├── .env.example
├── backend/
│   ├── main.py               # FastAPI 라우트
│   ├── config.py
│   ├── storage.py            # 로컬 세션 저장
│   ├── parsers.py            # PDF/DOCX/PPTX/TXT/MD → 텍스트
│   ├── claude_client.py      # Claude Opus 4.7 호출
│   └── exporters.py          # markdown → PDF/DOCX/HWP
├── frontend/
│   ├── templates/            # Jinja2 HTML
│   └── static/               # CSS / JS
└── sessions/                 # 로컬 세션 저장소 (gitignore)
```

## 세션 저장 위치

`proposal-tool/sessions/<세션_id>/` 아래에 원본·양식·초안이 모두 보관됩니다.

```
sessions/<id>/
├── meta.json          # 세션 메타, 양식 파싱 결과, 진행 상태
├── sources/           # 업로드한 원본 파일
├── templates/         # 업로드한 양식 파일
├── sections.json      # 섹션별 초안 (재생성용)
├── draft.md           # 통합 마크다운 (편집 소스)
└── exports/           # 내보낸 파일
```

## 알려진 한계 (MVP)

- **초안 품질 목표는 50%**. 최종 제출 전 숫자·고유명사·뉘앙스는 직접 검수해야 함. 프롬프트는 환각을 막기 위해 원본에 없는 사실은 `[확인 필요: …]` 로 표시하도록 설계됨.
- **HWP 내보내기**는 LibreOffice를 통한 DOCX→HWP 변환이라, 복잡한 양식 표/머리말은 깨질 수 있음. 실제 제출은 아래아한글에서 10분 정도 서식 조정 후 처리하는 것을 전제.
- **원본/양식 라이브러리**는 Phase 2로 미뤘음. MVP는 매번 업로드.

## 개발 참고

- 섹션 생성은 `asyncio.Semaphore(4)` 로 병렬 실행. 필요시 `.env` 의 `SECTION_CONCURRENCY` 조정.
- 자동 저장은 편집기에서 최종 변경 후 0.8초 debounce.
- 진행 상황은 SSE(`/api/sessions/{id}/stream`) 스트림으로 전달.
