import { describe, expect, it } from "vitest";
import {
  createBook,
  placeHold,
  freezeHold,
  unfreezeHold,
  returnCopy,
  getQueue,
} from "../../../repository_after/backend/src/service";
import type { StoreData } from "../../../repository_after/backend/src/types";

function freshData(): StoreData {
  return {
    counters: { bookId: 1, holdId: 1 },
    books: [],
    holds: [],
  };
}

describe("Unit - assignment engine smoke", () => {
  it("frozen is skipped; all frozen => no assignment; unfreeze triggers assignment if copy available", () => {
    const data = freshData();

    const book = createBook(data, "Book", 1);
    // Make available=0 so assignment only happens after return
    book.copiesAvailable = 0;

    const alice = placeHold(data, "alice@x.com", book.id);
    const bob = placeHold(data, "bob@x.com", book.id);
    placeHold(data, "charlie@x.com", book.id);

    freezeHold(data, "alice@x.com", alice.holdId);

    // Return copy => assigns Bob (Alice skipped)
    const r1 = returnCopy(data, book.id);
    expect(r1.assignedTo).toBe(bob.holdId);

    // Freeze remaining non-fulfilled holds (Alice + Charlie)
    const queue1 = getQueue(data, book.id);
    const aliceHold = queue1.find((h) => h.email === "alice@x.com")!;
    const charlieHold = queue1.find((h) => h.email === "charlie@x.com")!;
    freezeHold(data, "charlie@x.com", charlieHold.id);

    // Return another copy => all remaining are frozen => no assignment, copy remains available
    const r2 = returnCopy(data, book.id);
    expect(r2.assignedTo).toBe(null);
    expect(r2.copiesAvailable).toBe(1);

    // Unfreeze Alice => should assign immediately (since copy is available)
    const un = unfreezeHold(data, "alice@x.com", aliceHold.id);
    expect(un.assignedTo).toBe(aliceHold.id);
  });
});
