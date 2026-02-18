import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initialData } from "./fixtures";

export async function createTempDataFile(): Promise<{ dir: string; file: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hold-queue-tests-"));
  const file = path.join(dir, "data.json");
  await fs.writeFile(file, JSON.stringify(initialData, null, 2), "utf-8");
  return { dir, file };
}

export async function readJson(file: string): Promise<any> {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw);
}
