# 언어의숲 그로스 과제 — 산출물 모음

## 파일 구성

| # | 파일 | 내용 | 용도 |
|---|---|---|---|
| 1 | `01_funnel.md` | 비즈니스 퍼널 (3-1) — 9단계 + Awareness 6채널 + 타겟 공통점 | 슬라이드 1 |
| 2 | `02_user_flow.md` | 유저 플로우 (3-2) — 실제 화면 기반 23개 노드 + Mermaid 도식 | 슬라이드 2~3 (Miro/FigJam) |
| 3 | `03_key_metrics.csv` | Key Metrics (3-3) — 구글시트 import용 일자별 헤더 + 파생 지표 | 구글시트 |
| 4 | `03_key_metrics_definitions.md` | 화면별 측정 이벤트 정의 + 지표 공식 | 슬라이드 4 + 시트 부록 |
| 5 | `04_compare_notes.md` | 본인 v1 vs 권장 v2 비교 노트 | 발표·질의응답용 |
| 6 | `README.md` | 이 문서 | 사용 가이드 |

## 슬라이드/시트로 옮기는 방법

### 1. 퍼널 슬라이드 (3-1)
- `01_funnel.md` 의 ASCII 도식을 Figma/슬라이드에서 박스 도형으로 재현
- **시각 규칙**: Pull > Push 크기, Retention 박스 가장 큼, Fan 흐릿하게
- Awareness 6채널은 별도 표로 우측 배치

### 2. 유저플로우 (3-2)
**옵션 A — Miro/FigJam (권장)**
1. 이미 보유한 화면 캡처 (Acquisition 7장 + Activation 10장 + Revenue 3장 + Referral 2장)를 노드로 직접 배치
2. `02_user_flow.md` 의 화살표·분기 규칙대로 연결
3. 빨간 박스 6개 (핵심 분기점)를 별도 강조

**옵션 B — Mermaid (빠른 초안용)**
1. `02_user_flow.md` 의 Mermaid 블록을 https://mermaid.live 에 붙여넣기
2. PNG export 후 슬라이드에 삽입

### 3. Key Metrics 시트 (3-3)
1. `03_key_metrics.csv` 를 구글시트에서 `파일 → 가져오기 → 업로드`
2. 첫 행 헤더 22개 컬럼 확인
3. 일자별 행에 실제 수치 입력 (Mixpanel/Amplitude/GA에서 가져오기)
4. 우측에 곱셈 공식 수식 셀 추가 (예: `=B2*C2/B2*D2/C2...`)
5. 파생 지표 표는 별도 시트(`Definitions`)로 분리

### 4. 발표 시
- `04_compare_notes.md` 를 핸드아웃으로 활용
- "왜 표준 순서를 택했는가" / "왜 Sales를 뺐는가" 등 질문 대응

## 사업계획서 → 산출물 매핑

| 사업계획서 항목 | 반영된 산출물 |
|---|---|
| D1 30%, D7 14%, 부활 2% (p.17) | 03_key_metrics |
| 결제전환 1.8%, ARPPU 55K (p.14) | 03_key_metrics |
| K=0.31 바이럴 (p.11) | 01_funnel (Referral), 03_key_metrics |
| 2535 여성 페르소나 (p.12) | 02_user_flow (김지연) |
| BM 4단계 확장 (p.15) | 01_funnel (Revenue 노트) |
| LTV/CAC 4.73→6.9→12.5 (p.16) | 03_key_metrics 목표 컬럼 |
| 리텐션 곡선 D1→D66 (p.18) | 02_user_flow (Retention 루프) |

## 미해결 항목 (사용자 결정 필요)

1. **"Something else" 4번째 목표** — 정해지면 03_key_metrics 에 해당 영역 컬럼 추가
2. **Fan 단계 포함 여부** — 현재 포함(흐릿하게) / 빼고 싶다면 마지막 퍼널을 Referral로
3. **실제 일자별 데이터 출처** — Mixpanel? Amplitude? GA? 직접 SQL? (시트에 import할 데이터 소스 확정 필요)
4. **Referral 보내는 쪽 화면** — 화면 캡처 미공개. 추측("결과 카드 공유")으로 작성됨

## 검증 체크리스트

- [ ] 양식 샘플(월급쟁이부자들·마이리얼트립·로로스클럽·오버싱크) 구조와 1:1 비교
- [ ] 사업계획서 모든 정량 지표가 03_key_metrics 에 반영됐는지
- [ ] 유저플로우 노드가 실제 앱 화면과 일치하는지 (Acquisition 7 / Activation 9 / Revenue 5 / Referral 2)
- [ ] Mermaid가 https://mermaid.live 에서 정상 렌더링되는지
- [ ] CSV가 구글시트에서 올바르게 import되는지
