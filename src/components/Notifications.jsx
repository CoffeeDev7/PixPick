// Notifications.jsx — polished + gradients + confetti + incoming accent animation
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

/**
 * Notes:
 * - This component keeps Firestore logic intact.
 * - It adds a canvas-based confetti (lightweight) that triggers on markAllRead.
 * - When new notifications arrive, their left accent animates briefly.
 * - All styles are inline; a small <style> block is used to inject keyframes.
 */

export default function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [toast, setToast] = useState(null); // { text, type }
  const navigate = useNavigate();

  // For accent animation when new notifications appear
  const animatingIdsRef = useRef(new Set());
  const prevIdsRef = useRef([]);

  // confetti control
  const confettiRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // detect newly added ids (present in docs but not in prev)
      const newIds = docs
        .map((d) => d.id)
        .filter((id) => !prevIdsRef.current.includes(id));

      if (newIds.length) {
        // add them to animating set for short period
        newIds.forEach((id) => animatingIdsRef.current.add(id));
        // schedule removal after animation (2.4s)
        setTimeout(() => {
          newIds.forEach((id) => animatingIdsRef.current.delete(id));
          // force rerender to clear animation states
          setNotifications((prev) => [...prev]);
        }, 2400);
      }

      prevIdsRef.current = docs.map((d) => d.id);
      setNotifications(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // helper: friendly relative time string
  function timeAgo(ts) {
    if (!ts) return "";
    const ms =
      typeof ts?.toDate === "function"
        ? ts.toDate().getTime()
        : ts?.seconds
        ? ts.seconds * 1000
        : Date.parse(ts) || Date.now();
    const diffMin = Math.round((Date.now() - ms) / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h`;
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---------- lightweight canvas confetti ----------
  function launchConfetti() {
    if (!confettiRef.current) return;
    confettiRef.current.burst();
  }

  // Confetti engine: simple particle burst for ~1800ms
  function ConfettiCanvas() {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const particlesRef = useRef([]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);
      const DPR = window.devicePixelRatio || 1;
      canvas.width = width * DPR;
      canvas.height = height * DPR;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.scale(DPR, DPR);

      function resize() {
        width = canvas.width = window.innerWidth * DPR;
        height = canvas.height = window.innerHeight * DPR;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        ctx.scale(DPR, DPR);
      }
      window.addEventListener("resize", resize);

      function render() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        const now = Date.now();
        particlesRef.current = particlesRef.current.filter((p) => {
          const life = (now - p.t0) / p.ttl;
          if (life >= 1) return false;
          // physics
          p.vy += 0.06 * p.mass; // gravity
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.vr;
          // draw
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = 1 - life * 0.85;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
          return true;
        });
        rafRef.current = requestAnimationFrame(render);
      }

      rafRef.current = requestAnimationFrame(render);

      return () => {
        window.removeEventListener("resize", resize);
        cancelAnimationFrame(rafRef.current);
      };
    }, []);

    // burst controller
    function burst() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = Math.max(h * 0.15, 80);
      const colors = ["#1B99BF", "#57AD C7".replace(" ", ""), "#EE6C4D", "#FFD166", "#8ACDEA"];
      const count = 36 + Math.round(Math.random() * 20);
      const now = Date.now();
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 4 + Math.random() * 8;
        const size = 6 + Math.random() * 10;
        const p = {
          x: cx + (Math.random() - 0.5) * 80,
          y: cy + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed * (0.7 + Math.random() * 0.8),
          vy: Math.sin(angle) * speed * (0.7 + Math.random() * 0.8) - 2.2,
          vr: (Math.random() - 0.5) * 0.4,
          rotation: Math.random() * Math.PI,
          size,
          color: ["#1B99BF", "#57AD C7".replace(" ", ""), "#EE6C4D", "#FFD166", "#8ACDEA"][
            Math.floor(Math.random() * 5)
          ],
          t0: now,
          ttl: 1600 + Math.random() * 800,
          mass: 0.8 + Math.random() * 1.4,
        };
        particlesRef.current.push(p);
      }

      // automatically stop after a while (particles cleanup is in render)
    }

    // expose burst method to parent via ref
    useEffect(() => {
      confettiRef.current = { burst };
      return () => {
        confettiRef.current = null;
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1200,
        }}
      />
    );
  }

  // ---------- Mark all read with confetti + toast ----------
  async function markAllRead() {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) {
      setToast({ text: "Nothing unread", type: "info" });
      setTimeout(() => setToast(null), 1800);
      return;
    }
    setMarkAllLoading(true);
    try {
      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, "users", user.uid, "notifications", n.id), {
            read: true,
          })
        )
      );
      // success UI
      setToast({ text: "All marked read", type: "success" });
      launchConfetti();
      setTimeout(() => setToast(null), 2800);
    } catch (err) {
      console.error("markAllRead error", err);
      setToast({ text: "Something went wrong", type: "error" });
      setTimeout(() => setToast(null), 2400);
    } finally {
      setMarkAllLoading(false);
    }
  }

  async function openNotification(n) {
    if (!user) return;
    try {
      if (!n.read) {
        await updateDoc(
          doc(db, "users", user.uid, "notifications", n.id),
          { read: true }
        );
      }
    } catch (err) {
      console.error("mark read error", err);
    }

    if (n.url) navigate(n.url);
    else if (n.boardId) navigate(`/board/${n.boardId}`);
    else return;
  }

  // ---------- Styles (inline) ----------
  const page = {
    maxWidth: 1080,
    margin: "28px auto",
    padding: 20,
    borderRadius: 16,
    // soft sunrise gradient background
    boxShadow: "0 12px 42px rgba(12,14,20,0.08)",
    position: "relative",
    background: "linear-gradient(135deg, rgba(190,223,224,1) 0%, rgba(217,238,241,0.9) 50%, rgba(255,255,255,0.98) 100%)",  
  };

  const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };

  const title = {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.2px",
    color: "#052229",
  };

  const actions = { display: "flex", alignItems: "center", gap: 10 };

  const markButton = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background:
      "linear-gradient(90deg, rgba(27,153,159,1) 0%, rgba(27,121,170,1) 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 8px 22px rgba(27,153,159,0.14)",
  };

  const unreadCount = { color: "#0b7280", fontWeight: 700, fontSize: 13 };

  const list = { marginTop: 18, display: "flex", flexDirection: "column", gap: 12 };

  const notifBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    transition: "box-shadow 180ms ease, transform 180ms ease, background 180ms ease",
    cursor: "default",
    background: "linear-gradient(180deg,#ffffff,#fbfdff)", // read default is soft white
    border: "1px solid rgba(6,12,18,0.04)",
  };

  const notifHover = { boxShadow: "0 18px 46px rgba(8,10,14,0.08)" };

  const leftContent = { display: "flex", alignItems: "flex-start", gap: 12, flex: 1 };

  const accentBase = {
    width: 8,
    height: 56,
    borderRadius: 8,
    flexShrink: 0,
    marginTop: 6,
    transition: "transform 300ms ease, opacity 300ms ease",
  };

  const accentAnimatedStyle = {
    animation: "notif-accent-pulse 900ms ease-in-out, notif-accent-slide 1200ms ease-out",
  };

  const meta = { fontSize: 13, color: "#7b8b96", marginTop: 8 };

  const controls = { display: "flex", gap: 8, alignItems: "center" };

  const ghostBtn = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(12,14,16,0.06)",
    background: "transparent",
    cursor: "pointer",
  };

  // Inject keyframes via style tag — this is the best way to keep everything self-contained
  const keyframes = `
  @keyframes notif-accent-pulse {
    0% { transform: scaleY(1); filter: hue-rotate(0deg); opacity: 1; }
    40% { transform: scaleY(1.28); filter: hue-rotate(12deg); opacity: 1; }
    100% { transform: scaleY(1); filter: hue-rotate(0deg); opacity: 1; }
  }
  @keyframes notif-accent-slide {
    0% { transform: translateX(-6px); opacity: 0; }
    20% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(0); opacity: 1; }
  }
  @keyframes toast-in {
    0% { transform: translateY(12px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes toast-out {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(12px); opacity: 0; }
  }
  `;

  // ---------- small helper renderers ----------
  const renderAccent = (isUnread, id) => {
    const base = {
      ...accentBase,
      background: "linear-gradient(180deg, #1B99BF 0%, #EE6C4D 100%)",
      boxShadow: isUnread ? "0 8px 26px rgba(27,153,159,0.12)" : "none",
      opacity: isUnread ? 1 : 0.18,
    };
    const isAnimating = animatingIdsRef.current.has(id);
    return <div style={{ ...(base || {}), ...(isAnimating ? accentAnimatedStyle : {}) }} />;
  };

  // ---------- render ----------
  return (
    <div style={page}>
      {/* keyframes injected - helps keep the animations inline without CSS file */}
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* Confetti canvas (hidden until burst) */}
      <ConfettiCanvas />

      <div style={header}>
        <h2 style={title}>Notifications</h2>

        <div style={actions}>
          <div style={unreadCount}>{notifications.filter((n) => !n.read).length} unread</div>

          <button
            onClick={markAllRead}
            style={{
              ...markButton,
              opacity: markAllLoading ? 0.8 : 1,
              pointerEvents: markAllLoading ? "none" : "auto",
            }}
            disabled={markAllLoading || notifications.filter((n) => !n.read).length === 0}
            title="Mark all notifications as read"
          >
            {markAllLoading ? "Marking..." : "Mark all read"}
          </button>
        </div>
      </div>

      {/* subtle subtitle */}
      <div style={{ marginTop: 8, color: "#6b7280" }}>
        Activity on your boards, mentions, and shares. New items animate briefly.
      </div>

      <div style={list}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ ...notifBase, minHeight: 76, background: "linear-gradient(180deg,#fbfdff,#f6fbff)" }}>
                <div style={{ flex: 1, height: 56, borderRadius: 10, background: "#eef6fa" }} />
              </div>
            ))}
          </>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 28, borderRadius: 12, background: "linear-gradient(180deg,#ffffff,#f6fbff)", textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#052229" }}>You're all caught up</div>
            <div style={{ marginTop: 8 }}>No notifications right now — relax, sip tea ☕</div>
          </div>
        ) : (
          notifications.map((n) => {
            const isUnread = !n.read;
            const isHovered = hoveredId === n.id;
            const baseStyle = {
              ...notifBase,
              ...(isUnread ? { background: "linear-gradient(90deg, rgba(245,255,255,1), rgba(255,255,255,1))" } : {}),
              ...(isHovered ? notifHover : {}),
              transform: isHovered ? "translateY(-6px)" : "none",
              cursor: "pointer",
            };

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(n.id)}
                onBlur={() => setHoveredId(null)}
                style={baseStyle}
              >
                <div style={leftContent} onClick={() => openNotification(n)} aria-hidden>
                  {renderAccent(isUnread, n.id)}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 800, color: "#052229" }}>{(n.type || "Activity").replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 13, color: "#7b8b96" }}>{timeAgo(n.createdAt)}</div>
                    </div>

                    <div style={{ marginTop: 8, color: "#0b1220", fontSize: 15 }}>{n.text}</div>

                    <div style={meta}>
                      {n.boardId ? `Board: ${n.boardTitle || n.boardId}` : null}
                    </div>
                  </div>
                </div>

                <div style={controls}>
                  {!n.read ? (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await openNotification(n);
                      }}
                      style={{ ...markButton, padding: "8px 10px", fontSize: 13 }}
                    >
                      Open
                    </button>
                  ) : null}

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await updateDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true });
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    style={ghostBtn}
                  >
                    {n.read ? "Read" : "Mark"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Toast (top-right of page) */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 24,
            top: 28,
            zIndex: 1300,
            padding: "10px 14px",
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(8,10,14,0.12)",
            color: toast.type === "success" ? "#013f2d" : toast.type === "error" ? "#4a1212" : "#083e56",
            background:
              toast.type === "success"
                ? "linear-gradient(90deg,#eafff5,#d7fff0)"
                : toast.type === "error"
                ? "linear-gradient(90deg,#fff1f1,#ffecec)"
                : "linear-gradient(90deg,#f0fbff,#eef9ff)",
            border: "1px solid rgba(8,20,24,0.04)",
            animation: "toast-in 260ms ease",
          }}
        >
          <div style={{ fontWeight: 700 }}>{toast.text}</div>
        </div>
      )}
    </div>
  );
}

/* Small ConfettiCanvas component (redeclared inside file to keep everything single-file) */
function ConfettiCanvas() {
  // this is a light wrapper that the parent code expects to be available via confettiRef.
  // Implementation moved inside same file earlier in the parent for clarity.
  // We'll simply render a canvas and rely on the parent to attach behavior via global confettiRef.
  // To avoid duplicate code, reuse the ConfettiCanvas declared in parent via closure — but since we
  // defined a ConfettiCanvas in the parent scope, using this placeholder keeps the transpiler happy in this single-file snippet.
  // In the final bundle the parent ConfettiCanvas handles the drawing and exposes .burst().
  return null;
}
