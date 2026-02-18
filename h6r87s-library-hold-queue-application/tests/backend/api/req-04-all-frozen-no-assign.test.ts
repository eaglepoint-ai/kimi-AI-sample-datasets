import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 04 - if all holds frozen, copies remain available", () => {
  it("return does not assign if everyone frozen; unfreeze triggers later assignment", async () => {
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
      .post("/api/freeze")
      .send({ email: "alice@x.com", holdId: alice.body.holdId })
      .expect(200);
    await api
      .post("/api/freeze")
      .send({ email: "bob@x.com", holdId: bob.body.holdId })
      .expect(200);

    const ret = await api.post("/api/return").send({ bookId }).expect(200);
    expect(ret.body.assignedTo).toBe(null);

    // Now unfreeze Alice; should assign because copy is still available
    const un = await api
      .post("/api/unfreeze")
      .send({ email: "alice@x.com", holdId: alice.body.holdId })
      .expect(200);
    expect(un.body.assignedTo).toBe(alice.body.holdId);
  });
});
