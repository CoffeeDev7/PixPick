
// ...existing code...
export const SettingsModal = ({ open, setOpen,settings, setSettings }) => {
  if (!open) return null;

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const humanize = (k) =>
    k
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (s) => s.toUpperCase());

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(10,11,12,0.48)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    padding: 20,
  };

  const cardStyle = {
    width: 360,
    maxWidth: "100%",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 10px 30px rgba(2,6,23,0.18)",
    padding: 18,
    color: "#0b1220",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    maxHeight: "86vh",
    overflowY: "auto",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  };

  const titleStyle = {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: -0.2,
  };

  const hintStyle = {
    fontSize: 12,
    color: "#556074",
  };

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 6px",
    borderRadius: 10,
  };

  const labelStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const nameStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: "#0b1220",
  };

  const descStyle = {
    fontSize: 12,
    color: "#627085",
  };

  const toggleButtonStyle = (on) => ({
    width: 48,
    height: 28,
    borderRadius: 999,
    padding: 3,
    display: "flex",
    alignItems: "center",
    background: on ? "linear-gradient(90deg,#17a2b8,#2b5fa8)" : "rgba(9,12,18,0.06)",
    border: on ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(2,6,23,0.06)",
    boxShadow: on ? "0 6px 16px rgba(41,122,188,0.12)" : "none",
    cursor: "pointer",
    transition: "background .22s ease, box-shadow .22s ease",
    position: "relative",
    outline: "none",
  });

  const knobStyle = (on) => ({
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#fff",
    boxShadow: "0 6px 12px rgba(3,10,18,0.12)",
    transform: `translateX(${on ? 20 : 0}px)`,
    transition: "transform .18s cubic-bezier(.2,.9,.2,1)",
  });

  return (
    <div style={overlayStyle}  onClick={() => setOpen(false)}   aria-modal="true" role="dialog" aria-label="Settings" >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h3 style={titleStyle}>Settings</h3>
            <div style={hintStyle}>Toggle preferences for this board</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }} >
          {Object.keys(settings).map((key) => {
            const on = Boolean(settings[key]);
            return (
              <div key={key} style={rowStyle}>
                <div style={labelStyle}>
                  <div style={nameStyle}>{humanize(key)}</div>
                  <div style={descStyle}>
                    {key === "darkMode"
                      ? "Enable dark UI"
                      : key === "animateEnabled"
                      ? "Animate thumbnails and transitions"
                      : key === "showCaptions"
                      ? "Show captions under images"
                      : ""}
                  </div>
                </div>

                <button
                  aria-pressed={on}
                  onClick={() => toggleSetting(key)}
                  title={on ? "On" : "Off"}
                  style={toggleButtonStyle(on)}
                >
                  <div style={knobStyle(on)} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Changes are saved locally</div>
        </div>
      </div>
    </div>
  );
};
// ...existing code...