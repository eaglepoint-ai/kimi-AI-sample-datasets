import { describe, expect, it } from "vitest";
import {
  createBook,
  placeHold,
  getQueue,
  freezeHold,
  returnCopy,
} from "../../../repository_after/backend/src/service";
import type { StoreData } from "../../../repository_after/backend/src/types";

function freshData(): StoreData {
  return {
    counters: { bookId: 1, holdId: 1 },
    books: [],
    holds: [],
  };
}

describe("Unit - invariants", () => {
  it("positions are stable and 1-based; never renumber after actions", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const a = placeHold(data, "a@x.com", book.id);
    const b = placeHold(data, "b@x.com", book.id);
    const c = placeHold(data, "c@x.com", book.id);

    expect(a.position).toBe(1);
    expect(b.position).toBe(2);
    expect(c.position).toBe(3);

    // Freeze + return should not change positions
    freezeHold(data, "a@x.com", a.holdId);
    returnCopy(data, book.id);

    const q = getQueue(data, book.id);
    expect(q.map((h) => h.position)).toEqual([1, 2, 3]);
  });

  it("IDs are incremental integers", () => {
    const data = freshData();
    const b1 = createBook(data, "B1", 1);
    const b2 = createBook(data, "B2", 1);
    expect(b2.id).toBe(b1.id + 1);

    const h1 = placeHold(data, "x@x.com", b1.id);
    const h2 = placeHold(data, "y@x.com", b1.id);
    expect(h2.holdId).toBe(h1.holdId + 1);
  });
});
