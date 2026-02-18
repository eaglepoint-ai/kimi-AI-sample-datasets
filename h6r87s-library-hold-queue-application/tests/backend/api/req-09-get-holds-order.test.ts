import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 09 - GET /api/holds/:email includes flags and correct order", () => {
  it("returns holds with position/frozen/fulfilled and ordered by positions per book", async () => {
    const { api } = await makeTestApp();

    const b1 = await api
      .post("/api/books")
      .send({ title: "B1", copies: 1 })
      .expect(200);
    const b2 = await api
      .post("/api/books")
      .send({ title: "B2", copies: 1 })
      .expect(200);

    const bobB1 = await api
      .post("/api/hold")
      .send({ email: "bob@x.com", bookId: b1.body.id })
      .expect(200); // b1 pos1
    const aliceB1 = await api
      .post("/api/hold")
      .send({ email: "alice@x.com", bookId: b1.body.id })
      .expect(200); // b1 pos2
    const aliceB2 = await api
      .post("/api/hold")
      .send({ email: "alice@x.com", bookId: b2.body.id })
      .expect(200); // b2 pos1

    await api
      .post("/api/freeze")
      .send({ email: "alice@x.com", holdId: aliceB1.body.holdId })
      .expect(200);

    // Return on b1 should assign bob (pos1), keep alice unfulfilled/frozen at pos2.
    const ret = await api
      .post("/api/return")
      .send({ bookId: b1.body.id })
      .expect(200);
    expect(ret.body.assignedTo).toBe(bobB1.body.holdId);
    const h3 = await api
      .post("/api/hold")
      .send({ email: "alice@x.com", bookId: b1.body.id })
      .expect(409); // duplicate active should block

    expect(h3.body.error).toBe("Already on hold for this book");

    const holds = await api
      .get(`/api/holds/${encodeURIComponent("alice@x.com")}`)
      .expect(200);

    expect(holds.body).toHaveLength(2);

    // Raw response order assertion (no test-side sorting).
    expect(holds.body[0].bookId).toBe(b1.body.id);
    expect(holds.body[0].position).toBe(2);
    expect(holds.body[0].frozen).toBe(true);
    expect(holds.body[0].fulfilled).toBe(false);

    expect(holds.body[1].bookId).toBe(b2.body.id);
    expect(holds.body[1].position).toBe(1);
    expect(holds.body[1].frozen).toBe(false);
    expect(holds.body[1].fulfilled).toBe(false);

    const queueB1 = await api.get(`/api/queue/${b1.body.id}`).expect(200);
    const queueB2 = await api.get(`/api/queue/${b2.body.id}`).expect(200);

    const aliceB1InQueue = queueB1.body.find(
      (h: any) => h.id === aliceB1.body.holdId,
    );
    const aliceB2InQueue = queueB2.body.find(
      (h: any) => h.id === aliceB2.body.holdId,
    );

    expect(aliceB1InQueue.position).toBe(holds.body[0].position);
    expect(aliceB1InQueue.frozen).toBe(holds.body[0].frozen);
    expect(aliceB1InQueue.fulfilled).toBe(holds.body[0].fulfilled);

    expect(aliceB2InQueue.position).toBe(holds.body[1].position);
    expect(aliceB2InQueue.frozen).toBe(holds.body[1].frozen);
    expect(aliceB2InQueue.fulfilled).toBe(holds.body[1].fulfilled);

    expect(queueB1.body.map((h: any) => h.position)).toEqual([1, 2]);
    expect(queueB2.body.map((h: any) => h.position)).toEqual([1]);

    for (const h of holds.body) {
      expect(typeof h.position).toBe("number");
      expect(typeof h.frozen).toBe("boolean");
      expect(typeof h.fulfilled).toBe("boolean");
    }
  });
});
