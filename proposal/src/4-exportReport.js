import fs from 'node:fs/promises';

const reviews = JSON.parse(await fs.readFile('proposal/output/review.json', 'utf8'));

const verdictBadge = {
  STRONG: '🟢 STRONG',
  OK: '🟡 OK',
  WEAK: '🟠 WEAK',
  MISSING: '🔴 MISSING',
};

const lines = [];
lines.push('# K-Startup 혁신리그 2026 — 사업계획서 리뷰 리포트\n');

const avg = Math.round(reviews.reduce((a, r) => a + (r.score || 0), 0) / reviews.length);
lines.push(`**총평 점수**: ${avg} / 100\n`);

lines.push('## 항목별 요약\n');
lines.push('| 항목 | 점수 | 판정 | 핵심 갭 |');
lines.push('|------|------|------|---------|');
for (const r of reviews) {
  const gap = (r.gaps?.[0] || '-').replace(/\|/g, '\\|');
  lines.push(`| ${r.itemId} ${r.label} | ${r.score ?? '-'} | ${verdictBadge[r.verdict] || r.verdict} | ${gap} |`);
}

lines.push('\n## 항목별 상세 + 즉시 적용 가능한 개정안\n');
for (const r of reviews) {
  lines.push(`### ${r.itemId} ${r.label} — ${verdictBadge[r.verdict] || r.verdict} (${r.score})\n`);
  if (r.summaryOfDraft) lines.push(`**초안 요약**: ${r.summaryOfDraft}\n`);
  if (r.gaps?.length) {
    lines.push('**갭 (Gaps)**');
    for (const g of r.gaps) lines.push(`- ${g}`);
    lines.push('');
  }
  if (r.rewriteSuggestion) {
    lines.push('**개정안 (양식에 그대로 붙여넣기 가능)**');
    lines.push('```');
    lines.push(r.rewriteSuggestion);
    lines.push('```\n');
  }
  if (r.evidenceToAdd?.length) {
    lines.push('**보강할 근거 자료**');
    for (const e of r.evidenceToAdd) lines.push(`- ${e}`);
    lines.push('');
  }
  if (r.redFlags?.length) {
    lines.push('**⚠️ Red Flags**');
    for (const f of r.redFlags) lines.push(`- ${f}`);
    lines.push('');
  }
}

const outMd = 'proposal/output/report.md';
await fs.writeFile(outMd, lines.join('\n'));
console.log(`✓ 마크다운 리포트 → ${outMd}`);

const merged = reviews
  .map((r) => `## ${r.itemId} ${r.label}\n\n${r.rewriteSuggestion || ''}\n`)
  .join('\n');
const outBody = 'proposal/output/revised-body.md';
await fs.writeFile(outBody, merged);
console.log(`✓ 양식 붙여넣기용 본문 → ${outBody}`);
console.log('\n→ revised-body.md 의 각 섹션을 사업계획서_양식(혁신창업리그).hwpx 의 동일 항목에 그대로 붙여넣으세요.');
