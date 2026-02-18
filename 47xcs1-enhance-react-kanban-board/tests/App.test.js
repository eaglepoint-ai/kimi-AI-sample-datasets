import React from "react";
import { render, screen, fireEvent, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import App from "../repository_after/src/App";

/* ────────────────────────────────────────────────────────
   Helper utilities
   ──────────────────────────────────────────────────────── */

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

const DEFAULT_TASK_NAMES = [
  "STORY-4513: Add tooltip",
  "STORY-4547: Fix search bug",
  "STORY-4525: New filter option",
  "STORY-4526: Remove region filter",
  "STORY-4520: Improve performance",
];

/** Helper: simulate a full drag-and-drop with mock DataTransfer */
function simulateDragDrop(source, target) {
  const data = {};
  const dt = {
    setData: (k, v) => { data[k] = v; },
    getData: (k) => data[k] || "",
  };
  const startEvt = new Event("dragstart", { bubbles: true });
  Object.defineProperty(startEvt, "dataTransfer", { value: dt });
  const overEvt = new Event("dragover", { bubbles: true, cancelable: true });
  const dropEvt = new Event("drop", { bubbles: true });
  Object.defineProperty(dropEvt, "dataTransfer", { value: dt });
  act(() => { source.dispatchEvent(startEvt); });
  act(() => { target.dispatchEvent(overEvt); });
  act(() => { target.dispatchEvent(dropEvt); });
}

/* ================================================================
   REQUIREMENT 1: Implementation language React (JS/JSX), CSS,
                  No additional frameworks or libraries
   ================================================================ */
describe("Requirement 1 – React / JS / CSS only", () => {
  test("App renders without crashing (React component)", () => {
    render(<App />);
    expect(screen.getByText("JIRA BOARD: Sprint 21U")).toBeInTheDocument();
  });

  test("renders two columns: In-PROGRESS and COMPLETED", () => {
    render(<App />);
    expect(screen.getByText(/In-PROGRESS/)).toBeInTheDocument();
    expect(screen.getByText(/COMPLETED/)).toBeInTheDocument();
  });

  test("default seed tasks are rendered", () => {
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("package dependencies do not include forbidden UI/DnD/ID libraries", () => {
    const pkg = require("../repository_after/package.json");
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    const forbidden = [
      "react-dnd",
      "react-beautiful-dnd",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "sortablejs",
      "uuid",
      "nanoid",
      "@mui/material",
      "antd",
      "@chakra-ui/react",
    ];
    forbidden.forEach((name) => {
      expect(deps[name]).toBeUndefined();
    });
  });

  test("source files do not import forbidden external libraries", () => {
    const fs = require("fs");
    const path = require("path");
    const srcRoot = path.resolve(__dirname, "../repository_after/src");
    const stack = [srcRoot];
    const jsFiles = [];

    while (stack.length > 0) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });
      entries.forEach((entry) => {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          return;
        }
        if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
          jsFiles.push(fullPath);
        }
      });
    }

    const forbiddenImport = /from\s+["'](react-dnd|react-beautiful-dnd|@dnd-kit\/core|@dnd-kit\/sortable|sortablejs|uuid|nanoid|@mui\/material|antd|@chakra-ui\/react)["']/;
    jsFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toMatch(forbiddenImport);
    });
  });
});

/* ================================================================
   REQUIREMENT 2: Add Task button in column header opens modal
                  with Title (required) and Priority (Low/Medium/High)
   ================================================================ */
