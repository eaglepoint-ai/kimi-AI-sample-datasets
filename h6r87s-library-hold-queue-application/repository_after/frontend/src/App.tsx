// src/App.tsx
/* eslint-disable*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type Book,
  type Hold,
  bookAvailableCopies,
  bookTotalCopies,
  isValidEmailSimple,
} from "./api";

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

function Notice({
  type = "info",
  children,
}: {
  type?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`notice ${type === "error" ? "error" : type === "success" ? "success" : ""}`}
    >
      {children}
    </div>
  );
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [booksError, setBooksError] = useState<string>("");

  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const selectedBook = useMemo(
    () => books.find((b) => String(b.id) === String(selectedBookId)) || null,
    [books, selectedBookId],
  );

  const [queue, setQueue] = useState<Hold[]>([]);
  const [queueError, setQueueError] = useState<string>("");

  const [emailForHolds, setEmailForHolds] = useState<string>("");
  const [holds, setHolds] = useState<Hold[]>([]);
  const [holdsError, setHoldsError] = useState<string>("");

  const [createTitle, setCreateTitle] = useState<string>("");
  const [createCopies, setCreateCopies] = useState<string>("1");
  const [createMsg, setCreateMsg] = useState<string>("");

  const [holdEmail, setHoldEmail] = useState<string>("");
  const [holdBookId, setHoldBookId] = useState<string>("");
  const [holdMsg, setHoldMsg] = useState<string>("");

  const [returnMsg, setReturnMsg] = useState<string>("");

  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshMs, setRefreshMs] = useState<number>(2500);
  const [loading, setLoading] = useState<boolean>(false);

  const busyRef = useRef<boolean>(false);

  async function loadBooks() {
    try {
      setBooksError("");
      const list = await api.getBooks();
      setBooks(list);
      if (!selectedBookId && list.length) setSelectedBookId(String(list[0].id));
      if (!holdBookId && list.length) setHoldBookId(String(list[0].id));
    } catch (e: any) {
      setBooks([]);
      if (e?.status === 404) {
        setBooksError(
          "Books endpoint is missing. Add GET /api/books on the backend.",
        );
      } else {
        setBooksError(e?.message || "Failed to load books.");
      }
    }
  }

  async function loadQueue(bookId: string) {
    if (!bookId) return;
    try {
      setQueueError("");
      const data = await api.getQueue(bookId);
      setQueue(data);
    } catch (e: any) {
      setQueue([]);
      setQueueError(e?.message || "Failed to load queue.");
    }
  }

  async function loadHolds(email: string) {
    if (!email) return;
    try {
      setHoldsError("");
      const data = await api.getHolds(email);
      setHolds(data);
    } catch (e: any) {
      setHolds([]);
      setHoldsError(e?.message || "Failed to load holds.");
    }
  }

  async function refreshAll({ includeQueue = true, includeHolds = true } = {}) {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      await loadBooks();
      if (includeQueue && selectedBookId) await loadQueue(selectedBookId);
      if (includeHolds && emailForHolds.trim())
        await loadHolds(emailForHolds.trim());
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll({ includeQueue: false, includeHolds: false });
  }, []);

  useEffect(() => {
    if (selectedBookId) loadQueue(selectedBookId);
  }, [selectedBookId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      refreshAll();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshMs, selectedBookId, emailForHolds]);

  async function onCreateBook(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg("");

    const title = createTitle.trim();
    const copies = toInt(createCopies);

    if (!title) return setCreateMsg("Title is required.");
    if (!Number.isInteger(copies) || copies <= 0)
      return setCreateMsg("Copies must be a positive integer.");

    try {
      const book = await api.createBook({ title, copies });
      setCreateMsg(`Created book #${book.id} - ${book.title}`); // Added book title
      setCreateTitle("");
      setCreateCopies("1");
      await refreshAll({ includeQueue: false, includeHolds: false });
      setSelectedBookId(String(book.id));
      setHoldBookId(String(book.id));
    } catch (e2: any) {
      setCreateMsg(e2?.message || "Failed to create book.");
    }
  }

  async function onPlaceHold(e: React.FormEvent) {
    e.preventDefault();
    setHoldMsg("");

    const email = holdEmail.trim();
    const bookId = toInt(holdBookId);

    if (!isValidEmailSimple(email))
      return setHoldMsg("Invalid email (must include @ and .).");
    if (!Number.isInteger(bookId)) return setHoldMsg("Select a valid book.");

    try {
      const result = await api.placeHold({ email, bookId });
      setEmailForHolds(email);
      await refreshAll({ includeQueue: true, includeHolds: true });
      await loadHolds(email);
      setHoldMsg(
        `Placed hold. Position ${result.position} (hold #${result.holdId})`,
      );
    } catch (e2: any) {
      setHoldMsg(e2?.message || "Failed to place hold.");
    }
  }

  async function onReturnCopy() {
    setReturnMsg("");
    const bookId = toInt(selectedBookId);
    if (!Number.isInteger(bookId)) return setReturnMsg("Select a valid book.");
    try {
      const res = await api.returnCopy({ bookId });
      const assignedText =
        res?.assignedTo != null
          ? `Assigned to position #${res.assignedPosition ?? "?"} (${res.assignedEmail || "Unknown"})`
          : "No one assigned";
      setReturnMsg(assignedText);
      await refreshAll();
    } catch (e2: any) {
      setReturnMsg(e2?.message || "Failed to return copy.");
    }
  }

  async function onLoadHolds() {
    setHoldsError("");
    const email = emailForHolds.trim();
    if (!email) return setHoldsError("Enter an email.");
    await loadHolds(email);
  }

  async function mutateFreeze(holdId: number, freeze: boolean) {
    const email = emailForHolds.trim();
    if (!email) return setHoldsError("Enter an email and load holds first.");

    try {
      setHoldsError("");
      if (freeze) {
        await api.freezeHold({ email, holdId });
      } else {
        await api.unfreezeHold({ email, holdId });
      }
      setHolds((prev) =>
        prev.map((h) => (h.id === holdId ? { ...h, frozen: freeze } : h)),
      );
      setQueue((prev) =>
        prev.map((h) => (h.id === holdId ? { ...h, frozen: freeze } : h)),
      );
      setReturnMsg("");
      await refreshAll();
    } catch (e: any) {
      setHoldsError(e?.message || "Operation failed.");
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Library Hold Queue</h1>
          <div className="small">
            Place holds, freeze to skip, unfreeze to become eligible again.
          </div>
        </div>

        <div
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}
        >
          <label className="small" style={{ margin: 0, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ marginRight: 6, width: "auto" }}
            />
            Auto-refresh
          </label>

          <select
            value={String(refreshMs)}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
            style={{ marginBottom: 0, width: "auto", color: "#222", background: "#fff" }}
          >
            <option value="1500">1.5s</option>
            <option value="2500">2.5s</option>
            <option value="4000">4s</option>
            <option value="8000">8s</option>
          </select>

          <button
            onClick={() => refreshAll()}
            className="primary"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid">
        {/* BOOKS */}
        <div className="card">
          <h2>Books</h2>
          {booksError ? <Notice type="error">{booksError}</Notice> : null}

          {books.length ? (
            <>
              <div className="row">
                <div style={{ minWidth: 260 }}>
                  <label>Selected book</label>
                  <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                  >
                    {books.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        #{b.id} — {b.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  {selectedBook ? (
                    <div className="row" style={{ marginTop: 8 }}>
                      <StatusBadge
                        label={`Total: ${bookTotalCopies(selectedBook) ?? "?"}`}
                        tone="ok"
                      />
                      <StatusBadge
                        label={`Available: ${bookAvailableCopies(selectedBook) ?? "?"}`}
                        tone="warn"
                      />
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={onReturnCopy}
                  className="primary"
                  disabled={!selectedBookId}
                >
                  Return copy
                </button>
              </div>

              {returnMsg ? <Notice type="success">{returnMsg}</Notice> : null}

              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Total</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>{b.title}</td>
                      <td>{bookTotalCopies(b) ?? "?"}</td>
                      <td>{bookAvailableCopies(b) ?? "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <Notice>No books yet. Create one below.</Notice>
          )}

          <h2>Create book</h2>
          <form onSubmit={onCreateBook} className="formRow">
            <div className="field grow">
              <label htmlFor="create-title">Title</label>
              <input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g., The Hobbit"
              />
            </div>

            <div className="field small">
              <label htmlFor="create-copies">Copies</label>
              <input
                id="create-copies"
                value={createCopies}
                onChange={(e) => setCreateCopies(e.target.value)}
                inputMode="numeric"
                placeholder="1"
              />
            </div>

            <div className="actions">
              <button type="submit" className="primary">
                Create
              </button>
            </div>
          </form>

          {createMsg ? (
            <Notice
              type={createMsg.startsWith("Created") ? "success" : "error"}
            >
              {createMsg}
            </Notice>
          ) : null}
        </div>

        {/* QUEUE */}
        <div className="card">
          <h2>Queue</h2>
          {queueError ? <Notice type="error">{queueError}</Notice> : null}

          {!selectedBookId ? (
            <Notice>Select a book to view its queue.</Notice>
          ) : (
            <>
              <div className="small">
                Shown in position order. Frozen and fulfilled are marked.
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Email</th>
                    <th>Frozen</th>
                    <th>Fulfilled</th>
                    <th>Hold ID</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length ? (
                    queue.map((h) => (
                      <tr key={h.id ?? `${h.email}-${h.position}`}>
                        <td>{h.position}</td>
                        <td>{h.email}</td>
                        <td>
                          {h.frozen ? (
                            <StatusBadge label="Frozen" tone="warn" />
                          ) : (
                            <StatusBadge label="No" tone="ok" />
                          )}
                        </td>
                        <td>
                          {h.fulfilled ? (
                            <StatusBadge label="Yes" tone="ok" />
                          ) : (
                            <StatusBadge label="No" tone="bad" />
                          )}
                        </td>
                        <td>{h.id ?? "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="small">
                        No holds in this queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* PLACE HOLD */}
        <div className="card">
          <h2>Place a hold</h2>
          <form onSubmit={onPlaceHold} className="row">
            <div style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="hold-email">Email</label>
              <input
                id="hold-email"
                value={holdEmail}
                onChange={(e) => setHoldEmail(e.target.value)}
                placeholder="alice@example.com"
              />
              <div className="small">Must include @ and .</div>
            </div>

            <div style={{ minWidth: 260 }}>
              <label htmlFor="hold-book">Book</label>
              <select
                id="hold-book"
                value={holdBookId}
                onChange={(e) => setHoldBookId(e.target.value)}
                disabled={!books.length}
              >
                {books.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    #{b.id} — {b.title}
                  </option>
                ))}
              </select>
              <div className="small">Duplicate holds are rejected.</div>
            </div>

            <button type="submit" className="primary" disabled={!books.length}>
              Place hold
            </button>
          </form>

          {holdMsg ? (
            <Notice
              type={holdMsg.startsWith("Placed hold") ? "success" : "error"}
            >
              {holdMsg}
            </Notice>
          ) : null}
        </div>

        {/* USER HOLDS */}
        <div className="card">
          <h2>User holds</h2>
          <div className="row">
            <div style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="user-email">Email</label>
              <input
                id="user-email"
                value={emailForHolds}
                onChange={(e) => setEmailForHolds(e.target.value)}
                placeholder="alice@example.com"
              />
              <div className="small">
                Freeze skips your turn; unfreeze may assign a waiting copy.
              </div>
            </div>
            <button onClick={onLoadHolds} className="primary">
              Load
            </button>
          </div>

          {holdsError ? <Notice type="error">{holdsError}</Notice> : null}

          <table className="table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Position</th>
                <th>Frozen</th>
                <th>Fulfilled</th>
                <th>Hold ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holds.length ? (
                holds.map((h) => {
                  const book = books.find(
                    (b) => String(b.id) === String(h.bookId),
                  );
                  return (
                    <tr key={h.id ?? `${h.bookId}-${h.position}`}>
                      <td>
                        {book ? `#${book.id} — ${book.title}` : `#${h.bookId}`}
                      </td>
                      <td>{h.position}</td>
                      <td>
                        {h.frozen ? (
                          <StatusBadge label="Frozen" tone="warn" />
                        ) : (
                          <StatusBadge label="No" tone="ok" />
                        )}
                      </td>
                      <td>
                        {h.fulfilled ? (
                          <StatusBadge label="Yes" tone="ok" />
                        ) : (
                          <StatusBadge label="No" tone="bad" />
                        )}
                      </td>
                      <td>{h.id ?? "-"}</td>
                      <td>
                        <div className="row">
                          <button
                            onClick={() => mutateFreeze(h.id, true)}
                            disabled={h.frozen || h.fulfilled || !h.id}
                          >
                            Freeze
                          </button>
                          <button
                            onClick={() => mutateFreeze(h.id, false)}
                            className="primary"
                            disabled={!h.frozen || h.fulfilled || !h.id}
                          >
                            Unfreeze
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="small">
                    No holds loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="small" style={{ marginTop: 10 }}>
            Try: Alice, Bob, Charlie → freeze Alice → return a copy.
          </div>
        </div>
      </div>
    </div>
  );
}
