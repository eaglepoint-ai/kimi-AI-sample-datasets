import React from "react";
import TaskCard from "../TaskCard/TaskCard";

/**
 * A single Kanban column (In-Progress or Completed).
 * Accepts drops and renders an "Add Task" button + task cards.
 */
function Column({
  category,
  label,
  tasks,
  editingName,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDeleteClick,
  onContextMenu,
  onDragStart,
  onDrop,
  onOpenAddModal,
}) {
  return (
    <div
      data-testid={`column-${category}`}
      className={category === "wip" ? "wip" : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, category)}
    >
      <div style={{ margin: 10, textDecoration: "underline", fontSize: "1rem" }}>
        {label}
        <button
          data-testid={`add-task-${category}`}
          onClick={() => onOpenAddModal(category)}
          style={{ marginLeft: 8, cursor: "pointer" }}
        >
          Add Task
        </button>
      </div>
      {tasks
        .filter((t) => t.category === category)
        .map((t) => (
          <TaskCard
            key={t.name}
            task={t}
            isEditing={editingName === t.name}
            editValue={editValue}
            onEditValueChange={onEditValueChange}
            onDoubleClick={onStartEdit}
            onCommitEdit={onCommitEdit}
            onCancelEdit={onCancelEdit}
            onDeleteClick={onDeleteClick}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
          />
        ))}
    </div>
  );
}

export default Column;