describe("Requirement 2 – Add Task modal", () => {
  test("each column header has an Add Task button", () => {
    render(<App />);
    expect(screen.getByTestId("add-task-wip")).toBeInTheDocument();
    expect(screen.getByTestId("add-task-complete")).toBeInTheDocument();
  });

  test("clicking Add Task opens a modal with title and priority fields", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
    expect(screen.getByTestId("add-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("add-priority-select")).toBeInTheDocument();
  });

  test("modal has Low/Medium/High priority options", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    const select = screen.getByTestId("add-priority-select");
    const options = within(select).getAllByRole("option");
    const values = options.map((o) => o.value);
    expect(values).toContain("Low");
    expect(values).toContain("Medium");
    expect(values).toContain("High");
  });

  test("modal has an optional Description field", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    expect(screen.getByTestId("add-description-input")).toBeInTheDocument();
  });

  test("submitting with empty title does not add a task", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    // modal should still be open (no task added)
    // total tasks unchanged
    const cards = screen.getAllByText(/^STORY-\d{4}:/);
    expect(cards.length).toBe(5);
  });

  test("modal closes on submit with valid title", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "New feature" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
  });

  test("modal closes on outside click", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("add-modal-overlay"));
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
  });

  test("modal closes on Escape key", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
  });

  test("Enter key in title input submits the form", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-complete"));
    const input = screen.getByTestId("add-title-input");
    fireEvent.change(input, { target: { value: "Quick task" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
    expect(screen.getByText(/Quick task/)).toBeInTheDocument();
  });

  test("Enter key on priority select submits the modal", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Submit from select" },
    });
    const select = screen.getByTestId("add-priority-select");
    select.focus();
    fireEvent.keyDown(select, { key: "Enter" });
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
    expect(screen.getByText(/Submit from select/)).toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 3: New task name STORY-XXXX: <Title>, 4-digit random,
                  no duplicate names, regenerate if collision
   ================================================================ */
describe("Requirement 3 – Task name format STORY-XXXX: <Title>", () => {
  test("newly added task has name matching STORY-XXXX: <Title>", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "My new task" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/My new task/);
    expect(card.textContent).toMatch(/^STORY-\d{4}: My new task$/);
  });

  test("STORY number is exactly 4 digits", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Check digits" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/Check digits/);
    const match = card.textContent.match(/STORY-(\d+):/);
    expect(match).not.toBeNull();
    expect(match[1].length).toBe(4);
    expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(1000);
    expect(parseInt(match[1], 10)).toBeLessThanOrEqual(9999);
  });

  test("no two tasks can have the same name (unique enforcement)", () => {
    render(<App />);
    // Add first task
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Duplicate test" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    // Add second task with same title – name must differ because STORY-XXXX is random
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Duplicate test" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const cards = screen.getAllByText(/Duplicate test/);
    const names = cards.map((c) => c.textContent);
    // All names should be unique
    expect(new Set(names).size).toBe(names.length);
  });
});

/* ================================================================
   REQUIREMENT 4: Task shape { name, category, bgcolor } only.
                  Priority derived from bgcolor.
   ================================================================ */
describe("Requirement 4 – Task shape and priority ↔ bgcolor", () => {
  test("adding task with High priority sets bgcolor to #ee9090", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "High pri" },
    });
    fireEvent.change(screen.getByTestId("add-priority-select"), {
      target: { value: "High" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/High pri/).closest(".task-card");
    expect(card.style.backgroundColor).toBe("rgb(238, 144, 144)"); // #ee9090
  });

  test("adding task with Medium priority sets bgcolor to #eeed90", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Med pri" },
    });
    fireEvent.change(screen.getByTestId("add-priority-select"), {
      target: { value: "Medium" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/Med pri/).closest(".task-card");
    expect(card.style.backgroundColor).toBe("rgb(238, 237, 144)"); // #eeed90
  });

  test("adding task with Low priority sets bgcolor to lightgreen", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Low pri" },
    });
    fireEvent.change(screen.getByTestId("add-priority-select"), {
      target: { value: "Low" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/Low pri/).closest(".task-card");
    expect(card.style.backgroundColor).toBe("lightgreen");
  });

  test("localStorage stores tasks with only { name, category, bgcolor } fields", () => {
    render(<App />);
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    stored.forEach((t) => {
      const keys = Object.keys(t).sort();
      expect(keys).toEqual(["bgcolor", "category", "name"]);
    });
  });
});

/* ================================================================
   REQUIREMENT 5: Double-click card → inline edit. Only part after
                  first : may change. STORY-XXXX: prefix must not change.
   ================================================================ */
