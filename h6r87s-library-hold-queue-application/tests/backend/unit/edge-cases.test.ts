import { describe, expect, it } from "vitest";
import {
  createBook,
  placeHold,
  freezeHold,
  unfreezeHold,
  returnCopy,
  getQueue,
  getHoldsForEmail,
  listBooks,
} from "../../../repository_after/backend/src/service";
import type { StoreData } from "../../../repository_after/backend/src/types";

function freshData(): StoreData {
  return {
    counters: { bookId: 1, holdId: 1 },
    books: [],
    holds: [],
  };
}

// ---------------------------------------------------------------------------
// createBook validation
// ---------------------------------------------------------------------------
describe("createBook - input validation", () => {
  it("rejects empty title", () => {
    const data = freshData();
    expect(() => createBook(data, "", 1)).toThrow(/Title is required/i);
  });

  it("rejects whitespace-only title", () => {
    const data = freshData();
    expect(() => createBook(data, "   ", 1)).toThrow(/Title is required/i);
  });

  it("rejects zero copies", () => {
    const data = freshData();
    expect(() => createBook(data, "Book", 0)).toThrow(/positive integer/i);
  });

  it("rejects negative copies", () => {
    const data = freshData();
    expect(() => createBook(data, "Book", -3)).toThrow(/positive integer/i);
  });

  it("rejects fractional copies", () => {
    const data = freshData();
    expect(() => createBook(data, "Book", 1.5)).toThrow(/positive integer/i);
  });

  it("rejects non-numeric copies", () => {
    const data = freshData();
    expect(() => createBook(data, "Book", "abc")).toThrow(/positive integer/i);
  });

  it("rejects null / undefined title", () => {
    const data = freshData();
    expect(() => createBook(data, null, 1)).toThrow(/Title is required/i);
    expect(() => createBook(data, undefined, 1)).toThrow(/Title is required/i);
  });

  it("stores copiesTotal and copiesAvailable equal on creation", () => {
    const data = freshData();
    const book = createBook(data, "Book", 3);
    expect(book.copiesTotal).toBe(3);
    expect(book.copiesAvailable).toBe(3);
  });

  it("assigns incremental integer ids starting at the counter value", () => {
    const data = freshData();
    const b1 = createBook(data, "A", 1);
    const b2 = createBook(data, "B", 1);
    const b3 = createBook(data, "C", 1);
    expect(b1.id).toBe(1);
    expect(b2.id).toBe(2);
    expect(b3.id).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// placeHold - email validation (Req 8)
// ---------------------------------------------------------------------------
describe("placeHold - email validation", () => {
  it("rejects email without @", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    expect(() => placeHold(data, "aliceexample.com", book.id)).toThrow(
      /Invalid email/i,
    );
  });

  it("rejects email without dot", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    expect(() => placeHold(data, "alice@com", book.id)).toThrow(
      /Invalid email/i,
    );
  });

  it("rejects empty string email", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    expect(() => placeHold(data, "", book.id)).toThrow(/Invalid email/i);
  });

  it("rejects numeric email", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    expect(() => placeHold(data, 12345, book.id)).toThrow(/Invalid email/i);
  });

  it("rejects null / undefined email", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    expect(() => placeHold(data, null, book.id)).toThrow(/Invalid email/i);
    expect(() => placeHold(data, undefined, book.id)).toThrow(/Invalid email/i);
  });

  it("accepts minimal valid email (has @ and .)", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    const result = placeHold(data, "a@b.c", book.id);
    expect(result.holdId).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// placeHold - bookId validation
// ---------------------------------------------------------------------------
describe("placeHold - bookId validation", () => {
  it("rejects non-existent bookId", () => {
    const data = freshData();
    createBook(data, "Book", 1);
    expect(() => placeHold(data, "a@x.com", 999)).toThrow(/Book not found/i);
  });

  it("rejects NaN bookId", () => {
    const data = freshData();
    createBook(data, "Book", 1);
    expect(() => placeHold(data, "a@x.com", "abc")).toThrow(/Invalid bookId/i);
  });

  it("rejects undefined bookId", () => {
    const data = freshData();
    createBook(data, "Book", 1);
    expect(() => placeHold(data, "a@x.com", undefined)).toThrow(
      /Invalid bookId/i,
    );
  });
});

// ---------------------------------------------------------------------------
// placeHold - duplicate prevention (Req 1)
// ---------------------------------------------------------------------------
describe("placeHold - duplicate prevention", () => {
  it("rejects duplicate active hold with exact error message", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    placeHold(data, "a@x.com", book.id);
    expect(() => placeHold(data, "a@x.com", book.id)).toThrow(
      /Already on hold for this book/i,
    );
  });

  it("allows same user to hold different books", () => {
    const data = freshData();
    const b1 = createBook(data, "Book1", 1);
    const b2 = createBook(data, "Book2", 1);
    const h1 = placeHold(data, "a@x.com", b1.id);
    const h2 = placeHold(data, "a@x.com", b2.id);
    expect(h1.holdId).not.toBe(h2.holdId);
  });

  it("allows different users to hold same book", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    const h1 = placeHold(data, "a@x.com", book.id);
    const h2 = placeHold(data, "b@x.com", book.id);
    expect(h1.holdId).not.toBe(h2.holdId);
    expect(h1.position).toBe(1);
    expect(h2.position).toBe(2);
  });

  it("allows re-hold after previous hold was fulfilled", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0; // prevent auto-assign

    placeHold(data, "a@x.com", book.id);
    // manually fulfill
    data.holds[0].fulfilled = true;

    // should now be allowed because the active hold is fulfilled
    const h2 = placeHold(data, "a@x.com", book.id);
    expect(h2.position).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// placeHold - positions (Req 2)
// ---------------------------------------------------------------------------
describe("placeHold - 1-based stable positions", () => {
  it("assigns positions 1, 2, 3 in order", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    expect(placeHold(data, "a@x.com", book.id).position).toBe(1);
    expect(placeHold(data, "b@x.com", book.id).position).toBe(2);
    expect(placeHold(data, "c@x.com", book.id).position).toBe(3);
  });

  it("positions are scoped per book - both start at 1", () => {
    const data = freshData();
    const b1 = createBook(data, "A", 1);
    const b2 = createBook(data, "B", 1);
    b1.copiesAvailable = 0;
    b2.copiesAvailable = 0;

    expect(placeHold(data, "a@x.com", b1.id).position).toBe(1);
    expect(placeHold(data, "b@x.com", b1.id).position).toBe(2);

    expect(placeHold(data, "a@x.com", b2.id).position).toBe(1);
  });

  it("hold ids are globally unique across books", () => {
    const data = freshData();
    const b1 = createBook(data, "A", 1);
    const b2 = createBook(data, "B", 1);
    b1.copiesAvailable = 0;
    b2.copiesAvailable = 0;

    const h1 = placeHold(data, "a@x.com", b1.id);
    const h2 = placeHold(data, "a@x.com", b2.id);
    expect(h2.holdId).toBe(h1.holdId + 1);
  });
});

// ---------------------------------------------------------------------------
// freezeHold / unfreezeHold - ownership and flags (Req 7)
// ---------------------------------------------------------------------------
describe("freeze / unfreeze - ownership and flags", () => {
  it("freeze with wrong email throws 403", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    const h = placeHold(data, "a@x.com", book.id);
    expect(() => freezeHold(data, "b@x.com", h.holdId)).toThrow(
      /Email does not match/i,
    );
  });

  it("unfreeze with wrong email throws 403", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    const h = placeHold(data, "a@x.com", book.id);
    freezeHold(data, "a@x.com", h.holdId);
    expect(() => unfreezeHold(data, "b@x.com", h.holdId)).toThrow(
      /Email does not match/i,
    );
  });

  it("freeze on non-existent holdId throws 404", () => {
    const data = freshData();
    createBook(data, "Book", 1);
    expect(() => freezeHold(data, "a@x.com", 999)).toThrow(/Hold not found/i);
  });

  it("unfreeze on non-existent holdId throws 404", () => {
    const data = freshData();
    createBook(data, "Book", 1);
    expect(() => unfreezeHold(data, "a@x.com", 999)).toThrow(
      /Hold not found/i,
    );
  });

  it("freeze with invalid email throws 400", () => {
    const data = freshData();
    expect(() => freezeHold(data, "notanemail", 1)).toThrow(/Invalid email/i);
  });

  it("unfreeze with invalid email throws 400", () => {
    const data = freshData();
    expect(() => unfreezeHold(data, "notanemail", 1)).toThrow(
      /Invalid email/i,
    );
  });

  it("freeze sets frozen=true without touching position or fulfilled", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    const h = placeHold(data, "a@x.com", book.id);

    const hold = freezeHold(data, "a@x.com", h.holdId);
    expect(hold.frozen).toBe(true);
    expect(hold.fulfilled).toBe(false);
    expect(hold.position).toBe(1);
  });

  it("unfreeze sets frozen=false without touching position", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    const h = placeHold(data, "a@x.com", book.id);
    freezeHold(data, "a@x.com", h.holdId);

    const result = unfreezeHold(data, "a@x.com", h.holdId);
    expect(result.hold.frozen).toBe(false);
    expect(result.hold.position).toBe(1);
  });

  it("freezing does not affect other holds in the same queue", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    const hA = placeHold(data, "a@x.com", book.id);
    const hB = placeHold(data, "b@x.com", book.id);

    freezeHold(data, "a@x.com", hA.holdId);

    const queue = getQueue(data, book.id);
    const holdB = queue.find((h) => h.id === hB.holdId)!;
    expect(holdB.frozen).toBe(false);
    expect(holdB.position).toBe(2);
    expect(holdB.fulfilled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// returnCopy - mechanics (Req 6)
// ---------------------------------------------------------------------------
describe("returnCopy - increment and assignment", () => {
  it("return on non-existent bookId throws 404", () => {
    const data = freshData();
    expect(() => returnCopy(data, 999)).toThrow(/Book not found/i);
  });

  it("return on invalid bookId throws 400", () => {
    const data = freshData();
    expect(() => returnCopy(data, "abc")).toThrow(/Invalid bookId/i);
  });

  it("return never pushes copiesAvailable above copiesTotal", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    // available already == total == 1
    returnCopy(data, book.id);
    returnCopy(data, book.id);
    returnCopy(data, book.id);
    expect(book.copiesAvailable).toBeLessThanOrEqual(book.copiesTotal);
    expect(book.copiesAvailable).toBe(1);
  });

  it("return with no holds just increments available", () => {
    const data = freshData();
    const book = createBook(data, "Book", 2);
    book.copiesAvailable = 0; // both checked out, no holds

    const r = returnCopy(data, book.id);
    expect(r.copiesAvailable).toBe(1);
    expect(r.assignedTo).toBe(null);
  });

  it("return assigns to the first non-frozen non-fulfilled hold by position", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id); // pos 1
    placeHold(data, "b@x.com", book.id); // pos 2

    freezeHold(data, "a@x.com", hA.holdId);

    const r = returnCopy(data, book.id);
    // A is frozen, so B at position 2 should be assigned
    expect(r.assignedTo).not.toBe(hA.holdId);
    const queue = getQueue(data, book.id);
    const holdB = queue.find((h) => h.position === 2)!;
    expect(holdB.fulfilled).toBe(true);
  });

  it("return does not assign to already-fulfilled holds", () => {
    const data = freshData();
    const book = createBook(data, "Book", 2);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id); // pos 1
    const hB = placeHold(data, "b@x.com", book.id); // pos 2

    // return twice -> A then B
    const r1 = returnCopy(data, book.id);
    expect(r1.assignedTo).toBe(hA.holdId);

    const r2 = returnCopy(data, book.id);
    expect(r2.assignedTo).toBe(hB.holdId);

    // third return -> nobody left
    const r3 = returnCopy(data, book.id);
    expect(r3.assignedTo).toBe(null);
  });

  it("copiesAvailable decrements after assignment", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;
    placeHold(data, "a@x.com", book.id);

    returnCopy(data, book.id); // available 0→1, assign → 0
    expect(book.copiesAvailable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Assignment engine - frozen skipping (Req 3, 4)
// ---------------------------------------------------------------------------
describe("Assignment engine - frozen / all-frozen", () => {
  it("frozen hold is skipped: Alice(1) frozen, Bob(2) gets it", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    const hB = placeHold(data, "b@x.com", book.id);

    freezeHold(data, "a@x.com", hA.holdId);
    const r = returnCopy(data, book.id);
    expect(r.assignedTo).toBe(hB.holdId);

    const queue = getQueue(data, book.id);
    expect(queue.find((h) => h.id === hA.holdId)!.fulfilled).toBe(false);
    expect(queue.find((h) => h.id === hA.holdId)!.frozen).toBe(true);
    expect(queue.find((h) => h.id === hB.holdId)!.fulfilled).toBe(true);
  });

  it("all frozen -> copy stays available, no assignment", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    const hB = placeHold(data, "b@x.com", book.id);

    freezeHold(data, "a@x.com", hA.holdId);
    freezeHold(data, "b@x.com", hB.holdId);

    const r = returnCopy(data, book.id);
    expect(r.assignedTo).toBe(null);
    expect(r.copiesAvailable).toBe(1); // copy kept available
  });

  it("frozen hold retains its position after others are assigned", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id); // pos 1
    placeHold(data, "b@x.com", book.id); // pos 2
    placeHold(data, "c@x.com", book.id); // pos 3

    freezeHold(data, "a@x.com", hA.holdId);
    returnCopy(data, book.id); // assign B

    const queue = getQueue(data, book.id);
    expect(queue.map((h) => h.position)).toEqual([1, 2, 3]);
    expect(queue[0].email).toBe("a@x.com");
    expect(queue[0].frozen).toBe(true);
    expect(queue[0].position).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Unfreeze triggers assignment (Req 5)
// ---------------------------------------------------------------------------
describe("Unfreeze - triggers assignment when copy available", () => {
  it("unfreezing assigns immediately when copies are available", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    freezeHold(data, "a@x.com", hA.holdId);

    // return while frozen -> copy stays available
    returnCopy(data, book.id);
    expect(book.copiesAvailable).toBe(1);

    // unfreeze -> immediate assignment
    const result = unfreezeHold(data, "a@x.com", hA.holdId);
    expect(result.assignedTo).toBe(hA.holdId);
    expect(book.copiesAvailable).toBe(0);
  });

  it("unfreeze does NOT assign when no copies available", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    freezeHold(data, "a@x.com", hA.holdId);

    // don't return any copy, just unfreeze
    const result = unfreezeHold(data, "a@x.com", hA.holdId);
    expect(result.assignedTo).toBe(null);
    expect(result.hold.fulfilled).toBe(false);
  });

  it("unfreeze assigns to the first eligible by position, not the unfrozen one", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id); // pos 1
    const hB = placeHold(data, "b@x.com", book.id); // pos 2

    // freeze both
    freezeHold(data, "a@x.com", hA.holdId);
    freezeHold(data, "b@x.com", hB.holdId);

    // return copy -> stays available (all frozen)
    returnCopy(data, book.id);

    // unfreeze B (pos 2) while A (pos 1) is still frozen
    const result = unfreezeHold(data, "b@x.com", hB.holdId);
    // B is now the first non-frozen non-fulfilled -> B gets it
    expect(result.assignedTo).toBe(hB.holdId);
  });

  it("sequential unfreezes respect position order with multiple copies", () => {
    const data = freshData();
    const book = createBook(data, "Book", 2);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id); // pos 1
    const hB = placeHold(data, "b@x.com", book.id); // pos 2

    freezeHold(data, "a@x.com", hA.holdId);
    freezeHold(data, "b@x.com", hB.holdId);

    // return 2 copies -> both stay available
    returnCopy(data, book.id);
    returnCopy(data, book.id);
    expect(book.copiesAvailable).toBe(2);

    // unfreeze A (pos 1) -> A gets assigned
    const r1 = unfreezeHold(data, "a@x.com", hA.holdId);
    expect(r1.assignedTo).toBe(hA.holdId);

    // unfreeze B (pos 2) -> B gets assigned
    const r2 = unfreezeHold(data, "b@x.com", hB.holdId);
    expect(r2.assignedTo).toBe(hB.holdId);

    expect(book.copiesAvailable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Full DoD scenario (Req 15)
// ---------------------------------------------------------------------------
describe("Full DoD scenario", () => {
  it("Alice(1) frozen, Bob(2), Charlie(3) -> return -> Bob gets it", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "alice@x.com", book.id);
    const hB = placeHold(data, "bob@x.com", book.id);
    const hC = placeHold(data, "charlie@x.com", book.id);

    freezeHold(data, "alice@x.com", hA.holdId);

    const r1 = returnCopy(data, book.id);
    expect(r1.assignedTo).toBe(hB.holdId);

    const queue = getQueue(data, book.id);
    expect(queue.find((h) => h.email === "bob@x.com")!.fulfilled).toBe(true);
    expect(queue.find((h) => h.email === "alice@x.com")!.fulfilled).toBe(
      false,
    );
    expect(queue.find((h) => h.email === "charlie@x.com")!.fulfilled).toBe(
      false,
    );
  });

  it("all frozen -> return -> nobody; unfreeze Alice -> Alice gets it", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "alice@x.com", book.id);
    const hB = placeHold(data, "bob@x.com", book.id);

    freezeHold(data, "alice@x.com", hA.holdId);
    freezeHold(data, "bob@x.com", hB.holdId);

    const r1 = returnCopy(data, book.id);
    expect(r1.assignedTo).toBe(null);
    expect(r1.copiesAvailable).toBe(1);

    const un = unfreezeHold(data, "alice@x.com", hA.holdId);
    expect(un.assignedTo).toBe(hA.holdId);
    expect(book.copiesAvailable).toBe(0);
  });

  it("fulfilled user trying to hold same book again is rejected", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);

    const hA = placeHold(data, "alice@x.com", book.id);
    // The hold is unfulfilled -> duplicate is blocked
    expect(() => placeHold(data, "alice@x.com", book.id)).toThrow(
      /Already on hold/i,
    );

    // Mark fulfilled and try again -> should succeed
    data.holds.find((h) => h.id === hA.holdId)!.fulfilled = true;
    const h2 = placeHold(data, "alice@x.com", book.id);
    expect(h2.holdId).toBeGreaterThan(hA.holdId);
  });
});

