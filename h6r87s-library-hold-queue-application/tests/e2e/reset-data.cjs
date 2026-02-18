// tests/e2e/reset-data.cjs
const fs = require("fs");
const path = require("path");

const configured = process.env.DATA_PATH
  ? path.resolve(process.cwd(), process.env.DATA_PATH)
  : path.resolve(
      process.cwd(),
      "repository_after",
      "backend",
      "data",
      "data.json",
    );

const dir = path.dirname(configured);
const file = configured;

fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const initial = {
  counters: { bookId: 1, holdId: 1 },
  books: [],
  holds: [],
};

fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");

console.log(`[e2e] reset data at ${file}`);