describe("Requirement 5 – Inline edit via double-click", () => {
  test("double-clicking a card enters edit mode with input", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    expect(screen.getByTestId("edit-input")).toBeInTheDocument();
  });

  test("edit input shows only the part after the first colon", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    expect(input.value).toBe("Add tooltip");
  });

  test("saving edit preserves STORY-XXXX: prefix", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "New title" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("STORY-4513: New title")).toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 6: Empty title on save reverts. Card not draggable
                  while editing. Enter/blur saves, Escape cancels.
   ================================================================ */
describe("Requirement 6 – Edit save/cancel/revert behaviour", () => {
  test("empty title on save reverts to original", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
  });

  test("Escape cancels edit and reverts", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-input")).not.toBeInTheDocument();
  });

  test("blur on edit input saves the edit", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Blur saved" } });
    fireEvent.blur(input);
    expect(screen.getByText("STORY-4513: Blur saved")).toBeInTheDocument();
  });

  test("card is not draggable while editing", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    // In edit mode, draggable should be false
    expect(card.getAttribute("draggable")).toBe("false");
  });
});

/* ================================================================
   REQUIREMENT 7: Delete control × on hover at top-right.
                  Click → "Delete this task?" Yes/No.
                  Outside click closes without deleting.
   ================================================================ */
describe("Requirement 7 – Delete with confirmation", () => {
  test("each card has a delete button", () => {
    render(<App />);
    expect(screen.getByTestId("delete-btn-STORY-4513: Add tooltip")).toBeInTheDocument();
  });

  test("clicking delete button shows confirmation dialog", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    expect(screen.getByTestId("delete-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete this task?")).toBeInTheDocument();
  });

  test("confirmation dialog has Yes and No buttons", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    expect(screen.getByTestId("delete-yes")).toBeInTheDocument();
    expect(screen.getByTestId("delete-no")).toBeInTheDocument();
  });

  test("clicking Yes deletes the task", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-yes"));
    expect(screen.queryByText("STORY-4513: Add tooltip")).not.toBeInTheDocument();
  });

  test("clicking No closes dialog without deleting", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-no"));
    expect(screen.queryByTestId("delete-confirm-dialog")).not.toBeInTheDocument();
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
  });

  test("outside click on overlay closes delete dialog without deleting", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-confirm-overlay"));
    expect(screen.queryByTestId("delete-confirm-dialog")).not.toBeInTheDocument();
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 8: Delete must not start a drag.
                  Priority dot/badge shown on each card derived from bgcolor.
   ================================================================ */
describe("Requirement 8 – No drag on delete, priority display", () => {
  test("delete button stops propagation so drag does not start", () => {
    render(<App />);
    const deleteBtn = screen.getByTestId("delete-btn-STORY-4513: Add tooltip");
    // mouseDown should stop propagation
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
    const stopSpy = jest.spyOn(mouseDownEvent, "stopPropagation");
    deleteBtn.dispatchEvent(mouseDownEvent);
    expect(stopSpy).toHaveBeenCalled();
  });

  test("each card has a priority dot", () => {
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByTestId(`priority-dot-${name}`)).toBeInTheDocument();
    });
  });

  test("priority dot for High bgcolor (#ee9090) is red", () => {
    render(<App />);
    const dot = screen.getByTestId("priority-dot-STORY-4526: Remove region filter");
    expect(dot.style.backgroundColor).toBe("red");
  });

  test("priority dot for Medium bgcolor (#eeed90) is orange", () => {
    render(<App />);
    const dot = screen.getByTestId("priority-dot-STORY-4520: Improve performance");
    expect(dot.style.backgroundColor).toBe("orange");
  });

  test("priority dot for Low bgcolor (lightgreen) is green", () => {
    render(<App />);
    const dot = screen.getByTestId("priority-dot-STORY-4525: New filter option");
    expect(dot.style.backgroundColor).toBe("green");
  });

  test("priority dot for unknown bgcolor is grey", () => {
    render(<App />);
    // lightblue is not in the priority map
    const dot = screen.getByTestId("priority-dot-STORY-4513: Add tooltip");
    expect(dot.style.backgroundColor).toBe("grey");
  });
});

/* ================================================================
   REQUIREMENT 9: Right-click opens context menu (Low/Medium/High).
                  Choice sets bgcolor and closes menu.
                  Bgcolor map: High #ee9090, Medium #eeed90, Low lightgreen.
   ================================================================ */
