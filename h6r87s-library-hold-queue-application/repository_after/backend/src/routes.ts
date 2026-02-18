import { Router } from "express";
import { JsonStore } from "./store";
import {
  createBook,
  freezeHold,
  getHoldsForEmail,
  getQueue,
  listBooks,
  placeHold,
  returnCopy,
  unfreezeHold,
} from "./service";
import { asInt, isValidEmailSimple } from "./utils";

export function createRoutes(store: JsonStore): Router {
  const router = Router();

  // GET /api/books (needed by frontend)
  router.get("/books", async (_req, res, next) => {
    try {
      const books = await store.read().then(listBooks);
      res.json(books);
    } catch (e) {
      next(e);
    }
  });

  // POST /api/books
  router.post("/books", async (req, res, next) => {
    try {
      const { title, copies } = req.body ?? {};
      const book = await store.transact((data) =>
        createBook(data, title, copies),
      );
      res.json(book);
    } catch (e) {
      next(e);
    }
  });

  // POST /api/hold
  router.post("/hold", async (req, res, next) => {
    try {
      const { email, bookId } = req.body ?? {};
      const result = await store.transact((data) =>
        placeHold(data, email, bookId),
      );
      res.json(result); // { position, holdId }
    } catch (e) {
      next(e);
    }
  });

  // POST /api/freeze
  router.post("/freeze", async (req, res, next) => {
    try {
      const { email, holdId } = req.body ?? {};
      const hold = await store.transact((data) =>
        freezeHold(data, email, holdId),
      );
      res.json(hold);
    } catch (e) {
      next(e);
    }
  });

  // POST /api/unfreeze
  router.post("/unfreeze", async (req, res, next) => {
    try {
      const { email, holdId } = req.body ?? {};
      const result = await store.transact((data) =>
        unfreezeHold(data, email, holdId),
      );
      res.json({
        hold: result.hold,
        assignedTo: result.assignedTo,
        assignedEmail: result.assignedEmail,
        assignedPosition: result.assignedPosition,
      });
    } catch (e) {
      next(e);
    }
  });

  // POST /api/return
  router.post("/return", async (req, res, next) => {
    try {
      const { bookId } = req.body ?? {};
      const result = await store.transact((data) => returnCopy(data, bookId));
      res.json({
        copiesAvailable: result.copiesAvailable,
        assignedTo: result.assignedTo,
        assignedEmail: result.assignedEmail || null, // Ensure explicit null if undefined
        assignedPosition: result.assignedPosition || null,
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/holds/:email
  router.get("/holds/:email", async (req, res, next) => {
    try {
      const email = req.params.email;
      // not required, but helps keep errors consistent
      if (!isValidEmailSimple(email))
        return res.status(400).json({ error: "Invalid email" });

      const holds = await store
        .read()
        .then((data) => getHoldsForEmail(data, email));
      res.json(holds);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/queue/:bookId
  router.get("/queue/:bookId", async (req, res, next) => {
    try {
      const bookId = asInt(req.params.bookId);
      if (bookId == null)
        return res.status(400).json({ error: "Invalid bookId" });

      const queue = await store.read().then((data) => getQueue(data, bookId));
      res.json(queue);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
