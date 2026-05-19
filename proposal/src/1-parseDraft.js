import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const INPUT_DIR = path.resolve('proposal/input');
const OUT_FILE = path.resolve('proposal/output/draft.text.json');

async function readDoc(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return fs.readFile(filePath, 'utf8');
  }
  if (ext === '.docx') {
    const { default: mammoth } = await import('mammoth');
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  if (ext === '.hwp' || ext === '.hwpx') {
    // hwp5txt (pip install pyhwp) 또는 hwp5html 사용
    try {
      const { stdout } = await execFileP('hwp5txt', [filePath]);
      return stdout;
    } catch {
      throw new Error(`HWP 파싱 실패: \`pip install pyhwp\` 후 다시 실행하거나, .docx 로 변환해서 넣어주세요.`);
    }
  }
  throw new Error(`지원하지 않는 형식: ${ext}`);
}

const files = (await fs.readdir(INPUT_DIR)).filter((f) => !f.startsWith('.'));
if (files.length === 0) {
  console.error('proposal/input/ 에 사업계획서 초안을 넣어주세요 (.txt, .md, .docx, .hwp, .hwpx)');
  process.exit(1);
}

const draft = {};
for (const f of files) {
  draft[f] = await readDoc(path.join(INPUT_DIR, f));
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, JSON.stringify(draft, null, 2));
console.log(`✓ 초안 파싱 완료 → ${OUT_FILE}`);
