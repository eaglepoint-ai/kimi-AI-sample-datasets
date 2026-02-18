import { useState, useEffect } from "react";
import { DEFAULT_TASKS, STORAGE_KEY } from "../constants";

const VALID_CATEGORIES = new Set(["wip", "complete"]);

/**
 * Load tasks from localStorage. Falls back to DEFAULT_TASKS
 * if data is missing, invalid, or if localStorage throws.
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (t) =>
            typeof t === "object" &&
            t !== null &&
            Object.keys(t).length === 3 &&
            typeof t.name === "string" &&
            VALID_CATEGORIES.has(t.category) &&
            typeof t.bgcolor === "string"
        )
      ) {
        return parsed;
      }
    }
  } catch {
    /* localStorage unavailable or corrupt */
  }
  return DEFAULT_TASKS;
}

/**
 * Persist tasks to localStorage.
 * Silently ignores quota / private-mode errors.
 */
function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* ignore */
  }
}

/**
 * Custom hook that manages the tasks array and keeps it
 * synchronised with localStorage.
 */
export function useTasks() {
  const [tasks, setTasks] = useState(loadTasks);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  return [tasks, setTasks];
}
