import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 07 - freeze/unfreeze only updates frozen flag", () => {
  it("does not change positions or other holds", async () => {
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

    const before = await api.get(`/api/queue/${bookId}`).expect(200);

    await api
      .post("/api/freeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);

    const afterFreeze = await api.get(`/api/queue/${bookId}`).expect(200);
    expect(
      afterFreeze.body.find((h: any) => h.id === a.body.holdId).frozen,
    ).toBe(true);
    expect(
      afterFreeze.body.find((h: any) => h.id === b.body.holdId).position,
    ).toBe(2);
    expect(
      afterFreeze.body.find((h: any) => h.id === b.body.holdId).frozen,
    ).toBe(before.body.find((h: any) => h.id === b.body.holdId).frozen);

    await api
      .post("/api/unfreeze")
      .send({ email: "a@x.com", holdId: a.body.holdId })
      .expect(200);

    const afterUnfreeze = await api.get(`/api/queue/${bookId}`).expect(200);
    expect(
      afterUnfreeze.body.find((h: any) => h.id === a.body.holdId).frozen,
    ).toBe(false);
    expect(afterUnfreeze.body.map((h: any) => h.position)).toEqual([1, 2]);
  });
});
