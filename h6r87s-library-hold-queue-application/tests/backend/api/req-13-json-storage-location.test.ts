import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import request from "supertest";

import { createApp } from "../../../repository_after/backend/src/app";
import { JsonStore } from "../../../repository_after/backend/src/store";
import { createTempDataFile, readJson } from "../../shared/tempStore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Req 13 - JSON file storage under /backend/data + concurrency integrity", () => {
  it("backend data path is under repository_after/backend/data and store can use it", async () => {
    // Req 13: storage must be under /backend/data. Resolve that path from project root
    // (no reliance on process.chdir, which is unreliable in test workers).
    const projectRoot = path.resolve(__dirname, "..", "..", "..");
    const backendDataPath = path.resolve(
      projectRoot,
      "repository_after",
      "backend",
      "data",
      "data.json",
    );
    expect(backendDataPath.replaceAll("\\", "/")).toContain(
      "repository_after/backend/data/data.json",
    );

    const store = new JsonStore(backendDataPath);
    const p = store.getPath();
    expect(p).toBe(backendDataPath);

    await store.init();
    await fs.access(p);
  });

  it(
    "maintains integrity under concurrent requests (no ID/position collisions)",
    async () => {
      const { file } = await createTempDataFile();
      const app = createApp({ dataPath: file });
      const api = request(app);

      const book = await api
        .post("/api/books")
        .send({ title: "Concurrency Book", copies: 1 })
        .expect(200);
      const bookId = book.body.id;

      // Fire many holds concurrently.
      const N = 50;
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          api.post("/api/hold").send({ email: `u${i}@x.com`, bookId }),
        ),
      );

      // All should succeed
      for (const r of results) expect(r.status).toBe(200);

      // Validate positions are unique and 1..N (stable, no collisions)
      const positions = results
        .map((r) => r.body.position)
        .sort((a, b) => a - b);
      expect(positions).toEqual(Array.from({ length: N }, (_, i) => i + 1));

      // Validate hold IDs are unique integers
      const holdIds = results.map((r) => r.body.holdId);
      expect(new Set(holdIds).size).toBe(N);
      for (const id of holdIds) expect(Number.isInteger(id)).toBe(true);

      // Ensure JSON file is still valid and contains N holds
      const stored = await readJson(file);
      expect(Array.isArray(stored.holds)).toBe(true);
      expect(stored.holds.length).toBe(N);
    },
    1000 * 20,
  );
});
