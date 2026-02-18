import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 06 - return increments available copies and assigns safely", () => {
  it("increments available and assigns to only one hold per return", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 1 })
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

    const r1 = await api.post("/api/return").send({ bookId }).expect(200);
    expect(r1.body.assignedTo).toBe(a.body.holdId);

    const r2 = await api.post("/api/return").send({ bookId }).expect(200);
    expect(r2.body.assignedTo).toBe(b.body.holdId);

    const queue = await api.get(`/api/queue/${bookId}`).expect(200);
    expect(queue.body.find((h: any) => h.id === a.body.holdId).fulfilled).toBe(
      true,
    );
    expect(queue.body.find((h: any) => h.id === b.body.holdId).fulfilled).toBe(
      true,
    );
  });
});
