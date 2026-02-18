import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 08 - email validation includes @ and dot", () => {
  it("rejects invalid email on hold creation", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 1 })
      .expect(200);
    const bookId = book.body.id;

    const r1 = await api
      .post("/api/hold")
      .send({ email: "aliceexample.com", bookId })
      .expect(400);
    expect(r1.body.error).toMatch(/Invalid email/i);

    const r2 = await api
      .post("/api/hold")
      .send({ email: "alice@com", bookId })
      .expect(400);
    expect(r2.body.error).toMatch(/Invalid email/i);
  });
});
