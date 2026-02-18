import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 03 - frozen holds are skipped when assigning", () => {
  it("Alice frozen, Bob next => return assigns Bob", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 1 })
      .expect(200);
    const bookId = book.body.id;

    const alice = await api
      .post("/api/hold")
      .send({ email: "alice@x.com", bookId })
      .expect(200);
    const bob = await api
      .post("/api/hold")
      .send({ email: "bob@x.com", bookId })
      .expect(200);
    await api
      .post("/api/hold")
      .send({ email: "charlie@x.com", bookId })
      .expect(200);

    await api
      .post("/api/freeze")
      .send({ email: "alice@x.com", holdId: alice.body.holdId })
      .expect(200);

    const ret = await api.post("/api/return").send({ bookId }).expect(200);
    expect(ret.body.assignedTo).toBe(bob.body.holdId);

    const queue = await api.get(`/api/queue/${bookId}`).expect(200);
    const bobRow = queue.body.find((h: any) => h.email === "bob@x.com");
    expect(bobRow.fulfilled).toBe(true);
  });
});
