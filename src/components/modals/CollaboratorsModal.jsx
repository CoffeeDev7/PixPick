import React, { useEffect, useRef } from "react";

const CollaboratorsModal = ({ isOpen, onClose, collaboratorProfiles }) => {
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    const onPointer = (e) => {
      const dialog = dialogRef.current;
      const overlay = overlayRef.current;
      if (!dialog || !overlay) return;

      if (e.target === overlay || !dialog.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 12, 18, 0.45)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        onClick={() => onClose()}
        role="dialog"
        aria-modal="true"
        aria-label="Collaborators"
        style={{
          width: "90%",
          maxWidth: "540px",
          // Increased opacity so the card is more visible
          background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 14px 48px rgba(2,6,23,0.66)",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          cursor: "pointer",
          color: "#e6eefb",
          transform: "translateY(0)",
          transition: "transform 160ms ease, opacity 160ms ease",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
            userSelect: "none",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Collaborators</h3>
          <button
            onClick={(e) => {
              e.stopPropagation(); // keep single onClose call if desired
              onClose();
            }}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {collaboratorProfiles.map((profile) => (
            <div
              key={profile.uid}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px",
                borderRadius: "12px",
                // less translucent (more visible) row background
                background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.09))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 14px rgba(2,6,23,0.12)",
              }}
            >
              <img
                src={profile.photoURL || "/public/eat (1).png"}
                alt={profile.displayName || "Unknown User"}
                style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#0f1724" }}>
                  {profile.displayName || "Unknown User"}
                </div>
                <div style={{ fontSize: "13px", color: "#334155", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {profile.email || "No email provided"}
                </div>
              </div>
              <span
                title="Online"
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "limegreen",
                  boxShadow: "0 0 8px rgba(50,205,50,0.14)",
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollaboratorsModal;
// Collaborators modal with improved visibility and user experience