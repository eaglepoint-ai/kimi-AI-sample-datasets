import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 02 - positions are 1-based and stable", () => {
  it("assigns positions starting at 1 and never renumbers", async () => {
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
    const c = await api
      .post("/api/hold")
      .send({ email: "c@x.com", bookId })
      .expect(200);

    expect(a.body.position).toBe(1);
    expect(b.body.position).toBe(2);
    expect(c.body.position).toBe(3);

    // Freeze/unfreeze should not change positions
    await api
      .post("/api/freeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);
    await api
      .post("/api/unfreeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);

    const queue = await api.get(`/api/queue/${bookId}`).expect(200);
    const positions = queue.body.map((h: any) => h.position);
    expect(positions).toEqual([1, 2, 3]);
  });
});
