import React from "react";
import "./BoardCommentsDrawer.css";

export default function BoardCommentsDrawer({
  open,
  onClose,
  children,
  width = 720,
  title = "Board comments",
  className = "",
}) {
  return (
    <>
      <div className={`pp-drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside
        className={`pp-drawer gphotos ${className} ${open ? "open" : ""}`}
        style={{ width: typeof width === "number" ? `${width}px` : width }}
        role="dialog"
        aria-hidden={!open}
      >
        <div className="pp-drawer-header">
          <div className="pp-drawer-title">{title}</div>
          <button className="pp-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pp-drawer-body">
          {children}
        </div>
      </aside>
    </>
  );
}