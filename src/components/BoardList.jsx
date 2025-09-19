// BoardList.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

/* -------------------- BoardCard (top-level, memoized) -------------------- */
const BoardCard = React.memo(function BoardCard({ board, imgs = [], placeholder, timeAgoShort, density, setDensity }) {
  const navigate = useNavigate();

  const cardImgs = useMemo(() => [
    imgs[0] || placeholder,
    imgs[1] || placeholder,
    imgs[2] || placeholder,
  ], [imgs, placeholder]);

  const onCardClick = useCallback(() => {
    navigate(`/board/${board.id}`);
  }, [navigate, board.id]);

  const onCardKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCardClick();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open board ${board.title || "Untitled"}`}
      className="bp-card"
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "linear-gradient(180deg,#f6f8f9,#eef4f5)",
        boxShadow: "0 8px 20px rgba(11,22,28,0.8)",
        display: "grid",
        gridTemplateColumns: density==='many'? "1fr 80px" : "1fr 0px",
        gap: 0,
        cursor: "pointer",
      }}
    >
      {/* Left */}
      <div style={{ position: "relative", minHeight: 140 }}>
        <img
          src={cardImgs[0]}
          alt={board.title || "Board cover"}
          style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
        <div style={{
          position: "absolute", left: 8, bottom: 8, right: 8,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8
        }}>
          <div style={{ color: "#fff", textShadow: "0 4px 12px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
            <div style={{ fontWeight: 700, fontSize: 16, opacity: 0.7 }}>{board.title || "Untitled Board"}</div>
            <div style={{ fontSize: 12, opacity: 0.45 }}>
              {board.ownerDisplayName ? board.ownerDisplayName : (board.ownerId ? board.ownerId.slice(0, 6) : "owner")} ·{" "}
              {timeAgoShort(board.updatedAt || board.createdAt)}
            </div>
          </div>

          {/* commented out counts preserved */}
          {/* <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 13, background: "rgba(255,255,255,0.12)", padding: "6px 8px", borderRadius: 8, color: "#fff", fontWeight: 700 }}>
              {board.numImages ?? "—"} picks
            </div>
          </div> */}
        </div>
      </div>

      {/* Right (previews) */}
      <div style={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 0, flexDirection: "column", alignItems: "stretch" }}>
          {[1, 2].map((i) => (
            <img
              key={i}
              src={cardImgs[i]}
              alt={`preview ${i}`}
              style={{
                width: "100%",
                height: "100px",
                borderRadius: 1,
                overflow: "hidden",
                background: "#eee",
                objectFit: "cover",
                display: "block",
                cursor: "pointer"
              }}
              loading="lazy"
              // preview click no longer blocks navigation
              onClick={() => { /* retained hook if you later want swap behavior */ }}
            />
          ))}
        </div>
      </div>
    </div>
  );
},
/** custom comparator: only re-render when meaningful bits changed */
(prev, next) => {
  const pb = prev.board, nb = next.board;
  if (pb.id !== nb.id) return false;
  // shallow important field checks
  if ((pb.title || "") !== (nb.title || "")) return false;
  if ((pb.ownerDisplayName || "") !== (nb.ownerDisplayName || "")) return false;
  if ((pb.numImages || 0) !== (nb.numImages || 0)) return false;
  // compare updatedAt seconds if present
  const pSec = pb.updatedAt?.seconds || pb.createdAt?.seconds || 0;
  const nSec = nb.updatedAt?.seconds || nb.createdAt?.seconds || 0;
  if (pSec !== nSec) return false;
  // compare imgs array shallowly
  const pa = prev.imgs || [], na = next.imgs || [];
  if (pa.length !== na.length) return false;
  for (let i = 0; i < pa.length; i++) if (pa[i] !== na[i]) return false;

   // NEW: re-render when layout-affecting props change
  if ((prev.density || "") !== (next.density || "")) return false;
  if ((prev.placeholder || "") !== (next.placeholder || "")) return false;

  return true; // equal -> skip render
});

/* -------------------- BoardList (main) -------------------- */
export default function BoardList({ user, boardsCache, setBoardsCache, selected }) {
  const [boards, setBoards] = useState([]);
  const [latestboardimages, setLatestBoardImages] = useState({});
  const [loading, setLoading] = useState(true);

  // state for board card density
  const [density, setDensity] = useState('one'); //80px for many, 0px for single

  // Responsive window hook
  function useWindowSize() {
    const [size, setSize] = useState({
      width: typeof window !== "undefined" ? window.innerWidth : 1200,
      height: typeof window !== "undefined" ? window.innerHeight : 800,
    });
    useEffect(() => {
      const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);
    return size;
  }
  const { width } = useWindowSize();

  const columns = useMemo(() => {
    if (width < 640) return 1;
    if (width < 900) return 2;
    if (width < 1200) return 3;
    return 4;
  }, [width]);

  // keep your original boardsCache listener (unchanged)
  useEffect(() => {
    if (!user || boardsCache.length > 0) return;
    const unsub = onSnapshot(collection(db, "boards"), (snap) => {
      const temp = [];
      snap.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.ownerId === user.uid) temp.push(data);
      });
      setBoardsCache(temp);
    });
    return () => unsub();
  }, [user, boardsCache, setBoardsCache]);

  useEffect(() => {
    if (boardsCache.length > 0) setBoards(boardsCache);
  }, [boardsCache]);

  // listen to recent images for each board - only update state if imgs changed
  useEffect(() => {
    if (!user) return;
    const unsubs = [];
    const setIfChanged = (boardId, imgs) => {
      setLatestBoardImages(prev => {
        const prevImgs = prev[boardId] || [];
        if (prevImgs.length === imgs.length && imgs.every((v, i) => v === prevImgs[i])) return prev;
        return { ...prev, [boardId]: imgs };
      });
    };

    boards.forEach((board) => {
      const qImg = query(collection(db, "boards", board.id, "images"), orderBy("createdAt", "desc"), limit(3));
      const unsub = onSnapshot(qImg, (snap) => {
        const imgs = snap.docs.map((d) => d.data().src || "");
        setIfChanged(board.id, imgs);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [user, boards]);

  // boards/collaborator listener (kept mostly as-is)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let boardUnsub = null;
    const collabUnsubs = new Map();

    const startListening = () => {
      boardUnsub = onSnapshot(collection(db, "boards"), (boardsSnap) => {
        setLoading(false);
        const tempBoards = [];
        boardsSnap.forEach((boardDoc) => {
          const boardData = { id: boardDoc.id, ...boardDoc.data() };
          if (selected === "My Boards") {
            if (boardData.ownerId === user.uid) tempBoards.push(boardData);
          } else if (selected === "Shared with Me") {
            if (!collabUnsubs.has(boardDoc.id)) {
              const unsub = onSnapshot(collection(db, "boards", boardDoc.id, "collaborators"), (collabSnap) => {
                const isCollaborator = collabSnap.docs.some((c) => c.id === user.uid && c.data().role !== "owner");
                if (isCollaborator) {
                  setBoards((prev) => {
                    const withoutBoard = prev.filter((b) => b.id !== boardDoc.id);
                    return [...withoutBoard, boardData].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                  });
                } else {
                  setBoards((prev) => prev.filter((b) => b.id !== boardDoc.id));
                }
              });
              collabUnsubs.set(boardDoc.id, unsub);
            }
          } else if (selected === "All Boards") {
            if (boardData.ownerId === user.uid) tempBoards.push(boardData);
            if (!collabUnsubs.has(boardDoc.id)) {
              const unsub = onSnapshot(collection(db, "boards", boardDoc.id, "collaborators"), (collabSnap) => {
                const isCollaborator = collabSnap.docs.some((c) => c.id === user.uid);
                if (isCollaborator || boardData.ownerId === user.uid) {
                  setBoards((prev) => {
                    const withoutBoard = prev.filter((b) => b.id !== boardDoc.id);
                    return [...withoutBoard, boardData].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                  });
                } else {
                  setBoards((prev) => prev.filter((b) => b.id !== boardDoc.id));
                }
              });
              collabUnsubs.set(boardDoc.id, unsub);
            }
          }
        });

        if (selected === "My Boards") {
          setBoards(tempBoards.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }
      });
    };

    startListening();
    return () => {
      if (boardUnsub) boardUnsub();
      collabUnsubs.forEach((unsub) => unsub());
    };
  }, [user, selected]);

  // helper time
  function timeAgoShort(ts) {
    if (!ts) return "";
    let ms = 0;
    if (ts.toDate) ms = ts.toDate().getTime();
    else if (ts.seconds) ms = ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    else if (typeof ts === "number") ms = ts;
    else if (ts instanceof Date) ms = ts.getTime();
    else return "";

    const diff = Date.now() - ms;
    const mins = Math.round(diff / (1000 * 60));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  }

  const placeholder = "https://picsum.photos/seed/pixpick/800/450";

  // build stable data to render; avoid creating new objects each render for child props
  const boardsToRender = useMemo(() => {
    return boards.map((b) => {
      const imgs = latestboardimages[b.id] || [];
      const numImages = b.numImages ?? (b.estimatedImageCount ?? imgs.length);
      // Do NOT spread board into new object here; pass original board plus computed lightweight fields
      return { board: b, imgs, numImages };
    });
  }, [boards, latestboardimages]);

  // Render
  return (
    <div style={{ padding: 12, backgroundColor: "linear-gradient(nulldeg,rgba(65, 132, 165, 1) 0%, rgba(242, 242, 242, 1) 45%, rgba(65, 132, 165, 1) 100%)", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{selected} <span style={{ color: "#6b7280", fontSize: 14, marginLeft: 8 }}>({boards.length})</span></h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="bp-btn" onClick={() =>  setDensity('one') } style={{ outline: 'none', border: 'none', background: density === 'one' ? '#178589' : '#fff', color: density === 'one' ? '#fff' : '#178589' }} aria-label="grid view">One</button>
          <button className="bp-btn" onClick={() => setDensity('many')} style={{ outline: 'none', border: 'none', background: density === 'many' ? '#178589' : '#fff', color: density === 'many' ? '#fff' : '#178589' }} aria-label="list view" disabled={loading}>Many</button>
        </div>
      </div>

      {loading && boards.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(columns, 3)}, 1fr)`, gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : boards.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          No boards found — create a board to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12 }}>
          {boardsToRender.map(({ board, imgs }) => {
            // pass original board and imgs (memoized behavior in BoardCard comparator will prevent unnecessary rerenders)
            return <BoardCard key={board.id} board={board} imgs={imgs} placeholder={placeholder} timeAgoShort={timeAgoShort} density={density} setDensity={setDensity} />;
          })}
        </div>
      )}

      <style>{`
        .bp-card { transition: transform .18s ease, box-shadow .18s ease; cursor: pointer; }
        .bp-card:hover { transform: translateY(-6px); box-shadow: 0 18px 38px rgba(11,22,28,0.14); }
        .bp-btn { background: transparent; border: 1px solid rgba(0,0,0,0.06); padding: 6px 10px; border-radius: 8px; cursor: pointer; }
        .bp-btn:hover { background: rgba(0,0,0,0.03); }
      `}</style>
    </div>
  );
}

/* keep skeleton below so the file is self-contained */
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 12, padding: 12, background: "linear-gradient(180deg,#f4f6f7,#eef1f3)" }}>
      <div style={{ height: 120, borderRadius: 8, background: "#e6e9ea", marginBottom: 8 }} />
      <div style={{ height: 16, width: "60%", background: "#e6e9ea", borderRadius: 6 }} />
    </div>
  );
}
