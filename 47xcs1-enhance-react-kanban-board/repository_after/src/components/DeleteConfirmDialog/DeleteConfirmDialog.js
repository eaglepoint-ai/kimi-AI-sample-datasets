import React, { useRef } from "react";

/**
 * Confirmation dialog for deleting a task.
 * Shows "Delete this task?" with Yes / No buttons.
 * Outside-click on overlay cancels.
 */
function DeleteConfirmDialog({ onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  return (
    <div
      data-testid="delete-confirm-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
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
        zIndex: 1001,
      }}
    >
      <div
        data-testid="delete-confirm-dialog"
        ref={dialogRef}
        style={{
          backgroundColor: "white",
          padding: 20,
          borderRadius: 8,
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab" && dialogRef.current) {
            const focusable = dialogRef.current.querySelectorAll("button");
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
        <p>Delete this task?</p>
        <button data-testid="delete-yes" autoFocus onClick={onConfirm}>
          Yes
        </button>
        <button
          data-testid="delete-no"
          onClick={onCancel}
          style={{ marginLeft: 8 }}
        >
          No
        </button>
      </div>
    </div>
  );
}

export default DeleteConfirmDialog;
