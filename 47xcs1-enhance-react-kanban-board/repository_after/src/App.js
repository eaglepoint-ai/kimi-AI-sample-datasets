import { useState, useEffect, useCallback } from "react";
import { PRIORITY_BGCOLOR } from "./constants";
import { generateStoryNumber } from "./utils/helpers";
import { useTasks } from "./hooks/useTasks";

import Column from "./components/Column/Column";
import AddTaskModal from "./components/AddTaskModal/AddTaskModal";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog/DeleteConfirmDialog";
import ContextMenu from "./components/ContextMenu/ContextMenu";

/* ── App ───────────────────────────────────────────────── */
function App() {
  const [tasks, setTasks] = useTasks();

  /* ── Drag‑and‑drop (original behaviour) ─────────────── */
  const onDragStart = (event, id) => {
    event.dataTransfer.setData("id", id);
  };

  const onDrop = (event, cat) => {
    const id = event.dataTransfer.getData("id");
    const newTasks = tasks.map((task) =>
      task.name === id ? { ...task, category: cat } : task
    );
    setTasks(newTasks);
  };

  /* ── Add‑task modal state ────────────────────────────── */
  const [addModal, setAddModal] = useState(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addPriority, setAddPriority] = useState("Low");

  const openAddModal = (category) => {
    setAddModal({ category });
    setAddTitle("");
    setAddDescription("");
    setAddPriority("Low");
  };

  const closeAddModal = () => setAddModal(null);

  const submitAdd = () => {
    const trimmed = addTitle.trim();
    if (!trimmed) return;
    const prefix = generateStoryNumber(tasks.map((t) => t.name), trimmed);
    const newName = `${prefix}: ${trimmed}`;
    setTasks((prev) => [
      ...prev,
      { name: newName, category: addModal.category, bgcolor: PRIORITY_BGCOLOR[addPriority] },
    ]);
    closeAddModal();
  };

  /* ── Inline edit state ───────────────────────────────── */
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (taskName) => {
    const colonIdx = taskName.indexOf(":");
    const suffix = colonIdx !== -1 ? taskName.slice(colonIdx + 1).trimStart() : taskName;
    setEditingName(taskName);
    setEditValue(suffix);
  };

  const commitEdit = useCallback(() => {
    if (editingName === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingName(null);
      setEditValue("");
      return;
    }
    const colonIdx = editingName.indexOf(":");
    const prefix = colonIdx !== -1 ? editingName.slice(0, colonIdx + 1) : editingName;
    const newName = `${prefix} ${trimmed}`;
    if (newName !== editingName && tasks.some((t) => t.name === newName)) {
      setEditingName(null);
      setEditValue("");
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.name === editingName ? { ...t, name: newName } : t))
    );
    setEditingName(null);
    setEditValue("");
  }, [editingName, editValue, tasks, setTasks]);

  const cancelEdit = () => {
    setEditingName(null);
    setEditValue("");
  };

  /* ── Delete confirmation state ───────────────────────── */
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const confirmDelete = (name) => setDeleteConfirm(name);

  const doDelete = () => {
    setTasks((prev) => prev.filter((t) => t.name !== deleteConfirm));
    setDeleteConfirm(null);
  };

  const cancelDelete = () => setDeleteConfirm(null);

  /* ── Context menu (priority) state ───────────────────── */
  const [contextMenu, setContextMenu] = useState(null);

  const openContextMenu = (e, name) => {
    e.preventDefault();
    setContextMenu({ name, x: e.clientX, y: e.clientY });
  };

  const choosePriority = (priority) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.name === contextMenu.name ? { ...t, bgcolor: PRIORITY_BGCOLOR[priority] } : t
      )
    );
    setContextMenu(null);
  };

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  /* ── Global listeners ────────────────────────────────── */
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (addModal) closeAddModal();
        if (contextMenu) closeContextMenu();
        if (editingName) cancelEdit();
        if (deleteConfirm) cancelDelete();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [addModal, contextMenu, editingName, deleteConfirm, closeContextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeContextMenu();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu, closeContextMenu]);

  /* ── Shared column props ─────────────────────────────── */
  const columnProps = {
    tasks,
    editingName,
    editValue,
    onEditValueChange: setEditValue,
    onStartEdit: startEdit,
    onCommitEdit: commitEdit,
    onCancelEdit: cancelEdit,
    onDeleteClick: confirmDelete,
    onContextMenu: openContextMenu,
    onDragStart,
    onDrop,
    onOpenAddModal: openAddModal,
  };

  return (
    <div data-testid="app-container" style={{ textAlign: "center", fontFamily: "monospace" }}>
      <h2 style={{ textDecorationLine: "underline", fontSize: "1.5rem" }}>JIRA BOARD: Sprint 21U</h2>
      <div data-testid="board" style={{ display: "flex", justifyContent: "space-around" }}>
        <Column category="wip" label="In-PROGRESS" {...columnProps} />
        <Column category="complete" label="COMPLETED" {...columnProps} />
      </div>

      {addModal && (
        <AddTaskModal
          category={addModal.category}
          title={addTitle}
          description={addDescription}
          priority={addPriority}
          onTitleChange={setAddTitle}
          onDescriptionChange={setAddDescription}
          onPriorityChange={setAddPriority}
          onSubmit={submitAdd}
          onClose={closeAddModal}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmDialog onConfirm={doDelete} onCancel={cancelDelete} />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onChoose={choosePriority}
        />
      )}

      {/* CSS for delete hover */}
      <style>{`
        .task-card:hover .delete-x {
          display: block !important;
        }
      `}</style>
    </div>
  );
}

export default App;
