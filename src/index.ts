// Toolchain sanity check —— 確認 Node 原生 type stripping 正常運作。
// 確認完就可以整個刪掉，換成你自己的 RAG 入口。

interface Chunk {
  id: string;
  text: string;
}

const chunk: Chunk = { id: 'hello', text: 'toolchain works' };

console.log(`node ${process.version} — ${chunk.text}`);