describe("Requirement 9 – Context menu for priority change", () => {
  test("right-click on card opens context menu", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  test("context menu shows Low, Medium, High options", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    expect(screen.getByTestId("ctx-low")).toBeInTheDocument();
    expect(screen.getByTestId("ctx-medium")).toBeInTheDocument();
    expect(screen.getByTestId("ctx-high")).toBeInTheDocument();
  });

  test("choosing High sets bgcolor to #ee9090", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(card.style.backgroundColor).toBe("rgb(238, 144, 144)");
  });

  test("choosing Medium sets bgcolor to #eeed90", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-medium"));
    expect(card.style.backgroundColor).toBe("rgb(238, 237, 144)");
  });

  test("choosing Low sets bgcolor to lightgreen", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-low"));
    expect(card.style.backgroundColor).toBe("lightgreen");
  });

  test("context menu closes after choice", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 10: Context menu closes on outside click or choose.
                   Every change written to localStorage.
   ================================================================ */
describe("Requirement 10 – Context menu close & localStorage writes", () => {
  test("context menu closes on outside click", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    // click outside
    fireEvent.click(document.body);
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });

  test("adding a task persists to localStorage", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Persist test" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    expect(stored.some((t) => t.name.includes("Persist test"))).toBe(true);
  });

  test("deleting a task persists to localStorage", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-yes"));
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    expect(stored.some((t) => t.name === "STORY-4513: Add tooltip")).toBe(false);
  });

  test("editing a task persists to localStorage", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Edited title" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    expect(stored.some((t) => t.name === "STORY-4513: Edited title")).toBe(true);
  });

  test("priority change persists to localStorage", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4513: Add tooltip");
    expect(task.bgcolor).toBe("#ee9090");
  });
});

/* ================================================================
   REQUIREMENT 11: On mount, read from localStorage; if missing/invalid,
                   use default seed. localStorage errors caught silently.
   ================================================================ */
describe("Requirement 11 – localStorage load on mount", () => {
  test("loads tasks from localStorage if valid", () => {
    const customTasks = [
      { name: "STORY-9999: Custom task", category: "wip", bgcolor: "lightgreen" },
    ];
    localStorage.setItem("kanban-tasks", JSON.stringify(customTasks));
    render(<App />);
    expect(screen.getByText("STORY-9999: Custom task")).toBeInTheDocument();
    expect(screen.queryByText("STORY-4513: Add tooltip")).not.toBeInTheDocument();
  });

  test("uses default seed if localStorage is empty", () => {
    localStorage.removeItem("kanban-tasks");
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage has invalid JSON", () => {
    localStorage.setItem("kanban-tasks", "not-valid-json");
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage has invalid data shape", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify([{ bad: "data" }]));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage has an invalid category value", () => {
    localStorage.setItem(
      "kanban-tasks",
      JSON.stringify([
        { name: "STORY-7777: Bad category", category: "archived", bgcolor: "lightgreen" },
      ])
    );
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.queryByText("STORY-7777: Bad category")).not.toBeInTheDocument();
  });

  test("uses default seed if localStorage has empty array", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify([]));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage value is null JSON", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify(null));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage value is a plain string", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify("hello"));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage value is a number", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify(42));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage value is a plain object", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify({ name: "x", category: "wip", bgcolor: "red" }));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("uses default seed if localStorage has mixed valid/invalid entries", () => {
    localStorage.setItem("kanban-tasks", JSON.stringify([
      { name: "STORY-9999: Valid", category: "wip", bgcolor: "lightgreen" },
      { bad: "data" },
    ]));
    render(<App />);
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("app does not break if localStorage throws on getItem", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Private mode");
    });
    // Should not throw
    expect(() => render(<App />)).not.toThrow();
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("app does not break if localStorage throws on setItem", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    expect(() => render(<App />)).not.toThrow();
    // Add a task - should not crash
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Testing" },
    });
    expect(() => fireEvent.click(screen.getByTestId("add-submit-btn"))).not.toThrow();
  });
});

