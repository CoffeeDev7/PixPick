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
      if (e.target === overlay || !dialog.contains(e.target)) onClose();
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
        // a touch darker so cards pop more
        background: "rgba(6,9,14,0.64)",
        backdropFilter: "blur(12px) saturate(150%)",
        WebkitBackdropFilter: "blur(12px) saturate(150%)",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        onClick={() => onClose()} // keeps your "click panel closes" behavior
        role="dialog"
        aria-modal="true"
        aria-label="Collaborators"
        style={{
          width: "90%",
          maxWidth: "560px",
          // stronger frosted card so it reads well
          background: "linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.14))",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 18px 60px rgba(2,6,23,0.72)",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          cursor: "pointer",
          color: "#071026", // darker text for contrast
          transition: "transform 160ms ease, opacity 160ms ease",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid rgba(2,6,23,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.12))",
            userSelect: "none",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Collaborators</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
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
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxHeight: "72vh",
            overflowY: "auto",
          }}
        >
          {collaboratorProfiles.map((profile) => (
            <div
              key={profile.uid}
              // If you ever want this row to NOT close the modal on click, add onClick={(e)=>e.stopPropagation()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px",
                borderRadius: "12px",
                // noticeably more opaque and with contrast border + elevated shadow
                background: "linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,255,255,0.52))",
                border: "1px solid rgba(10,15,25,0.06)",
                boxShadow: "0 8px 22px rgba(2,6,23,0.10)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxShadow: "0 6px 16px rgba(2,6,23,0.12)",
                  border: "2px solid rgba(255,255,255,0.9)",
                }}
              >
                <img
                  src={profile.photoURL || "/public/eat (1).png"}
                  alt={profile.displayName || "Unknown User"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#071026",
                  }}
                >
                  {profile.displayName || "Unknown User"}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.email || "No email provided"}
                </div>
              </div>

              <span
                title="Online"
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: profile.status === "online" ? "#16a34a" : "#94a3b8",
                  boxShadow: profile.status === "online" ? "0 0 8px rgba(22,163,74,0.14)" : "none",
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
