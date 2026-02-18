export type Book = {
  id: number;
  title: string;
  copiesTotal?: number; // backend may use copiesTotal
  copiesAvailable?: number; // backend may use copiesAvailable
  copies?: number; // fallback if backend uses copies
  availableCopies?: number; // fallback naming
};

export type Hold = {
  id: number;
  bookId: number;
  email: string;
  position: number;
  frozen: boolean;
  fulfilled: boolean;
};

/* eslint-disable */

export type CreateBookRequest = { title: string; copies: number };
export type PlaceHoldRequest = { email: string; bookId: number };
export type FreezeRequest = { email: string; holdId: number };
export type ReturnRequest = { bookId: number };

type ApiErrorPayload = { error?: string } | string | null;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data: ApiErrorPayload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && (data as any).error
        ? String((data as any).error)
        : typeof data === "string" && data
          ? data
          : `Request failed (${res.status})`;
    const err = new Error(message) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Frontend needs to list books. If backend returns {books:[...]} we support that too.
  async getBooks(): Promise<Book[]> {
    const data = await request<unknown>("/api/books");
    if (Array.isArray(data)) return data as Book[];
    if (data && typeof data === "object" && Array.isArray((data as any).books))
      return (data as any).books as Book[];
    return [];
  },

  createBook: (payload: CreateBookRequest) =>
    request<Book>("/api/books", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  placeHold: (payload: PlaceHoldRequest) =>
    request<{ position: number; holdId: number }>("/api/hold", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  freezeHold: (payload: FreezeRequest) =>
    request<Hold>("/api/freeze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  unfreezeHold: (payload: FreezeRequest) =>
    request<{
      hold?: Hold;
      assignedTo?: number | null;
      assignedEmail?: string | null;
      assignedPosition?: number | null;
    }>("/api/unfreeze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  returnCopy: (payload: ReturnRequest) =>
    request<{
      copiesAvailable?: number;
      assignedTo?: number | null;
      assignedEmail?: string | null;
      assignedPosition?: number | null;
    }>("/api/return", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  async getHolds(email: string): Promise<Hold[]> {
    const data = await request<unknown>(
      `/api/holds/${encodeURIComponent(email)}`,
    );
    if (Array.isArray(data)) return data as Hold[];
    if (data && typeof data === "object" && Array.isArray((data as any).holds))
      return (data as any).holds as Hold[];
    return [];
  },

  async getQueue(bookId: number | string): Promise<Hold[]> {
    const data = await request<unknown>(
      `/api/queue/${encodeURIComponent(String(bookId))}`,
    );
    if (Array.isArray(data)) return data as Hold[];
    if (data && typeof data === "object" && Array.isArray((data as any).queue))
      return (data as any).queue as Hold[];
    return [];
  },
};

export function isValidEmailSimple(email: string): boolean {
  // Req #8: must include @ and dot (.)
  return (
    typeof email === "string" && email.includes("@") && email.includes(".")
  );
}

export function bookTotalCopies(b: Book): number | null {
  const v = b.copiesTotal ?? b.copies;
  return Number.isFinite(v) ? Number(v) : null;
}

export function bookAvailableCopies(b: Book): number | null {
  const v = b.copiesAvailable ?? b.availableCopies;
  return Number.isFinite(v) ? Number(v) : null;
}
