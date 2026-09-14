import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * 遞迴列出資料夾內指定副檔名的檔案
 * @param dir  起始資料夾
 * @param exts 副檔名清單，如 ['.ts', '.tsx']；空陣列代表全部
 * @returns 絕對路徑陣列（已排序）
 */
export async function listFiles(
  dir: string,
  exts: readonly string[] = [],
  ignore: readonly string[] = ["node_modules", ".git"],
): Promise<string[]> {
  const root = path.resolve(dir);

  const wanted = new Set<string>(
    exts.map((e) => (e.startsWith(".") ? e : `.${e}`).toLowerCase()),
  );

  const entries = await readdir(root, { recursive: true, withFileTypes: true });

  return entries
    .filter(e => e.isFile())
    .map(e => path.join(e.parentPath, e.name))
    .filter(p => !ignore.some(name => path.relative(root, p).split(path.sep).includes(name)))
    .filter(p => wanted.size === 0 || wanted.has(path.extname(p).toLowerCase()))
    .sort();
}
