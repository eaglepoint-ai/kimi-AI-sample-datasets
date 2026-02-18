import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 05 - unfreeze triggers assignment when copy available", () => {
  it("unfreezing assigns in queue position order when copies are available", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 2 })
      .expect(200);
    const bookId = book.body.id;

    const a = await api
      .post("/api/hold")
      .send({ email: "a@x.com", bookId })
      .expect(200);
    const b = await api
      .post("/api/hold")
      .send({ email: "b@x.com", bookId })
      .expect(200);

    await api
      .post("/api/freeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);
    await api
      .post("/api/freeze")
      .send({ email: "b@x.com", holdId: b.body.holdId })
      .expect(200);

    // Return both copies (no assignment because all frozen)
    // First return: available=2 (already at max), no increment, no assign (all frozen)
    // Second return: same
    // But we already have 2 available copies from creation! All frozen → stays 2.
    // No returns needed since copies are already available.

    // Unfreeze both; first unfreeze should assign A, second should assign B
    const unA = await api
      .post("/api/unfreeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);
    expect(unA.body.assignedTo).toBe(a.body.holdId);

    const unB = await api
      .post("/api/unfreeze")
      .send({ email: "b@x.com", holdId: b.body.holdId })
      .expect(200);
    expect(unB.body.assignedTo).toBe(b.body.holdId);
  });

  it("concurrent unfreezes assign sequentially by queue position", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 2 })
      .expect(200);
    const bookId = book.body.id;

    const a = await api
      .post("/api/hold")
      .send({ email: "a@x.com", bookId })
      .expect(200);
    const b = await api
      .post("/api/hold")
      .send({ email: "b@x.com", bookId })
      .expect(200);
    await api.post("/api/hold").send({ email: "c@x.com", bookId }).expect(200);

    await api
      .post("/api/freeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);
    await api
      .post("/api/freeze")
      .send({ email: "b@x.com", holdId: b.body.holdId })
      .expect(200);

    const [unA, unB] = await Promise.all([
      api
        .post("/api/unfreeze")
        .send({ email: "a@x.com", holdId: a.body.holdId }),
      api
        .post("/api/unfreeze")
        .send({ email: "b@x.com", holdId: b.body.holdId }),
    ]);

    expect(unA.status).toBe(200);
    expect(unB.status).toBe(200);

    const assigned = new Set([unA.body.assignedTo, unB.body.assignedTo]);
    expect(assigned).toEqual(new Set([a.body.holdId, b.body.holdId]));

    const queue = await api.get(`/api/queue/${bookId}`).expect(200);
    const aRow = queue.body.find((h: any) => h.id === a.body.holdId);
    const bRow = queue.body.find((h: any) => h.id === b.body.holdId);
    const cRow = queue.body.find((h: any) => h.email === "c@x.com");

    expect(queue.body.map((h: any) => h.position)).toEqual([1, 2, 3]);
    expect(aRow.fulfilled).toBe(true);
    expect(bRow.fulfilled).toBe(true);
    expect(cRow.fulfilled).toBe(false);

    const books = await api.get("/api/books").expect(200);
    const current = books.body.find((x: any) => x.id === bookId);
    expect(current.copiesAvailable).toBe(0);
  });
});
