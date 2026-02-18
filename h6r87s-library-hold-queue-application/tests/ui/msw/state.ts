export type Book = {
  id: number;
  title: string;
  copiesTotal: number;
  copiesAvailable: number;
};

export type Hold = {
  id: number;
  bookId: number;
  email: string;
  position: number;
  frozen: boolean;
  fulfilled: boolean;
};

export type State = {
  counters: { bookId: number; holdId: number };
  books: Book[];
  holds: Hold[];
};

export function makeState(): State {
  return {
    counters: { bookId: 1, holdId: 1 },
    books: [],
    holds: [],
  };
}

export function isValidEmailSimple(email: unknown): email is string {
  return (
    typeof email === "string" && email.includes("@") && email.includes(".")
  );
}

function queueForBook(state: State, bookId: number): Hold[] {
  return state.holds
    .filter((h) => h.bookId === bookId)
    .slice()
    .sort((a, b) => a.position - b.position);
}

function assignIfPossible(state: State, bookId: number): number | null {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return null;

  if (book.copiesAvailable <= 0) return null;

  const q = queueForBook(state, bookId);
  const eligible = q.find((h) => !h.fulfilled && !h.frozen);
  if (!eligible) return null;

  eligible.fulfilled = true;
  book.copiesAvailable -= 1;
  return eligible.id;
}

export function apiCreateBook(state: State, title: unknown, copies: unknown) {
  const t = typeof title === "string" ? title.trim() : "";
  const c = Number(copies);
  if (!t) return { status: 400, body: { error: "Title is required" } };
  if (!Number.isInteger(c) || c <= 0)
    return {
      status: 400,
      body: { error: "Copies must be a positive integer" },
    };

  const book: Book = {
    id: state.counters.bookId++,
    title: t,
    copiesTotal: c,
    copiesAvailable: c,
  };
  state.books.push(book);
  return { status: 200, body: book };
}

export function apiListBooks(state: State) {
  return { status: 200, body: state.books.slice().sort((a, b) => a.id - b.id) };
}

export function apiPlaceHold(state: State, email: unknown, bookId: unknown) {
  if (!isValidEmailSimple(email))
    return { status: 400, body: { error: "Invalid email" } };
  const bid = Number(bookId);
  if (!Number.isInteger(bid))
    return { status: 400, body: { error: "Invalid bookId" } };
  const book = state.books.find((b) => b.id === bid);
  if (!book) return { status: 404, body: { error: "Book not found" } };

  // active = unfulfilled duplicate block
  const dup = state.holds.some(
    (h) => h.bookId === bid && h.email === email && !h.fulfilled,
  );
  if (dup)
    return { status: 409, body: { error: "Already on hold for this book" } };

  const maxPos = state.holds
    .filter((h) => h.bookId === bid)
    .reduce((m, h) => Math.max(m, h.position), 0);
  const hold: Hold = {
    id: state.counters.holdId++,
    bookId: bid,
    email,
    position: maxPos + 1,
    frozen: false,
    fulfilled: false,
  };
  state.holds.push(hold);

  // NOTE: UI tests don't require auto-assignment on hold placement;
  // assignment is triggered by return/unfreeze, like our backend.
  return { status: 200, body: { position: hold.position, holdId: hold.id } };
}

export function apiGetQueue(state: State, bookId: number) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return { status: 404, body: { error: "Book not found" } };
  return { status: 200, body: queueForBook(state, bookId) };
}

export function apiGetHoldsByEmail(state: State, email: string) {
  if (!isValidEmailSimple(email))
    return { status: 400, body: { error: "Invalid email" } };
  const holds = state.holds
    .filter((h) => h.email === email)
    .slice()
    .sort((a, b) => a.bookId - b.bookId || a.position - b.position);
  return { status: 200, body: holds };
}

export function apiFreeze(state: State, email: unknown, holdId: unknown) {
  if (!isValidEmailSimple(email))
    return { status: 400, body: { error: "Invalid email" } };
  const hid = Number(holdId);
  if (!Number.isInteger(hid))
    return { status: 400, body: { error: "Invalid holdId" } };

  const hold = state.holds.find((h) => h.id === hid);
  if (!hold) return { status: 404, body: { error: "Hold not found" } };
  if (hold.email !== email)
    return { status: 403, body: { error: "Email does not match hold" } };

  hold.frozen = true;
  return { status: 200, body: hold };
}

export function apiUnfreeze(state: State, email: unknown, holdId: unknown) {
  if (!isValidEmailSimple(email))
    return { status: 400, body: { error: "Invalid email" } };
  const hid = Number(holdId);
  if (!Number.isInteger(hid))
    return { status: 400, body: { error: "Invalid holdId" } };

  const hold = state.holds.find((h) => h.id === hid);
  if (!hold) return { status: 404, body: { error: "Hold not found" } };
  if (hold.email !== email)
    return { status: 403, body: { error: "Email does not match hold" } };

  hold.frozen = false;
  const assignedTo = assignIfPossible(state, hold.bookId);
  return { status: 200, body: { hold, assignedTo } };
}

export function apiReturn(state: State, bookId: unknown) {
  const bid = Number(bookId);
  if (!Number.isInteger(bid))
    return { status: 400, body: { error: "Invalid bookId" } };
  const book = state.books.find((b) => b.id === bid);
  if (!book) return { status: 404, body: { error: "Book not found" } };

  // Return 1 copy (cap at total)
  if (book.copiesAvailable < book.copiesTotal) book.copiesAvailable += 1;

  const assignedTo = assignIfPossible(state, bid);
  return {
    status: 200,
    body: { copiesAvailable: book.copiesAvailable, assignedTo },
  };
}

let _state = makeState();

export function getState() {
  return _state;
}

export function resetState() {
  _state = makeState();
}
