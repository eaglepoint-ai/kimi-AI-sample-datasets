import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../repository_after/backend/src/app";
import { createTempDataFile, readJson } from "../shared/tempStore";

describe("Integration - Req 13 concurrency integrity", () => {
  it(
    "10 concurrent holds => unique incremental ids and stable unique positions; JSON remains valid",
    async () => {
      const { file } = await createTempDataFile();
      const app = createApp({ dataPath: file });
      const api = request(app);

      const bookRes = await api
        .post("/api/books")
        .send({ title: "Concurrency Book", copies: 1 })
        .expect(200);
      const bookId = bookRes.body.id;

      const N = 10;
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          api.post("/api/hold").send({ email: `u${i}@x.com`, bookId }),
        ),
      );

      for (const r of results) expect(r.status).toBe(200);

      const positions = results
        .map((r) => r.body.position)
        .sort((a, b) => a - b);
      expect(positions).toEqual(Array.from({ length: N }, (_, i) => i + 1));

      const holdIds = results.map((r) => r.body.holdId);
      expect(new Set(holdIds).size).toBe(N);
      holdIds.forEach((id) => expect(Number.isInteger(id)).toBe(true));

      const stored = await readJson(file);
      expect(stored.holds.length).toBe(N);
    },
    1000 * 20,
  );
});