/* ================================================================
   REQUIREMENT 12: No external libraries. Styling inline + existing patterns.
   ================================================================ */
describe("Requirement 12 – Inline styling, no external libs", () => {
  test("task cards use inline backgroundColor style", () => {
    render(<App />);
    const card = screen.getByText("STORY-4525: New filter option").closest(".task-card");
    expect(card.style.backgroundColor).toBeTruthy();
  });

  test("task cards have the task-card class", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    expect(card).toHaveClass("task-card");
  });

  test("task card layout styles are inline (height, flex, border-radius, margin, padding)", () => {
    render(<App />);
    const card = screen.getByText("STORY-4525: New filter option").closest(".task-card");
    expect(card.style.height).toBe("50px");
    expect(card.style.display).toBe("flex");
    expect(card.style.alignItems).toBe("center");
    expect(card.style.justifyContent).toBe("center");
    expect(card.style.borderRadius).toBe("5px");
    expect(card.style.margin).toBe("5px");
    expect(card.style.padding).toBe("5px");
  });

  test("app container uses inline text-align and font-family styles", () => {
    render(<App />);
    const container = screen.getByTestId("app-container");
    expect(container.style.textAlign).toBe("center");
    expect(container.style.fontFamily).toBe("monospace");
  });

  test("board uses inline flex layout", () => {
    render(<App />);
    const board = screen.getByTestId("board");
    expect(board.style.display).toBe("flex");
    expect(board.style.justifyContent).toBe("space-around");
  });

  test("header uses inline underline and font-size styles", () => {
    render(<App />);
    const header = screen.getByText("JIRA BOARD: Sprint 21U");
    expect(header.style.textDecorationLine).toBe("underline");
    expect(header.style.fontSize).toBe("1.5rem");
  });
});

/* ================================================================
   REQUIREMENT 13: Modal close on submit / outside click / Escape.
                   Tab, Enter submit, Escape close for keyboard.
                   Context menu & edit: Escape close/cancel.
   ================================================================ */
describe("Requirement 13 – Keyboard interactions", () => {
  test("Escape closes context menu", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
  });

  test("Escape closes delete confirmation", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    expect(screen.getByTestId("delete-confirm-dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("delete-confirm-dialog")).not.toBeInTheDocument();
  });

  test("Escape closes add modal", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
  });

  test("Escape cancels inline edit", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Will cancel" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("edit-input")).not.toBeInTheDocument();
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 14: All five features work together;
                   existing drag-and-drop between columns unchanged.
   ================================================================ */
describe("Requirement 14 – Features work together, drag-and-drop preserved", () => {
  test("cards are draggable", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    expect(card.getAttribute("draggable")).toBe("true");
  });

  test("drag-and-drop simulation moves task from wip to completed", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    const target = screen.getByTestId("column-complete");
    simulateDragDrop(card, target);
    // Verify the task moved to completed category
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4513: Add tooltip");
    expect(task.category).toBe("complete");
  });

  test("drag-and-drop simulation moves task from completed to wip", () => {
    render(<App />);
    // STORY-4525 starts in complete
    const card = screen.getByText("STORY-4525: New filter option").closest(".task-card");
    const target = screen.getByTestId("column-wip");
    simulateDragDrop(card, target);
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4525: New filter option");
    expect(task.category).toBe("wip");
  });

  test("add then edit a task works", () => {
    render(<App />);
    // Add
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Added then edited" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const card = screen.getByText(/Added then edited/).closest(".task-card");
    // Edit
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "After edit" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/After edit/)).toBeInTheDocument();
  });

  test("add then delete a task works", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-complete"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Will be deleted" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    const taskName = screen.getByText(/Will be deleted/).textContent;
    const deleteBtn = screen.getByTestId(`delete-btn-${taskName}`);
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByTestId("delete-yes"));
    expect(screen.queryByText(/Will be deleted/)).not.toBeInTheDocument();
  });

  test("change priority then edit task works", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    // Change priority
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(card.style.backgroundColor).toBe("rgb(238, 144, 144)");
    // Edit
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("STORY-4513: Updated")).toBeInTheDocument();
  });
});

