import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 12 - IDs are incremental integers only", () => {
  it("book IDs and hold IDs are incremental numbers", async () => {
    const { api } = await makeTestApp();

    const b1 = await api
      .post("/api/books")
      .send({ title: "B1", copies: 1 })
      .expect(200);
    const b2 = await api
      .post("/api/books")
      .send({ title: "B2", copies: 1 })
      .expect(200);

    expect(b2.body.id).toBe(b1.body.id + 1);

    const h1 = await api
      .post("/api/hold")
      .send({ email: "a@x.com", bookId: b1.body.id })
      .expect(200);
    const h2 = await api
      .post("/api/hold")
      .send({ email: "b@x.com", bookId: b1.body.id })
      .expect(200);

    expect(typeof h1.body.holdId).toBe("number");
    expect(h2.body.holdId).toBe(h1.body.holdId + 1);
  });
});
