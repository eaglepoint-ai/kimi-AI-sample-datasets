import React from "react";
import { priorityDotColor } from "../../utils/helpers";

/**
 * Individual task card with drag, inline edit, delete control,
 * context menu, and priority dot.
 */
function TaskCard({
  task,
  isEditing,
  editValue,
  onEditValueChange,
  onDoubleClick,
  onCommitEdit,
  onCancelEdit,
  onDeleteClick,
  onContextMenu,
  onDragStart,
}) {
  return (
    <div
      key={task.name}
      data-testid={`task-card-${task.name}`}
      onDragStart={(e) => {
        if (isEditing) {
          e.preventDefault();
          return;
        }
        onDragStart(e, task.name);
      }}
      draggable={!isEditing}
      className="task-card"
      style={{
        backgroundColor: task.bgcolor,
        position: "relative",
        height: 50,
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 5,
        padding: 5,
      }}
      onDoubleClick={() => {
        if (!isEditing) onDoubleClick(task.name);
      }}
      onContextMenu={(e) => onContextMenu(e, task.name)}
    >
      {/* Priority dot */}
      <span
        data-testid={`priority-dot-${task.name}`}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: priorityDotColor(task.bgcolor),
          display: "inline-block",
          marginRight: 6,
          flexShrink: 0,
        }}
      />

      {isEditing ? (
        <input
          data-testid="edit-input"
          autoFocus
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onCommitEdit}
          style={{ flex: 1 }}
        />
      ) : (
        <span style={{ flex: 1 }}>{task.name}</span>
      )}

      {/* Delete button */}
      {!isEditing && (
        <span
          data-testid={`delete-btn-${task.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(task.name);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          style={{
            position: "absolute",
            top: 2,
            right: 6,
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: 14,
            display: "none",
          }}
          className="delete-x"
        >
          ×
        </span>
      )}
    </div>
  );
}

export default TaskCard;
