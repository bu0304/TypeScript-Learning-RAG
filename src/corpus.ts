import { listFiles } from "./utils/listFiles.ts";
import { readFile } from "node:fs/promises";
import { createHash } from 'node:crypto';

export interface Chunk {
  id: string; // 穩定 id，第 2 步寫 eval 要靠它比對
  file: string; // 檔案名稱，例如 'flexbox.md'
  heading: string; // markdown 標題
  text: string; // 內文
}

export interface Doc {
  file: string; // 檔案名稱，例如 'flexbox.md'
  text: string; // 內文
}

interface HeadingRange {
  start: number;
  end?: number;
}

// 需要的副檔名
const EXTS = [
  ".md", // markdown
  ".mdx", // markdown + JSX
];

export async function loadDocs(root: string): Promise<Doc[]> {
  const files = await listFiles(root, EXTS);

  const docs: Doc[] = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    docs.push({ file, text });
  }

  return docs;
}

// 先採用簡單的判斷方法，正式場合應考慮正則
function getHeadingNumber(line: string): number {
  for (let i = 6; i >= 1; i--) {
    if (line.startsWith("#".repeat(i))) return i;
  }
  return 0;
}

const hashId = (s: string) =>
  createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12);

export function chunk(doc: Doc): Chunk[] {
  const file = doc.file;
  const rawText = doc.text;

  const lines = rawText.split(/\r?\n/);

  if (lines.length === 0) return [];

  const h1: HeadingRange[] = [];
  const h2: HeadingRange[] = [];
  const h3: HeadingRange[] = [];
  const h4: HeadingRange[] = [];
  const h5: HeadingRange[] = [];
  const h6: HeadingRange[] = [];

  const headings = [h1, h2, h3, h4, h5, h6];

  let isCode = false;

  for (const [lineIndex, line] of lines.entries()) {
    // ======避免程式碼區塊內的註解被當成 H1======
    if (line.startsWith('```')) {
      isCode = !isCode;
    }

    if (isCode) {
      continue;
    }
    // ====================================

    const isHeading = /^#{1,6} /.test(line);
    if (!isHeading) continue;

    const number = getHeadingNumber(line);
    if (number === 0 || number > 6) {
      console.warn(`chunk: strange heading number: ${number}`);
      continue;
    }

    // number = 1 表示 H1，對應 headings 陣列裡的 index 0
    //
    // 假設從上到下依序是 H1~H4，接下來如果讀到 H3 的話，這個 H3 的上一行，會是前一個 H3 跟 H4 的結束標籤，
    // 所以要把 H3 以後的 end 補上。
    for (let i = number - 1; i < 6; i++) {
      const heading = headings[i];
      if (heading.length > 0) {
        heading[heading.length - 1].end = lineIndex - 1; // 寫入結束位置
      }
    }

    const heading = headings[number - 1];
    heading.push({ start: lineIndex }); // 初始化起始位置
  }

  for (const heading of headings) {
    if (heading.length === 0) continue;
    if (heading[heading.length - 1].end === undefined) {
      heading[heading.length - 1].end = lines.length - 1;
    }
  }

  const chunks: Chunk[] = [];

  // 用簡單的方法判斷這個檔案的行結尾有沒有 \r
  // eol = end of line
  const eol = /\r\n/.test(rawText) ? "\r\n" : "\n";

  for (let i = 0; i < 6; i++) {
    const heading = headings[i];
    for (let j = 0; j < heading.length; j++) {
      const { start, end } = heading[j];
      if (end === undefined) {
        console.warn(`chunk: end shoult not be undefined. startIndex = ${start}`);
        continue;
      }

      chunks.push({
        id: hashId(lines[start]),
        file,
        heading: lines[start],
        text: lines.slice(start, end + 1).join(eol),
      });
    }
  }

  return chunks;
}