/* ================================================================
   REQUIREMENT 15: No console errors or warnings
   ================================================================ */
describe("Requirement 15 – No console errors or warnings", () => {
  test("no console.error during render", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.warn during render", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("no console.error when adding task", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "No errors" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.error when editing task", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Edit test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.error when deleting task", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-yes"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

/* ================================================================
   ADDITIONAL TESTS – Addressing review comments
   ================================================================ */

/* Req 3 – Force collision-regeneration loop via Math.random mock */
describe("Requirement 3 – Task name format STORY-XXXX: <Title>", () => {
  test("collision-regeneration: mocked Math.random collides then resolves", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Add tooltip" },
    });
    // Mock: first random → 4513 creates full-name collision, second → 1234 is unique.
    const randomSpy = jest.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(3513 / 9000); // floor(1000 + 3513) = 4513
    randomSpy.mockReturnValueOnce(234 / 9000); // floor(1000 + 234) = 1234
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(screen.getByText("STORY-1234: Add tooltip")).toBeInTheDocument();
    expect(randomSpy).toHaveBeenCalledTimes(2);
    randomSpy.mockRestore();
  });

  test("full-name collision check prevents adding task with identical full name", () => {
    // Seed with a specific task
    const customTasks = [
      { name: "STORY-2000: Same title", category: "wip", bgcolor: "lightgreen" },
    ];
    localStorage.setItem("kanban-tasks", JSON.stringify(customTasks));
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Same title" },
    });
    // Mock: first random → 2000 (would create STORY-2000: Same title = exact duplicate full name)
    // second → 3000 (unique)
    const randomSpy = jest.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(1000 / 9000); // floor(1000 + 1000) = 2000 → full name collision
    randomSpy.mockReturnValueOnce(2000 / 9000); // floor(1000 + 2000) = 3000 → unique
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(screen.getByText("STORY-3000: Same title")).toBeInTheDocument();
    expect(randomSpy).toHaveBeenCalledTimes(2);
    randomSpy.mockRestore();
  });
});

/* Req 5 – Editing to a duplicate name must revert */
describe("Requirement 5 – Inline edit via double-click", () => {
  test("editing to a name that would duplicate another task reverts silently", () => {
    // Seed with two tasks sharing the same STORY prefix but different suffixes
    const customTasks = [
      { name: "STORY-1000: Alpha", category: "wip", bgcolor: "lightgreen" },
      { name: "STORY-1000: Beta", category: "wip", bgcolor: "lightgreen" },
    ];
    localStorage.setItem("kanban-tasks", JSON.stringify(customTasks));
    render(<App />);
    // Edit Alpha → "Beta" would create "STORY-1000: Beta" (duplicate)
    const card = screen.getByText("STORY-1000: Alpha").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Should revert — both tasks remain unchanged
    expect(screen.getByText("STORY-1000: Alpha")).toBeInTheDocument();
    expect(screen.getByText("STORY-1000: Beta")).toBeInTheDocument();
  });
});

/* Req 6 – Blur with empty value must revert */
describe("Requirement 6 – Edit save/cancel/revert behaviour", () => {
  test("blur on edit input with empty value reverts to original", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(screen.getByText("STORY-4513: Add tooltip")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-input")).not.toBeInTheDocument();
  });
});

/* Req 7 – Delete × visibility on hover */
describe("Requirement 7 – Delete with confirmation", () => {
  test("delete × is hidden by default (display: none inline style)", () => {
    render(<App />);
    const deleteBtn = screen.getByTestId("delete-btn-STORY-4513: Add tooltip");
    expect(deleteBtn.style.display).toBe("none");
  });

  test("hover CSS rule exists to show delete × on card hover", () => {
    render(<App />);
    const styleTag = document.querySelector("style");
    expect(styleTag).not.toBeNull();
    expect(styleTag.textContent).toContain(".task-card:hover .delete-x");
    expect(styleTag.textContent).toContain("display: block");
  });
});

/* Req 8 – dragstart on delete must be stopped and prevented,
   and end-to-end drag from delete button must not move the card */
