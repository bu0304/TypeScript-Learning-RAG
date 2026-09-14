import { listFiles } from "./utils/listFiles.ts";
import { readFile } from "node:fs/promises";

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

export function chunk(doc: Doc): Chunk[] {
  const file = doc.file;
  const rawText = doc.text;

  const lines = rawText.split(/\r?\n/);

  if (lines.length === 0) return [];

  // 用簡單的方法判斷這個檔案的行結尾有沒有 \r
  // eol = end of line
  const eol = /\r\n/.test(rawText) ? "\r\n" : "\n";

  const chunks: Chunk[] = [];

  const headings = ["", "", "", "", "", ""];

  let chunkTexts: string[] = [];

  let isCode = false;

  for (const [lineIndex, line] of lines.entries()) {
    // 避免程式碼區塊內的註解被當成 H1
    if (line.startsWith("```")) {
      isCode = !isCode;
    }

    if (isCode) {
      chunkTexts.push(line);
      continue;
    }

    const isHeading = /^#{1,6} /.test(line);
    if (!isHeading) {
      chunkTexts.push(line);
      continue;
    }

    const number = getHeadingNumber(line);
    if (number === 0 || number > 6) {
      console.warn(`chunk: strange heading number: ${number}`);
      chunkTexts.push(line);
      continue;
    }

    // 每個 heading 都是上一個 heading 的結束標記，所以要先把之前累積的 chunkText 結算給上一個 heading。
    if (chunkTexts.length > 0) {
      // 先算 headingPath
      const headingPath = file + headings.join("");

      // 結算 chunkText
      chunks.push({
        id: headingPath,
        file,
        heading: headingPath,
        text: chunkTexts.join(eol),
      });

      // 結算後重置
      chunkTexts = [];
    }

    // 要更新對應的 headings，並將所有後續的子級清除
    // number = 1 表示 H1，對應 headings 陣列裡的 index 0
    headings[number - 1] = `L${lineIndex}` + line;
    for (let i = number; i < 6; i++) {
      headings[i] = '';
    }
  }

  // 補結算 chunkText
  if (chunkTexts.length > 0) {
    // 先算 headingPath
    const headingPath = file + headings.join("");

    // 結算 chunkText
    chunks.push({
      id: headingPath,
      file,
      heading: headingPath,
      text: chunkTexts.join(eol),
    });
  }

  return chunks;
}
