// BoardList.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import Loader from "../components/Loader";
import { motion } from "framer-motion";
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';

/* ----------------------------
   reusable tilt hook
   ---------------------------- */
function useTilt(ref, opts = {}) {
  const {
    maxX = 12,      // rotateX max
    maxY = 16,      // rotateY max
    parallax = 0,   // we set to 0 (you already chose Option A)
    lerpFactor = 0.16,
    perspective = 900, // parent perspective px
    deadzone = 0.03, // small region around center where we snap to zero
  } = opts;

  const rafRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ensure element rotates around center and hide backface flicker
    el.style.transformOrigin = el.style.transformOrigin || "center center";
    el.style.backfaceVisibility = el.style.backfaceVisibility || "hidden";
    el.style.willChange = el.style.willChange || "transform";

    // ensure a consistent perspective on the wrapper parent (only set if not set)
    const parent = el.parentElement;
    if (parent && !parent.style.perspective) {
      parent.style.perspective = parent.style.perspective || `${perspective}px`;
      parent.style.perspectiveOrigin = parent.style.perspectiveOrigin || "50% 50%";
    }

    // find likely main image inside this card (first image)
    const innerImg = el.querySelector("img");

    const lerp = (a, b, t) => a + (b - a) * t;

    const animate = () => {
      current.current.x = lerp(current.current.x, target.current.x, lerpFactor);
      current.current.y = lerp(current.current.y, target.current.y, lerpFactor);

      // apply transform: rotateY first then rotateX (this order reduces axis-interaction flips)
      // translateZ last
      el.style.transform = `rotateY(${current.current.y}deg) rotateX(${current.current.x}deg) translateZ(6px)`;

      // only give image a Z push, no XY translate (you picked Option A)
      if (innerImg) {
        innerImg.style.transform = `translateZ(36px) scale(1.02)`;
        innerImg.style.willChange = "transform";
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const onPointerMove = (e) => {
      // bounding rect in viewport
      const rect = el.getBoundingClientRect();

      // compute pointer offset from element CENTER (robust)
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // normalized coords -1 .. 1
      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      // clamp
      const px = Math.max(-1, Math.min(1, nx));
      const py = Math.max(-1, Math.min(1, ny));

      // small deadzone near center to avoid jitter/accidental flips
      const pxFinal = Math.abs(px) < deadzone ? 0 : px;
      const pyFinal = Math.abs(py) < deadzone ? 0 : py;

      // map to rotation targets.
      // Note: px controls rotateY, py controls rotateX (vertical inverted so cursor up -> tilt up)
      // Using this sign mapping + rotateY-first order gives consistent behavior.
      target.current.y = pxFinal * (maxY * 1.5);
      target.current.x = -pyFinal * (maxX * 1.5);
    };

    const onPointerEnter = () => {
      el.classList.add("is-hover");
      if (!rafRef.current) rafRef.current = requestAnimationFrame(animate);
    };
    const onPointerLeave = () => {
      // reset targets
      target.current.x = 0;
      target.current.y = 0;
      setTimeout(() => el.classList.remove("is-hover"), 180);
    };

    const onTouchStart = (ev) => {
      const t = ev.touches[0];
      onPointerEnter();
      onPointerMove({ clientX: t.clientX, clientY: t.clientY });
    };
    const onTouchMove = (ev) => {
      const t = ev.touches[0];
      onPointerMove({ clientX: t.clientX, clientY: t.clientY });
    };
    const onTouchEnd = () => onPointerLeave();

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerenter", onPointerEnter);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // cleanup styles
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.backfaceVisibility = "";
      if (innerImg) innerImg.style.transform = "";
      if (parent && parent.style && parent.style.perspective === `${perspective}px`) {
        // don't forcibly remove parent's perspective if it was set in CSS by you;
        // only remove if we set it here (best effort — optional)
        // parent.style.perspective = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current]);
}


/* ----------------------------
   BoardCard (preview layout)
   ---------------------------- */
const SIZES = {
  mainPercent: 0.62,
  previewPercent: 0.38,
  mainHeight: 180,
  gap: 8,
};

function BoardCard({ board, imgs }) {
  const placeholder = "https://picsum.photos/seed/pixpick-21/800/450";
  const initial = [imgs[0] || placeholder, imgs[1] || placeholder, imgs[2] || placeholder];
  const [cardImgs, setCardImgs] = useState(initial);
  const mediaRef = useRef(null);

  useEffect(() => {
    setCardImgs([imgs[0] || placeholder, imgs[1] || placeholder, imgs[2] || placeholder]);
  }, [imgs]);

  const onPreviewClick = (previewIndex) => {
    const newImgs = [...cardImgs];
    [newImgs[0], newImgs[previewIndex]] = [newImgs[previewIndex], newImgs[0]];
    setCardImgs(newImgs);
  };

  const coverStyles = {
    wrapper: { display: "flex", gap: SIZES.gap, alignItems: "stretch", marginTop: 10 },
    mainWrap: {
      width: `${Math.round(SIZES.mainPercent * 100)}%`,
      height: SIZES.mainHeight,
      borderRadius: 6,
      overflow: "hidden",
      background: "#eaeaea",
      flexShrink: 0,
      position: "relative",
    },
    mainImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
      pointerEvents: "none",
    },
    previewColumn: {
      width: `${Math.round(SIZES.previewPercent * 100)}%`,
      display: "flex",
      flexDirection: "column",
      gap: Math.max(4, Math.round(SIZES.gap / 2)),
      alignItems: "stretch",
    },
    previewImg: {
      width: "100%",
      height: `calc(${SIZES.mainHeight / 2}px - ${Math.round(SIZES.gap / 2)}px)`,
      borderRadius: 6,
      overflow: "hidden",
      background: "#eee",
      objectFit: "cover",
      display: "block",
      cursor: "pointer",
    },
  };

  return (
    <div style={coverStyles.wrapper}>
      <div style={coverStyles.mainWrap} aria-hidden>
        <div ref={mediaRef} style={{ position: "absolute", inset: 0, display: "block", transformStyle: "preserve-3d", transition: "transform 220ms ease" }}>
          <img
            className="board-main-img"
            alt={`board-main-${board.id}`}
            src={cardImgs[0]}
            style={coverStyles.mainImg}
          />
        </div>
      </div>

      <div style={coverStyles.previewColumn}>
        {[1, 2].map((i) => (
          <img
            key={i}
            alt={`preview-${i}`}
            src={cardImgs[i]}
            onClick={() => onPreviewClick(i)}
            style={coverStyles.previewImg}
          />
        ))}
      </div>
    </div>
  );
}

/* ----------------------------
   BoardTile - per-board tile (safe to use hooks)
   ---------------------------- */
function BoardTile({ board, imgs, to, location }) {
  const tiltRef = useRef(null);
  useTilt(tiltRef);

  const picksCount = board.picksCount || 0; // fallback if not set

  const wrapperBaseStyle = {
    display: "block",
    padding: 12,
    borderRadius: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    textDecoration: "none",
    color: "inherit",
    overflow: "hidden",
    marginBottom: 0,
    minHeight: SIZES.mainHeight + 40,
    transformStyle: "preserve-3d",
    willChange: "transform",
    background: "linear-gradient(90deg, rgba(141,167,168,1) 0%, rgba(141,167,168,1) 50%, rgba(141,167,168,1) 100%)",
  };

  return (
    <div ref={tiltRef} style={wrapperBaseStyle}>
      <Link
        to={to}
        state={{ background: location }}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <strong style={{ opacity: 1, color: "#222"}}>{board.title || "Untitled Board"}</strong>
        <span style={{ margin: "0 4px", color: "#555" }}>•</span>
        <strong style={{ fontSize: 12, color: "#444", fontSize: 13 }}>
          {picksCount} {picksCount === 1 ? "pick" : "picks"}
        </strong>
        <div style={{ marginTop: 8 }}>
          <BoardCard board={board} imgs={imgs} />
        </div>
      </Link>
    </div>
  );
}

/* ----------------------------
   BoardList (main component)
   ---------------------------- */
export default function BoardList({ user, boardsCache, setBoardsCache, selected, setSelected }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [latestboardimages, setLatestBoardImages] = useState({});
  const [loadingBoards, setLoadingBoards] = useState(false);

  // refs for cleanup of per-board collaborator listeners
  const collabUnsubsRef = useRef(new Map());
  const boardCollectionUnsubRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------- initial board cache listener (only to populate cache once) ----------
  useEffect(() => {
    if (!user || (boardsCache && boardsCache.length > 0)) return;

    const q = query(collection(db, "boards"));
    const unsub = onSnapshot(q, (snap) => {
      const temp = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.ownerId === user.uid) temp.push(data);
      });
      setBoardsCache(temp);
    });

    return () => unsub();
  }, [user, boardsCache, setBoardsCache]);

  // Keep local boards state in sync with boardsCache when provided
  useEffect(() => {
    if (boardsCache && boardsCache.length > 0) {
      setBoards(boardsCache);
    }
  }, [boardsCache]);

  // ---------- latest images per board (3 most recent) ----------
  useEffect(() => {
    if (!user) return;
    const unsubs = [];

    boards.forEach((board) => {
      const qImg = query(
        collection(db, "boards", board.id, "images"),
        orderBy("createdAt", "desc"),
        limit(3)
      );
      const unsub = onSnapshot(qImg, (snap) => {
        if (!mountedRef.current) return;
        const imgs = snap.docs.map((d) => d.data().src || "");
        setLatestBoardImages((prev) => ({ ...prev, [board.id]: imgs }));
      }, (err) => {
        console.warn("latest images listener error for board", board.id, err);
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [user, boards]);

  // ---------- main boards listener (reacts to selected filter and keeps up-to-date) ----------
  useEffect(() => {
    if (!user) return;

    setLoadingBoards(true);

    // cleanup any previous per-board collab listeners
    collabUnsubsRef.current.forEach((u) => u());
    collabUnsubsRef.current.clear();

    // ensure we cleanup previous board collection unsub
    if (boardCollectionUnsubRef.current) {
      boardCollectionUnsubRef.current();
      boardCollectionUnsubRef.current = null;
    }

    const qBoards = query(collection(db, "boards"), orderBy("updatedAt", "desc"));
    const boardUnsub = onSnapshot(qBoards, async (boardsSnap) => {
      if (!mountedRef.current) return;

      const tempBoards = [];
      const candidateBoards = [];
      boardsSnap.forEach((boardDoc) => {
        candidateBoards.push({ id: boardDoc.id, ...boardDoc.data() });
      });

      const sortByRecency = (arr) =>
        arr.sort((a, b) => {
          const aTs = (a.updatedAt?.seconds ?? a.updatedAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0);
          const bTs = (b.updatedAt?.seconds ?? b.updatedAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0);
          return bTs - aTs;
        });

      if (selected === "My Boards") {
        for (const bd of candidateBoards) {
          if (bd.ownerId === user.uid) tempBoards.push(bd);
        }
        setBoards(sortByRecency(tempBoards));
        setLoadingBoards(false);
      } else {
        setBoards([]);

        candidateBoards.forEach((boardData) => {
          const boardId = boardData.id;
          if (collabUnsubsRef.current.has(boardId)) return;

          const collabQ = collection(db, "boards", boardId, "collaborators");
          const unsub = onSnapshot(collabQ, (collabSnap) => {
            if (!mountedRef.current) return;

            const isCollaborator = collabSnap.docs.some((c) => c.id === user.uid);
            const isOwner = boardData.ownerId === user.uid;

            if (selected === "Shared") {
              if (isCollaborator && !isOwner) {
                setBoards((prev) => {
                  const without = prev.filter((b) => b.id !== boardId);
                  const next = [...without, boardData];
                  return sortByRecency(next);
                });
              } else {
                setBoards((prev) => prev.filter((b) => b.id !== boardId));
              }
            } else if (selected === "Notifications") {
              navigate('/notifications');
            } else if (selected === "Friends") {
              navigate('/friends');
            } else if (selected === "Home") {
              setSelected('My Boards');
            }
            setLoadingBoards(false);
          }, (err) => {
            console.warn("collab listener error", boardId, err);
            setLoadingBoards(false);
          });

          collabUnsubsRef.current.set(boardId, unsub);
        });

        if (candidateBoards.length === 0) {
          setLoadingBoards(false);
        }
      }
    }, (err) => {
      console.warn("boards collection listener error", err);
      setLoadingBoards(false);
    });

    boardCollectionUnsubRef.current = boardUnsub;

    return () => {
      if (boardCollectionUnsubRef.current) {
        boardCollectionUnsubRef.current();
        boardCollectionUnsubRef.current = null;
      }
      collabUnsubsRef.current.forEach((u) => u());
      collabUnsubsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selected]);

  /* ---------- responsive grid ---------- */
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
  const getColumns = () => {
    if (width < 640) return 1;
    if (width < 900) return 2;
    if (width < 1200) return 3;
    return 4;
  };
  const columnsCount = getColumns();
  // board images wrapper
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
    gap: 12,
    alignItems: "start",
    background: "linear-gradient(to right top, #408083, #408083, #408083, #408083, #408083)",
    padding: 12,
    borderRadius: 12,
  };

  const filterBarStyle = {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  };
  const filterBtn = (isActive) => ({
    padding: "8px 16px",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: 500,
    border: "none",
    outline: "none",
    background: isActive ? "#408083" : "#f2f2f2",
    color: isActive ? "#fff" : "#333",
    boxShadow: isActive ? "0 4px 10px rgba(0,0,0,0.15)" : "none",
    transition: "all 0.2s ease",
  });

  const placeholder = "https://picsum.photos/seed/pixpick-21/800/450";

  /* ---------- render ---------- */
  return (
    <div>
      {/* Filter Tabs */}
      <div style={filterBarStyle}>
        {["My Boards", "Shared"].map((label) => (
          <motion.button
            key={label}
            style={{
              ...filterBtn(selected === label),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0px",
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelected(label)}
          >
            <img
              src={label === "My Boards" ? homeicon : sharedicon}
              alt={label === "My Boards" ? "Home Icon" : "Shared Icon"}
              height={20}
              width={20}
              style={{ marginRight: '8px' }}
            />
            {label}
          </motion.button>
        ))}
      </div>

      {/* Loader */}
      <Loader visible={loadingBoards} text={`Loading ${selected ? selected : "boards"}…`} />

      {(!loadingBoards && boards.length === 0) ? (
        <h4 style={{ textAlign: "center", marginTop: 20 }}>No boards found</h4>
      ) : null}

      <div style={gridStyle}>
        {boards.map((board) => {
          const imgs = latestboardimages[board.id] || [];
          const to = `/board/${board.id}`;
          return (
            <BoardTile
              key={board.id}
              board={board}
              imgs={imgs}
              to={to}
              location={location}
            />
          );
        })}
      </div>
    </div>
  );
}
