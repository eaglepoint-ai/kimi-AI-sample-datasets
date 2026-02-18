import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 01 - one active hold per user per book", () => {
  it("rejects duplicate active holds with exact message", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "The Hobbit", copies: 1 })
      .expect(200);
    const bookId = book.body.id;

    await api
      .post("/api/hold")
      .send({ email: "alice@example.com", bookId })
      .expect(200);

    const dup = await api
      .post("/api/hold")
      .send({ email: "alice@example.com", bookId })
      .expect(409);
    expect(dup.body.error).toBe("Already on hold for this book");
  });
});
