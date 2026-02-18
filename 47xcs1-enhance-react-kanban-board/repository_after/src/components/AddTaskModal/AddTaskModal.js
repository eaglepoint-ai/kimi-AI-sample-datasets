import React, { useRef } from "react";

/**
 * Modal dialog for adding a new task to a column.
 * Renders Title input + Priority select.
 */
function AddTaskModal({
  category,
  title,
  description,
  priority,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onSubmit,
  onClose,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);

  const categoryLabel = category === "wip" ? "In-Progress" : "Completed";

  return (
    <div
      data-testid="add-modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        data-testid="add-modal"
        ref={modalRef}
        style={{
          backgroundColor: "white",
          padding: 20,
          borderRadius: 8,
          minWidth: 300,
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Tab" && modalRef.current) {
            const focusable = modalRef.current.querySelectorAll(
              "input, select, button"
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <h3>Add Task ({categoryLabel})</h3>
        <div style={{ marginBottom: 10 }}>
          <label>
            Title (required):{" "}
            <input
              data-testid="add-title-input"
              autoFocus
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>
            Description (optional):{" "}
            <input
              data-testid="add-description-input"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>
            Priority:{" "}
            <select
              data-testid="add-priority-select"
              value={priority}
              onChange={(e) => onPriorityChange(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
        </div>
        <button data-testid="add-submit-btn" onClick={onSubmit}>
          Submit
        </button>
        <button
          data-testid="add-cancel-btn"
          onClick={onClose}
          style={{ marginLeft: 8 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AddTaskModal;
