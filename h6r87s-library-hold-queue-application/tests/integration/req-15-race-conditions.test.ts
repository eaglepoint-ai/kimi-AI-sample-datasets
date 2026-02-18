import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../repository_after/backend/src/app";
import { createTempDataFile, readJson } from "../shared/tempStore";

describe("Integration - Req 15 race conditions / consistency", () => {
  it("many concurrent returns do not double-assign or corrupt copiesAvailable", async () => {
    const { file } = await createTempDataFile();
    const app = createApp({ dataPath: file });
    const api = request(app);

    // copies=1 makes each assignment deterministic (at most 1 per return call)
    const bookRes = await api
      .post("/api/books")
      .send({ title: "Race Book", copies: 1 })
      .expect(200);
    const bookId = bookRes.body.id;

    // Create a queue of holds
    const N = 10;
    for (let i = 0; i < N; i++) {
      await api
        .post("/api/hold")
        .send({ email: `u${i}@x.com`, bookId })
        .expect(200);
    }

    // Fire many returns concurrently (more returns than holds)
    const R = 20;
    const retResults = await Promise.all(
      Array.from({ length: R }, () => api.post("/api/return").send({ bookId })),
    );

    // Collect assignments (some returns may assign null after queue is exhausted)
    const assigned = retResults
      .filter((r) => r.status === 200)
      .map((r) => r.body.assignedTo)
      .filter((x) => x != null);

    // No hold should be assigned twice
    expect(new Set(assigned).size).toBe(assigned.length);

    // State checks from JSON
    const stored = await readJson(file);

    const book = stored.books.find((b: any) => b.id === bookId);
    expect(book).toBeTruthy();

    // copiesAvailable should never be negative
    expect(book.copiesAvailable).toBeGreaterThanOrEqual(0);
    expect(book.copiesAvailable).toBeLessThanOrEqual(book.copiesTotal);

    // fulfilled holds count matches unique assignments (should be <= N)
    const fulfilledCount = stored.holds.filter(
      (h: any) => h.bookId === bookId && h.fulfilled,
    ).length;
    expect(fulfilledCount).toBeLessThanOrEqual(N);
    expect(fulfilledCount).toBe(assigned.length);
  });
});
