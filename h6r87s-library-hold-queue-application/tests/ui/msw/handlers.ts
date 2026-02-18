import { http, HttpResponse } from "msw";
import {
  apiCreateBook,
  apiFreeze,
  apiGetHoldsByEmail,
  apiGetQueue,
  apiListBooks,
  apiPlaceHold,
  apiReturn,
  apiUnfreeze,
  getState,
} from "./state";

export const handlers = [
  http.get("/api/books", () => {
    const r = apiListBooks(getState());
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.post("/api/books", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const r = apiCreateBook(getState(), body.title, body.copies);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.post("/api/hold", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const r = apiPlaceHold(getState(), body.email, body.bookId);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.post("/api/freeze", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const r = apiFreeze(getState(), body.email, body.holdId);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.post("/api/unfreeze", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const r = apiUnfreeze(getState(), body.email, body.holdId);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.post("/api/return", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const r = apiReturn(getState(), body.bookId);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.get("/api/queue/:bookId", ({ params }) => {
    const bookId = Number(params.bookId);
    const r = apiGetQueue(getState(), bookId);
    return HttpResponse.json(r.body, { status: r.status });
  }),

  http.get("/api/holds/:email", ({ params }) => {
    const email = String(params.email);
    const r = apiGetHoldsByEmail(getState(), email);
    return HttpResponse.json(r.body, { status: r.status });
  }),
];