// ---------------------------------------------------------------------------
// getQueue / getHoldsForEmail (Req 9, 10)
// ---------------------------------------------------------------------------
describe("getQueue / getHoldsForEmail", () => {
  it("getQueue throws for non-existent bookId", () => {
    const data = freshData();
    expect(() => getQueue(data, 999)).toThrow(/Book not found/i);
  });

  it("getQueue returns holds sorted by position", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    placeHold(data, "c@x.com", book.id); // pos 1
    placeHold(data, "a@x.com", book.id); // pos 2
    placeHold(data, "b@x.com", book.id); // pos 3

    const queue = getQueue(data, book.id);
    expect(queue.map((h) => h.position)).toEqual([1, 2, 3]);
    expect(queue[0].email).toBe("c@x.com");
    expect(queue[2].email).toBe("b@x.com");
  });

  it("getQueue includes frozen and fulfilled flags", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    placeHold(data, "b@x.com", book.id);

    freezeHold(data, "a@x.com", hA.holdId);
    returnCopy(data, book.id); // assigns B

    const queue = getQueue(data, book.id);
    expect(queue[0].frozen).toBe(true);
    expect(queue[0].fulfilled).toBe(false);
    expect(queue[1].frozen).toBe(false);
    expect(queue[1].fulfilled).toBe(true);
  });

  it("getQueue returns empty array for book with no holds", () => {
    const data = freshData();
    const book = createBook(data, "Book", 1);
    const queue = getQueue(data, book.id);
    expect(queue).toEqual([]);
  });

  it("getHoldsForEmail returns all holds across books for a user", () => {
    const data = freshData();
    const b1 = createBook(data, "A", 1);
    const b2 = createBook(data, "B", 1);
    b1.copiesAvailable = 0;
    b2.copiesAvailable = 0;

    placeHold(data, "a@x.com", b1.id);
    placeHold(data, "a@x.com", b2.id);
    placeHold(data, "other@x.com", b1.id);

    const holds = getHoldsForEmail(data, "a@x.com");
    expect(holds.length).toBe(2);
    expect(holds.every((h) => h.email === "a@x.com")).toBe(true);
  });

  it("getHoldsForEmail returns empty for unknown user", () => {
    const data = freshData();
    createBook(data, "A", 1);
    const holds = getHoldsForEmail(data, "nobody@x.com");
    expect(holds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listBooks
// ---------------------------------------------------------------------------
describe("listBooks", () => {
  it("returns books sorted by id", () => {
    const data = freshData();
    createBook(data, "Zebra", 1);
    createBook(data, "Apple", 1);
    createBook(data, "Mango", 1);

    const books = listBooks(data);
    expect(books.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("returns empty array when no books exist", () => {
    const data = freshData();
    expect(listBooks(data)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Multi-copy scenarios
// ---------------------------------------------------------------------------
describe("Multi-copy assignment", () => {
  it("2-copy book with 3 holds: return assigns first 2, third waits", () => {
    const data = freshData();
    const book = createBook(data, "Book", 2);
    book.copiesAvailable = 0;

    const hA = placeHold(data, "a@x.com", book.id);
    const hB = placeHold(data, "b@x.com", book.id);
    const hC = placeHold(data, "c@x.com", book.id);

    // return first copy -> A
    const r1 = returnCopy(data, book.id);
    expect(r1.assignedTo).toBe(hA.holdId);

    // return second copy -> B
    const r2 = returnCopy(data, book.id);
    expect(r2.assignedTo).toBe(hB.holdId);

    // C still unfulfilled
    const queue = getQueue(data, book.id);
    expect(queue.find((h) => h.id === hC.holdId)!.fulfilled).toBe(false);
  });

  it("copiesAvailable is never negative even after many assignments", () => {
    const data = freshData();
    const book = createBook(data, "Book", 3);
    book.copiesAvailable = 0;

    for (let i = 0; i < 5; i++) {
      placeHold(data, `u${i}@x.com`, book.id);
    }

    // return 5 times, but only 3 copies exist
    for (let i = 0; i < 5; i++) {
      returnCopy(data, book.id);
    }

    expect(book.copiesAvailable).toBeGreaterThanOrEqual(0);
    expect(book.copiesAvailable).toBeLessThanOrEqual(book.copiesTotal);
  });
});

// ---------------------------------------------------------------------------
// Data isolation - mutations don't leak across books
// ---------------------------------------------------------------------------
describe("Data isolation between books", () => {
  it("freezing a hold on book A does not affect book B queue", () => {
    const data = freshData();
    const bA = createBook(data, "A", 1);
    const bB = createBook(data, "B", 1);
    bA.copiesAvailable = 0;
    bB.copiesAvailable = 0;

    const hA = placeHold(data, "user@x.com", bA.id);
    const hB = placeHold(data, "user@x.com", bB.id);

    freezeHold(data, "user@x.com", hA.holdId);

    const queueB = getQueue(data, bB.id);
    expect(queueB[0].frozen).toBe(false);
    expect(queueB[0].id).toBe(hB.holdId);
  });

  it("returning a copy on book A does not assign holds from book B", () => {
    const data = freshData();
    const bA = createBook(data, "A", 1);
    const bB = createBook(data, "B", 1);
    bA.copiesAvailable = 0;
    bB.copiesAvailable = 0;

    placeHold(data, "a@x.com", bA.id);
    const hB = placeHold(data, "b@x.com", bB.id);

    returnCopy(data, bA.id);

    const queueB = getQueue(data, bB.id);
    expect(queueB.find((h) => h.id === hB.holdId)!.fulfilled).toBe(false);
  });
});