describe("Requirement 8 – No drag on delete, priority display", () => {
  test("dragstart event on delete button is stopped and prevented", () => {
    render(<App />);
    const deleteBtn = screen.getByTestId("delete-btn-STORY-4513: Add tooltip");
    const dragEvt = new Event("dragstart", { bubbles: true, cancelable: true });
    const stopSpy = jest.spyOn(dragEvt, "stopPropagation");
    const preventSpy = jest.spyOn(dragEvt, "preventDefault");
    deleteBtn.dispatchEvent(dragEvt);
    expect(stopSpy).toHaveBeenCalled();
    expect(preventSpy).toHaveBeenCalled();
  });

  test("full drag interaction starting from delete button does not move the card", () => {
    render(<App />);
    const deleteBtn = screen.getByTestId("delete-btn-STORY-4513: Add tooltip");
    const target = screen.getByTestId("column-complete");
    // Simulate drag starting from delete button
    const data = {};
    const dt = {
      setData: (k, v) => { data[k] = v; },
      getData: (k) => data[k] || "",
    };
    const startEvt = new Event("dragstart", { bubbles: true, cancelable: true });
    Object.defineProperty(startEvt, "dataTransfer", { value: dt });
    act(() => { deleteBtn.dispatchEvent(startEvt); });
    // dragstart is prevented, so dataTransfer.setData should NOT have been called
    // with the task name — data bag should be empty
    expect(data["id"]).toBeUndefined();
    // Card stays in wip
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4513: Add tooltip");
    expect(task.category).toBe("wip");
  });
});

/* Req 9 – Context menu must not interfere with drag */
describe("Requirement 9 – Context menu for priority change", () => {
  test("drag-and-drop still works after context menu opened and closed", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    // Open and close context menu
    fireEvent.contextMenu(card);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    // Card is still draggable
    expect(card.getAttribute("draggable")).toBe("true");
    // Simulate drag-and-drop to completed column
    const target = screen.getByTestId("column-complete");
    simulateDragDrop(card, target);
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4513: Add tooltip");
    expect(task.category).toBe("complete");
  });

  test("right-click does not set draggable to false", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    expect(card.getAttribute("draggable")).toBe("true");
  });

  test("drag works on a different card while context menu is open on another", () => {
    render(<App />);
    const card1 = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    const card2 = screen.getByText("STORY-4525: New filter option").closest(".task-card");
    // Open context menu on card1
    fireEvent.contextMenu(card1);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    // card2 should still be draggable
    expect(card2.getAttribute("draggable")).toBe("true");
    // drag card2 from complete to wip
    const wipColumn = screen.getByTestId("column-wip");
    simulateDragDrop(card2, wipColumn);
    const stored = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = stored.find((t) => t.name === "STORY-4525: New filter option");
    expect(task.category).toBe("wip");
  });
});

/* Req 10 – Move (drag-and-drop) persistence to localStorage */
describe("Requirement 10 – Context menu close & localStorage writes", () => {
  test("move via drag-and-drop persists category change to localStorage", () => {
    render(<App />);
    // Verify initial state
    const before = JSON.parse(localStorage.getItem("kanban-tasks"));
    expect(before.find((t) => t.name === "STORY-4513: Add tooltip").category).toBe("wip");
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    const target = screen.getByTestId("column-complete");
    simulateDragDrop(card, target);
    // Verify localStorage updated
    const after = JSON.parse(localStorage.getItem("kanban-tasks"));
    const task = after.find((t) => t.name === "STORY-4513: Add tooltip");
    expect(task.category).toBe("complete");
  });
});

/* Req 13 – Tab focus trapping inside modal */
describe("Requirement 13 – Keyboard interactions", () => {
  test("Tab on last modal element wraps focus to first element", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    const cancelBtn = screen.getByTestId("add-cancel-btn");
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
    fireEvent.keyDown(cancelBtn, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("add-title-input"));
  });

  test("Shift+Tab on first modal element wraps focus to last element", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    const titleInput = screen.getByTestId("add-title-input");
    titleInput.focus();
    expect(document.activeElement).toBe(titleInput);
    fireEvent.keyDown(titleInput, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("add-cancel-btn"));
  });

  test("Tab trapping in delete confirmation dialog", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    const noBtn = screen.getByTestId("delete-no");
    noBtn.focus();
    expect(document.activeElement).toBe(noBtn);
    fireEvent.keyDown(noBtn, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("delete-yes"));
  });

  test("Shift+Tab trapping in delete confirmation dialog", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    const yesBtn = screen.getByTestId("delete-yes");
    yesBtn.focus();
    expect(document.activeElement).toBe(yesBtn);
    fireEvent.keyDown(yesBtn, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("delete-no"));
  });
});

