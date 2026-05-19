import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const template = JSON.parse(
  await fs.readFile('proposal/templates/innovation-league-2026.json', 'utf8'),
);
const draft = JSON.parse(await fs.readFile('proposal/output/draft.text.json', 'utf8'));
const draftText = Object.values(draft).join('\n\n---\n\n');

const sectionList = template.sections.flatMap((s) =>
  (s.items || []).map((it) => ({
    itemId: it.id,
    label: it.label,
    guide: it.guide || '',
  })),
);

const prompt = `당신은 K-Startup 혁신리그 사업계획서 코치다.
아래 사용자의 초안 텍스트를, PSST 표준 양식의 각 세부항목으로 분배하라.
초안에 해당 내용이 없으면 빈 문자열을 넣는다. 원문을 가공/요약하지 말고 발췌만 한다.

[양식 세부항목]
${sectionList.map((s) => `- ${s.itemId} ${s.label} — ${s.guide}`).join('\n')}

[사용자 초안]
${draftText}

[출력 형식]
JSON: { "1-1": "...", "1-2": "...", "2-1": "...", ... }
키는 itemId 만 사용한다.`;

const resp = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  response_format: { type: 'json_object' },
});

const mapping = JSON.parse(resp.choices[0].message.content);
await fs.writeFile(
  'proposal/output/mapped.json',
  JSON.stringify(mapping, null, 2),
);
console.log('✓ 섹션 매핑 완료 → proposal/output/mapped.json');
