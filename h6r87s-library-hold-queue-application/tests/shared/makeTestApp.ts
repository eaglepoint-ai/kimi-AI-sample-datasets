import request from "supertest";
import { createApp } from "../../repository_after/backend/src/app";
import { createTempDataFile } from "./tempStore";

export async function makeTestApp() {
  const { file } = await createTempDataFile();
  const app = createApp({ dataPath: file });
  const api = request(app);
  return { app, api, dataFile: file };
}

export { createTempDataFile, readJson } from "./tempStore";
