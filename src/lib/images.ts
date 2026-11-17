import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function saveImage(file: File, directory: string, filename: string, mode: "logo" | "photo") {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem passa de 8 MB.");
  const source = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const pipeline = sharp(source).rotate();
    output =
      mode === "logo"
        ? await pipeline.resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).png().toBuffer()
        : await pipeline.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
  } catch {
    throw new Error("Não foi possível ler a imagem.");
  }
  const ext = mode === "logo" ? "png" : "jpg";
  const folder = path.join(process.cwd(), "public", directory);
  await fs.mkdir(folder, { recursive: true });
  const basename = filename.replace(/[^a-zA-Z0-9_-]/g, "");
  await fs.writeFile(path.join(folder, `${basename}.${ext}`), output);
  return `/${directory}/${basename}.${ext}`;
}

export async function removePublicFile(urlPath: string) {
  if (!urlPath.startsWith("/uploads/")) return;
  const file = path.join(process.cwd(), "public", urlPath);
  await fs.rm(file, { force: true });
}
