import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 15 - consistency and DoD flow", () => {
  it("Alice frozen, Bob next => return assigns Bob; all frozen => no assignment; unfreeze assigns when copy available", async () => {
    const { api } = await makeTestApp();

    // Start with 0 copies so assignment only happens on return/unfreeze
    const book = await api
      .post("/api/books")
      .send({ title: "DoD Book", copies: 1 })
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
    const charlie = await api
      .post("/api/hold")
      .send({ email: "charlie@x.com", bookId })
      .expect(200);

    // Alice frozen, Bob and Charlie eligible
    await api
      .post("/api/freeze")
      .send({ email: "alice@x.com", holdId: alice.body.holdId })
      .expect(200);

    // Return 1 copy => Bob gets it (Alice skipped)
    const r1 = await api.post("/api/return").send({ bookId }).expect(200);
    expect(r1.body.assignedTo).toBe(bob.body.holdId);

    // Freeze everyone who is not fulfilled (Alice + Charlie)
    await api
      .post("/api/freeze")
      .send({ email: "charlie@x.com", holdId: charlie.body.holdId })
      .expect(200);

    // Return another copy => all remaining are frozen => no assignment
    const r2 = await api.post("/api/return").send({ bookId }).expect(200);
    expect(r2.body.assignedTo).toBe(null);

    // Now Alice unfreezes => copy is still available => Alice gets it immediately
    const un = await api
      .post("/api/unfreeze")
      .send({ email: "alice@x.com", holdId: alice.body.holdId })
      .expect(200);
    expect(un.body.assignedTo).toBe(alice.body.holdId);

    // Verify final queue states
    const queue = await api.get(`/api/queue/${bookId}`).expect(200);

    const aliceRow = queue.body.find((h: any) => h.email === "alice@x.com");
    const bobRow = queue.body.find((h: any) => h.email === "bob@x.com");
    const charlieRow = queue.body.find((h: any) => h.email === "charlie@x.com");

    expect(aliceRow.position).toBe(1);
    expect(bobRow.position).toBe(2);
    expect(charlieRow.position).toBe(3);

    expect(bobRow.fulfilled).toBe(true);
    expect(aliceRow.fulfilled).toBe(true);
    expect(charlieRow.fulfilled).toBe(false);
    expect(charlieRow.frozen).toBe(true);
  });
});
