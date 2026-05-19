#!/usr/bin/env node
/**
 * 혁신리그 사업계획서 HWPX 자동 주입기
 *
 * 사용법:
 *   node proposal/scripts/inject.mjs
 *
 * 입력:
 *   proposal/uploads/혁신리그_양식.hwpx   (원본 양식)
 *   proposal/sections/{1-1,1-2,...}.md    (각 항목별 본문)
 *
 * 출력:
 *   proposal/hwpx-output/사업계획서.hwpx  (한글로 열기)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// vendor한 hwpxcore 사용
const { HwpxDocument } = await import(
  path.join(ROOT, 'proposal/hwpx-cli-vendor/packages/hwpx-core/dist/index.js')
);

const TEMPLATE = path.join(ROOT, 'proposal/uploads/혁신리그_양식.hwpx');
const OUTPUT = path.join(ROOT, 'proposal/hwpx-output/사업계획서.hwpx');

// 각 itemId → 양식 내 헤더 텍스트 매핑 (정확 매칭)
const SECTIONS = [
  { id: '1-1', header: ' 1-1. 창업아이템의 개발 배경 및 필요성', next: ' 1-2. 창업아이템의 목표시장 분석' },
  { id: '1-2', header: ' 1-2. 창업아이템의 목표시장 분석', next: ' 2-1. 창업아이템의 현황(준비) 및 실현(구체화) 방안' },
  { id: '2-1', header: ' 2-1. 창업아이템의 현황(준비) 및 실현(구체화) 방안', next: ' 2-2. 창업아이템의 ESG 가치 실현 정도 및 경쟁력 확보방안' },
  { id: '2-2', header: ' 2-2. 창업아이템의 ESG 가치 실현 정도 및 경쟁력 확보방안', next: ' 3-1. 창업아이템의 사업화 방안' },
  { id: '3-1-1', header: '  3-1-1. 비즈니스 모델(BM)', next: '  3-1-2. 목표시장 진출 방안' },
  { id: '3-1-2', header: '  3-1-2. 목표시장 진출 방안', next: '  3-1-3. 사업 추진 일정' },
  { id: '3-1-3', header: '  3-1-3. 사업 추진 일정', next: ' 3-2. 자금 소요 및 조달계획' },
  { id: '3-2', header: ' 3-2. 자금 소요 및 조달계획', next: '4. 대표자 및 팀원의 보유역량' },
  { id: '4-1', header: ' 4-1. 대표자 현황 및 역량', next: ' 4-2. 팀원 현황 및 역량' },
  { id: '4-2', header: ' 4-2. 팀원 현황 및 역량', next: '5. 수상 및 투자유치 등 이력 사항' },
];

function extractBody(md) {
  // 마크다운에서 ``` ~ ``` 코드블럭 안의 본문만 추출
  const m = md.match(/```\n([\s\S]*?)\n```/);
  if (!m) throw new Error('본문 코드블럭(``` ~ ```)을 찾을 수 없음');
  return m[1].split('\n').filter((l) => l.length > 0);
}

function findIndex(paragraphs, text) {
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].text === text) return i;
  }
  return -1;
}

const buf = await fs.readFile(TEMPLATE);
const doc = await HwpxDocument.open(new Uint8Array(buf));
const sec = doc.sections[0];

let injected = 0;
let skipped = 0;

for (const { id, header, next } of SECTIONS) {
  const mdPath = path.join(ROOT, `proposal/sections/${id}.md`);
  try {
    await fs.access(mdPath);
  } catch {
    skipped++;
    continue;
  }
  const md = await fs.readFile(mdPath, 'utf8');
  const lines = extractBody(md);

  const headerIdx = findIndex(sec.paragraphs, header);
  const nextIdx = findIndex(sec.paragraphs, next);
  if (headerIdx === -1 || nextIdx === -1) {
    console.error(`[${id}] 헤더를 찾을 수 없음: header="${header}" next="${next}"`);
    continue;
  }

  // headerIdx+1 ~ nextIdx-1 사이의 placeholder를 모두 제거
  const removeCount = nextIdx - headerIdx - 1;
  for (let k = 0; k < removeCount; k++) {
    sec.removeParagraph(headerIdx + 1);
  }

  // 새 본문 삽입
  for (let k = 0; k < lines.length; k++) {
    const p = sec.insertParagraphAt(headerIdx + 1 + k, lines[k]);
  }

  injected++;
  console.log(`[${id}] ✓ ${lines.length}줄 주입 (placeholder ${removeCount}개 제거)`);
}

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
const out = await doc.saveToBuffer();
await fs.writeFile(OUTPUT, out);

console.log(`\n✓ 완료: ${injected}개 섹션 주입, ${skipped}개 미작성`);
console.log(`→ ${path.relative(ROOT, OUTPUT)}`);
console.log(`\n한글 오피스에서 열어 확인하세요.`);