/* Req 15 – Additional console checks: priority, drag, localStorage error */
describe("Requirement 15 – No console errors or warnings", () => {
  test("no console.error when changing priority", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.error during drag-and-drop move", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    const target = screen.getByTestId("column-complete");
    simulateDragDrop(card, target);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.error when localStorage throws during priority change", () => {
    render(<App />);
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.warn when adding task", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: "Warn check" },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("no console.warn when editing task", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "Warn test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("no console.warn when deleting task", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByTestId("delete-btn-STORY-4513: Add tooltip"));
    fireEvent.click(screen.getByTestId("delete-yes"));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("no console.warn when changing priority", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByTestId("ctx-high"));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("no console.warn during drag-and-drop move", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    const target = screen.getByTestId("column-complete");
    simulateDragDrop(card, target);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

/* ================================================================
   Req 4/11 – localStorage rejects objects with extra top-level fields
   ================================================================ */
describe("Requirement 4 – Task shape rejects extra fields", () => {
  test("uses default seed if localStorage tasks have extra top-level fields", () => {
    localStorage.setItem(
      "kanban-tasks",
      JSON.stringify([
        { name: "STORY-9999: Extra", category: "wip", bgcolor: "lightgreen", extra: "field" },
      ])
    );
    render(<App />);
    // Extra-field object rejected → defaults shown
    DEFAULT_TASK_NAMES.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test("accepts tasks with exactly 3 valid keys", () => {
    localStorage.setItem(
      "kanban-tasks",
      JSON.stringify([
        { name: "STORY-8000: Exact shape", category: "wip", bgcolor: "lightgreen" },
      ])
    );
    render(<App />);
    expect(screen.getByText("STORY-8000: Exact shape")).toBeInTheDocument();
  });
});

/* ================================================================
   Req 12 – All layout styles inline (no CSS class rules)
   ================================================================ */
describe("Requirement 12 – Inline styling completeness", () => {
  test("task card position: relative is set via inline style", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    expect(card.style.position).toBe("relative");
  });

  test("no layout CSS classes remain as classNames on wrapper divs", () => {
    render(<App />);
    // Container should not use the old CSS class
    const container = screen.getByTestId("app-container");
    expect(container.className).toBe("");
    // Board
    const board = screen.getByTestId("board");
    expect(board.className).toBe("");
  });
});

/* ================================================================
   Edge Case B – Large-input coverage
   ================================================================ */
describe("Edge Case B – Large input handling", () => {
  test("adding a task with a very long title (1000 chars) works", () => {
    render(<App />);
    const longTitle = "A".repeat(1000);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: longTitle },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(screen.queryByTestId("add-modal")).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(longTitle))).toBeInTheDocument();
  });

  test("editing a task to a very long title (1000 chars) works", () => {
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    const longTitle = "B".repeat(1000);
    fireEvent.change(input, { target: { value: longTitle } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(new RegExp("STORY-4513: " + longTitle))).toBeInTheDocument();
  });

  test("no console.error with very long title add", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const longTitle = "C".repeat(2000);
    fireEvent.click(screen.getByTestId("add-task-wip"));
    fireEvent.change(screen.getByTestId("add-title-input"), {
      target: { value: longTitle },
    });
    fireEvent.click(screen.getByTestId("add-submit-btn"));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("no console.error with very long title edit", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const card = screen.getByText("STORY-4513: Add tooltip").closest(".task-card");
    fireEvent.doubleClick(card);
    const input = screen.getByTestId("edit-input");
    fireEvent.change(input, { target: { value: "D".repeat(2000) } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
