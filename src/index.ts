import path from "node:path";
import { chunk, loadDocs } from "./corpus.ts";

// 語料庫的資料夾路徑
const RELATIVE_DATA_FOLDER = "../data";

async function main() {
  const root = path.join(import.meta.dirname, RELATIVE_DATA_FOLDER);

  const docs = await loadDocs(root);
  console.log(`docs.length = ${docs.length}`);

  const totalChunks = [];
  let totalSize = 0;
  let maxSize = 0;
  let minSize: undefined | number = undefined

  for (const doc of docs) {
    const chunks = chunk(doc);
    for (const chunk of chunks) {
      if (minSize === undefined) minSize = chunk.text.length; // initialize minSize
      totalSize += chunk.text.length
      maxSize = Math.max(maxSize, chunk.text.length);
      minSize = Math.min(minSize, chunk.text.length);
      totalChunks.push(chunk);
    }
  }

  console.log(`totalChunks.length = ${totalChunks.length}`)
  console.log(`avg size = ${totalSize / totalChunks.length}`)
  console.log(`maxSize = ${maxSize}`)
  console.log(`minSize = ${minSize}`)

  // 檢查有沒有重複 id
  const chunkIdSet = new Set<string>();
  totalChunks.forEach(c=> {
    if (chunkIdSet.has(c.id)) console.log(`repeated id = ${c.id}`);
    chunkIdSet.add(c.id)
  })
}

main();
