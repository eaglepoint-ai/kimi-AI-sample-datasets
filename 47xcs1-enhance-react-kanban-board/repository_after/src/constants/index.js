/* ── Priority ↔ bgcolor mapping constants ─────────────── */

export const BGCOLOR_PRIORITY = {
  "#ee9090": "High",
  "#eeed90": "Medium",
  lightgreen: "Low",
};

export const PRIORITY_BGCOLOR = {
  High: "#ee9090",
  Medium: "#eeed90",
  Low: "lightgreen",
};

export const DEFAULT_TASKS = [
  { name: "STORY-4513: Add tooltip", category: "wip", bgcolor: "lightblue" },
  { name: "STORY-4547: Fix search bug", category: "wip", bgcolor: "lightgrey" },
  { name: "STORY-4525: New filter option", category: "complete", bgcolor: "lightgreen" },
  { name: "STORY-4526: Remove region filter", category: "complete", bgcolor: "#ee9090" },
  { name: "STORY-4520: Improve performance", category: "complete", bgcolor: "#eeed90" },
];

export const STORAGE_KEY = "kanban-tasks";
