import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 10 - GET /api/queue/:bookId ordered with flags, no renumber", () => {
  it("returns full queue in stable position order", async () => {
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

    await api
      .post("/api/freeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);
    await api.post("/api/return").send({ bookId }).expect(200); // should assign b

    const queue = await api.get(`/api/queue/${bookId}`).expect(200);
    expect(queue.body.map((h: any) => h.position)).toEqual([1, 2]);
    expect(queue.body[0]).toHaveProperty("frozen");
    expect(queue.body[0]).toHaveProperty("fulfilled");
    expect(queue.body[1].fulfilled).toBe(true);
  });
});
