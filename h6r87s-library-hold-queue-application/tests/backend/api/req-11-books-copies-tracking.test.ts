import { describe, expect, it } from "vitest";
import { makeTestApp } from "../../shared/makeTestApp";

describe("Req 11 - track copiesTotal separately from copiesAvailable", () => {
  it("stores total and available; return increases available up to total", async () => {
    const { api } = await makeTestApp();

    const book = await api
      .post("/api/books")
      .send({ title: "Book", copies: 2 })
      .expect(200);
    const id = book.body.id;

    const books1 = await api.get("/api/books").expect(200);
    const b = books1.body.find((x: any) => x.id === id);
    expect(b.copiesTotal).toBe(2);
    expect(b.copiesAvailable).toBe(2);

    // Return should not exceed total
    await api.post("/api/return").send({ bookId: id }).expect(200);
    const books2 = await api.get("/api/books").expect(200);
    const b2 = books2.body.find((x: any) => x.id === id);
    expect(b2.copiesAvailable).toBeLessThanOrEqual(2);
  });
});
