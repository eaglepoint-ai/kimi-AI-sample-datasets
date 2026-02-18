import React from "react";

/**
 * Right-click context menu for changing a task's priority.
 * Shows Low / Medium / High options.
 */
function ContextMenu({ x, y, onChoose }) {
  return (
    <div
      data-testid="context-menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: y,
        left: x,
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: 4,
        zIndex: 1002,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <div
        data-testid="ctx-low"
        onClick={() => onChoose("Low")}
        style={{ padding: "6px 16px", cursor: "pointer" }}
      >
        Low
      </div>
      <div
        data-testid="ctx-medium"
        onClick={() => onChoose("Medium")}
        style={{ padding: "6px 16px", cursor: "pointer" }}
      >
        Medium
      </div>
      <div
        data-testid="ctx-high"
        onClick={() => onChoose("High")}
        style={{ padding: "6px 16px", cursor: "pointer" }}
      >
        High
      </div>
    </div>
  );
}

export default ContextMenu;
