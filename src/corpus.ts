import path from "node:path";
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

// 需要的副檔名
const EXTS = [
  ".md", // markdown
  ".mdx", // markdown + JSX
];

export async function loadDocs(root: string): Promise<Doc[]> {
  const files = await listFiles(root, EXTS);

  const docs: Doc[] = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(root, absolutePath);
    const text = await readFile(absolutePath, "utf8");
    docs.push({ file: relativePath, text });
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

function resolveChunk(headings: string[], file: string, chunkTexts: string[], eol: string): Chunk {
  let headingPath = headings.join("");

  return {
    id: file + headingPath,
    file,
    heading: headingPath,
    text: chunkTexts.join(eol),
  }
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
      chunks.push(resolveChunk(headings, file, chunkTexts, eol));

      // 結算後重置
      chunkTexts = [];
    }

    // 要更新對應的 headings，並將所有後續的子級清除
    // number = 1 表示 H1，對應 headings 陣列裡的 index 0
    headings[number - 1] = line;
    for (let i = number; i < 6; i++) {
      headings[i] = '';
    }

    // 把 heading 放進 chunkText 第一行
    chunkTexts.push(line);
  }

  // 補結算 chunkText
  if (chunkTexts.length > 0) {
    chunks.push(resolveChunk(headings, file, chunkTexts, eol));
  }

  // 針對相同 id 的 chunk 補上編號
  const resultChucks = addSuffixNumberIfSameId(chunks);

  return resultChucks;
}

function addSuffixNumberIfSameId(chunks: Chunk[]): Chunk[] {
  const idToChunks = new Map<string, Chunk[]>();

  for (const chunk of chunks) {
    if (!idToChunks.has(chunk.id)) idToChunks.set(chunk.id, []); // init value
    idToChunks.get(chunk.id)!.push(chunk);
  }

  const resultChunks: Chunk[] = [];

  for (const [id, chunks] of idToChunks.entries()) {
    if (chunks.length === 1) {
      resultChunks.push(...chunks);
    } else {
      for (let i = 0; i < chunks.length ; i++) {
        const chunk = chunks[i];
        resultChunks.push({...chunk, id: `${chunk.id}${i}`, heading: `${chunk.heading}`})
      }
    }
  }

  return resultChunks;
}