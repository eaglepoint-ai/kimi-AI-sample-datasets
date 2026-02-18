import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../repository_after/backend/src/app";
import { createTempDataFile } from "../shared/tempStore";

describe("Integration - persistence across app restart", () => {
  it("state persists in JSON after creating holds and assigning", async () => {
    const { file } = await createTempDataFile();

    // App instance 1
    const app1 = createApp({ dataPath: file });
    const api1 = request(app1);

    const bookRes = await api1
      .post("/api/books")
      .send({ title: "Persist Book", copies: 1 })
      .expect(200);
    const bookId = bookRes.body.id;

    const h1 = await api1
      .post("/api/hold")
      .send({ email: "a@x.com", bookId })
      .expect(200);
    await api1.post("/api/hold").send({ email: "b@x.com", bookId }).expect(200);

    // Trigger assignment
    const ret = await api1.post("/api/return").send({ bookId }).expect(200);
    expect(ret.body.assignedTo).toBe(h1.body.holdId);

    // App instance 2 (restart)
    const app2 = createApp({ dataPath: file });
    const api2 = request(app2);

    const queue = await api2.get(`/api/queue/${bookId}`).expect(200);
    expect(queue.body.length).toBe(2);

    const aRow = queue.body.find((h: any) => h.email === "a@x.com");
    expect(aRow.fulfilled).toBe(true);
  });
});
