import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import request from "supertest";

import { createApp } from "../../repository_after/backend/src/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Integration - Req 13 default data path determinism", () => {
  it(
    "writes to backend/data/data.json even when app starts from non-backend cwd",
    async () => {
      const projectRoot = path.resolve(__dirname, "..", "..");
      const backendDataPath = path.resolve(
        projectRoot,
        "repository_after",
        "backend",
        "data",
        "data.json",
      );

      let previousRaw: string | null = null;
      try {
        previousRaw = await fs.readFile(backendDataPath, "utf-8");
      } catch (e: any) {
        if (e?.code !== "ENOENT") throw e;
      }

      const tempCwd = await fs.mkdtemp(path.join(os.tmpdir(), "hold-cwd-"));
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempCwd);
      const previousDataPathEnv = process.env.DATA_PATH;
      delete process.env.DATA_PATH;

      try {
        const marker = `cwd-proof-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const app = createApp();
        const api = request(app);

        await api
          .post("/api/books")
          .send({ title: marker, copies: 1 })
          .expect(200);

        const storedRaw = await fs.readFile(backendDataPath, "utf-8");
        const stored = JSON.parse(storedRaw);
        const found = stored.books.some((b: any) => b.title === marker);
        expect(found).toBe(true);
      } finally {
        cwdSpy.mockRestore();
        if (previousDataPathEnv == null) {
          delete process.env.DATA_PATH;
        } else {
          process.env.DATA_PATH = previousDataPathEnv;
        }

        if (previousRaw == null) {
          await fs.unlink(backendDataPath).catch(() => undefined);
        } else {
          await fs.writeFile(backendDataPath, previousRaw, "utf-8");
        }

        await fs.rm(tempCwd, { recursive: true, force: true });
      }
    },
    1000 * 20,
  );
});
