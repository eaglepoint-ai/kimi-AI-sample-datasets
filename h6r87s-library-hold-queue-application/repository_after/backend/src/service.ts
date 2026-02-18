import { AssignmentResult, Book, Hold, StoreData } from "./types";
import { isValidEmailSimple } from "./utils";

function assignNextEligible(data: StoreData, bookId: number): AssignmentResult {
  const book = data.books.find((b) => b.id === bookId);
  if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

  if (book.copiesAvailable <= 0) {
    return { assignedHoldIds: [] };
  }

  const queue = data.holds
    .filter((h) => h.bookId === bookId)
    .sort((a, b) => a.position - b.position);

  const eligible = queue.find((h) => !h.fulfilled && !h.frozen);
  if (!eligible) {
    return { assignedHoldIds: [] };
  }

  eligible.fulfilled = true;
  book.copiesAvailable -= 1;
  return { assignedHoldIds: [eligible.id] };
}

function nextPositionForBook(data: StoreData, bookId: number): number {
  const maxPos = data.holds
    .filter((h) => h.bookId === bookId)
    .reduce((m, h) => Math.max(m, h.position), 0);
  return maxPos + 1; // 1-based stable positions (Req #2)
}

export function listBooks(data: StoreData): Book[] {
  return data.books.slice().sort((a, b) => a.id - b.id);
}

export function createBook(
  data: StoreData,
  title: unknown,
  copies: unknown,
): Book {
  const t = typeof title === "string" ? title.trim() : "";
  const c = typeof copies === "number" ? copies : Number(copies);

  if (!t) throw Object.assign(new Error("Title is required"), { status: 400 });
  if (!Number.isInteger(c) || c <= 0)
    throw Object.assign(new Error("Copies must be a positive integer"), {
      status: 400,
    });

  const book: Book = {
    id: data.counters.bookId++,
    title: t,
    copiesTotal: c,
    copiesAvailable: c, // track separately (Req #11)
  };

  data.books.push(book);
  return book;
}
export function placeHold(
  data: StoreData,
  email: unknown,
  bookId: unknown,
): { position: number; holdId: number } {
  if (!isValidEmailSimple(email))
    throw Object.assign(new Error("Invalid email"), { status: 400 });

  const bid = Number(bookId);
  if (!Number.isInteger(bid))
    throw Object.assign(new Error("Invalid bookId"), { status: 400 });

  const book = data.books.find((b) => b.id === bid);
  if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

  // Duplicate check (active = unfulfilled)
  const alreadyActive = data.holds.some(
    (h) => h.bookId === bid && h.email === email && !h.fulfilled,
  );
  if (alreadyActive) {
    throw Object.assign(new Error("Already on hold for this book"), {
      status: 409,
    });
  }

  const hold: Hold = {
    id: data.counters.holdId++,
    bookId: bid,
    email,
    position: nextPositionForBook(data, bid),
    frozen: false,
    fulfilled: false,
  };

  data.holds.push(hold);

  return { position: hold.position, holdId: hold.id };
}

export function getQueue(data: StoreData, bookId: number): Hold[] {
  const book = data.books.find((b) => b.id === bookId);
  if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

  return data.holds
    .filter((h) => h.bookId === bookId)
    .slice()
    .sort((a, b) => a.position - b.position);
}

export function getHoldsForEmail(data: StoreData, email: string): Hold[] {
  return data.holds
    .filter((h) => h.email === email)
    .slice()
    .sort((a, b) => a.bookId - b.bookId || a.position - b.position);
}

function findHoldOwned(data: StoreData, email: string, holdId: number): Hold {
  const hold = data.holds.find((h) => h.id === holdId);
  if (!hold) throw Object.assign(new Error("Hold not found"), { status: 404 });
  if (hold.email !== email)
    throw Object.assign(new Error("Email does not match hold"), {
      status: 403,
    });
  return hold;
}

export function freezeHold(
  data: StoreData,
  email: unknown,
  holdId: unknown,
): Hold {
  if (!isValidEmailSimple(email))
    throw Object.assign(new Error("Invalid email"), { status: 400 });
  const hid = Number(holdId);
  if (!Number.isInteger(hid))
    throw Object.assign(new Error("Invalid holdId"), { status: 400 });

  const hold = findHoldOwned(data, email, hid);
  if (hold.fulfilled) {
    throw Object.assign(new Error("Cannot freeze a fulfilled hold"), {
      status: 409,
    });
  }

  // Req #7: update only frozen flag
  hold.frozen = true;
  return hold;
}

export function unfreezeHold(
  data: StoreData,
  email: unknown,
  holdId: unknown,
): {
  hold: Hold;
  assignedTo: number | null;
  assignedEmail: string | null;
  assignedPosition: number | null;
  assignedHoldIds: number[];
} {
  if (!isValidEmailSimple(email))
    throw Object.assign(new Error("Invalid email"), { status: 400 });
  const hid = Number(holdId);
  if (!Number.isInteger(hid))
    throw Object.assign(new Error("Invalid holdId"), { status: 400 });

  const hold = findHoldOwned(data, email, hid);
  if (hold.fulfilled) {
    throw Object.assign(new Error("Cannot unfreeze a fulfilled hold"), {
      status: 409,
    });
  }

  hold.frozen = false;
  const { assignedHoldIds } = assignNextEligible(data, hold.bookId);
  const assignedTo = assignedHoldIds.length ? assignedHoldIds[0] : null;
  const assignedHold =
    assignedTo != null ? data.holds.find((h) => h.id === assignedTo) : null;
  return {
    hold,
    assignedTo,
    assignedEmail: assignedHold ? assignedHold.email : null,
    assignedPosition: assignedHold ? assignedHold.position : null,
    assignedHoldIds,
  };
}

export function returnCopy(
  data: StoreData,
  bookId: unknown,
): {
  copiesAvailable: number;
  assignedTo: number | null;
  assignedEmail: string | null;
  assignedPosition: number | null;
  assignedHoldIds: number[];
} {
  const bid = Number(bookId);
  if (!Number.isInteger(bid))
    throw Object.assign(new Error("Invalid bookId"), { status: 400 });

  const book = data.books.find((b) => b.id === bid);
  if (!book) throw Object.assign(new Error("Book not found"), { status: 404 });

  // Req #6: increment available copies, cap at total
  if (book.copiesAvailable < book.copiesTotal) {
    book.copiesAvailable += 1;
  }

  // Assign exactly one hold per return event.
  const { assignedHoldIds } = assignNextEligible(data, bid);
  const assignedTo = assignedHoldIds.length ? assignedHoldIds[0] : null;

  const assignedHold =
    assignedTo != null ? data.holds.find((h) => h.id === assignedTo) : null;
  const assignedEmail = assignedHold ? assignedHold.email : null;
  const assignedPosition = assignedHold ? assignedHold.position : null;

  return {
    copiesAvailable: book.copiesAvailable,
    assignedTo,
    assignedEmail,
    assignedPosition,
    assignedHoldIds,
  };
}
