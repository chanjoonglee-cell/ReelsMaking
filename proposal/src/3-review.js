import fs from 'node:fs/promises';
import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const template = JSON.parse(
  await fs.readFile('proposal/templates/innovation-league-2026.json', 'utf8'),
);
const mapping = JSON.parse(await fs.readFile('proposal/output/mapped.json', 'utf8'));
const reviewPrompt = await fs.readFile('proposal/prompts/review.md', 'utf8');

const reviews = [];
for (const section of template.sections) {
  for (const item of section.items || []) {
    const draftForItem = mapping[item.id] || '';
    const messages = [
      { role: 'system', content: reviewPrompt },
      {
        role: 'user',
        content: `[세부항목] ${item.id} ${item.label}
[작성 가이드] ${item.guide || ''}
[페이지 예산] ${section.pageBudget || '-'}
[사용자 초안]
${draftForItem || '(작성된 내용 없음)'}`,
      },
    ];
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: { type: 'json_object' },
    });
    const r = JSON.parse(resp.choices[0].message.content);
    r.itemId = item.id;
    r.label = item.label;
    reviews.push(r);
    console.log(`✓ ${item.id} ${item.label} — ${r.verdict} (${r.score})`);
  }
}

await fs.writeFile(
  'proposal/output/review.json',
  JSON.stringify(reviews, null, 2),
);
console.log('\n✓ 리뷰 완료 → proposal/output/review.json');
