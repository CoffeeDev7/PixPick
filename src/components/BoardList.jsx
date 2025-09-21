import React, { useState, useEffect } from "react";
import { Link , useLocation } from "react-router-dom";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

export default function BoardList({ user, boardsCache, setBoardsCache, selected }) {
  const location = useLocation();
  const [boards, setBoards] = useState([]);
  const [latestboardimages, setLatestBoardImages] = useState({});
  const [viewMode, setViewMode] = useState("wide");

  // ---------- existing listeners (unchanged) ----------
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
        const imgs = snap.docs.map((d) => d.data().src || "");
        setLatestBoardImages((prev) => ({ ...prev, [board.id]: imgs }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [user, boards]);

  useEffect(() => {
    if (!user) return;
    let boardUnsub = null;
    const collabUnsubs = new Map();

    const startListening = () => {
      boardUnsub = onSnapshot(collection(db, "boards"), (boardsSnap) => {
        const tempBoards = [];
        boardsSnap.forEach((boardDoc) => {
          const boardData = { id: boardDoc.id, ...boardDoc.data() };
          if (selected === "My Boards") {
            if (boardData.ownerId === user.uid) tempBoards.push(boardData);
          } else if (selected === "Shared with Me") {
            if (!collabUnsubs.has(boardDoc.id)) {
              const unsub = onSnapshot(
                collection(db, "boards", boardDoc.id, "collaborators"),
                (collabSnap) => {
                  const isCollaborator = collabSnap.docs.some(
                    (c) => c.id === user.uid && c.data().role !== "owner"
                  );
                  if (isCollaborator) {
                    setBoards((prev) => {
                      const withoutBoard = prev.filter((b) => b.id !== boardDoc.id);
                      return [...withoutBoard, boardData].sort(
                        (a, b) =>
                          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                      );
                    });
                  } else {
                    setBoards((prev) => prev.filter((b) => b.id !== boardDoc.id));
                  }
                }
              );
              collabUnsubs.set(boardDoc.id, unsub);
            }
          } else if (selected === "All Boards") {
            if (boardData.ownerId === user.uid) tempBoards.push(boardData);
            if (!collabUnsubs.has(boardDoc.id)) {
              const unsub = onSnapshot(
                collection(db, "boards", boardDoc.id, "collaborators"),
                (collabSnap) => {
                  const isCollaborator = collabSnap.docs.some((c) => c.id === user.uid);
                  if (isCollaborator || boardData.ownerId === user.uid) {
                    setBoards((prev) => {
                      const withoutBoard = prev.filter((b) => b.id !== boardDoc.id);
                      return [...withoutBoard, boardData].sort(
                        (a, b) =>
                          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                      );
                    });
                  } else {
                    setBoards((prev) => prev.filter((b) => b.id !== boardDoc.id));
                  }
                }
              );
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

  // ---------- styles you already had ----------
  const boardItemStyle = {
    background:
      "linear-gradient(90deg, rgba(141,167,168,1) 0%, rgba(141,167,168,1) 50%, rgba(141,167,168,1) 100%)",
    borderRadius: "var(--card-radius)",
    overflow: "hidden",
    boxShadow: "0 6px 18px rgba(12,12,16,0.05)",
    cursor: "pointer",
    position: "relative",
  };

  const styles = {
    mainImage: {
      borderRadius: "10px",
      overflow: "hidden",
      background: "#ddd",
    },
    mainImageImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "top center",
    },
  };

  // ---------- Responsive grid logic ----------
  // decide columns based on window width
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

  // breakpoints — tweak these if you like
  const getColumns = () => {
    if (width < 640) return 1; // mobile
    if (width < 900) return 2; // small tablet
    if (width < 1200) return 3; // laptop
    return 4; // large desktop
  };

  const columns = getColumns();

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: 12,
    alignItems: "start",
    background: "linear-gradient(to right top, #408083, #408083, #408083, #408083, #408083)",
    padding: 12,
    borderRadius: 12,
  };

  // ---------- Card sizing that scales inside each grid cell ----------
  // We switched main/preview to percentage widths so they scale inside each grid cell.
  const SIZES = {
    // tweak these percentages to change visual proportions inside card
    mainPercent: 0.62, // main image gets ~62% of the card width
    previewPercent: 0.38,
    mainHeight: 180, // px height for the visual. Change to suit your design.
    gap: 8,
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
    },
    mainImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
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

  const placeholder = "https://picsum.photos/seed/pixpick-21/800/450";

  // BoardCard identical to before but adapted to percent widths (so it scales in grid)
  function BoardCard({ board, imgs }) {
    const initial = [imgs[0] || placeholder, imgs[1] || placeholder, imgs[2] || placeholder];
    const [cardImgs, setCardImgs] = useState(initial);

    const onPreviewClick = (previewIndex) => {
      const newImgs = [...cardImgs];
      [newImgs[0], newImgs[previewIndex]] = [newImgs[previewIndex], newImgs[0]];
      setCardImgs(newImgs);
    };

    return (
      <div style={coverStyles.wrapper}>
        <div style={coverStyles.mainWrap}>
          <img alt={`board-main-${board.id}`} src={cardImgs[0]} style={{ ...coverStyles.mainImg, ...styles.mainImageImg }} />
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

  // ---------- Render ----------
  return (
    <div>
      {boards.length === 0 ? <h4 style={{ textAlign: "center" }}>No boards found</h4> : null}

      {/* Grid container: responsive columns */}
      <div style={gridStyle}>
        {boards.map((board) => {
          const imgs = latestboardimages[board.id] || [];
          const to = `/board/${board.id}`;
          return (
            <Link
              key={board.id}
              to={to}
              state={{ background: location }} //  <<< important , pass current location in state 
              style={{
                ...boardItemStyle,
                display: "block",
                padding: 12,
                borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textDecoration: "none",
                color: "inherit",
                overflow: "hidden",
                marginBottom: 0, // grid manages spacing
                minHeight: SIZES.mainHeight + 40,
              }}
              onMouseEnter={(e) => (
                e.currentTarget.style.transform = "translateY(-7px)",
                e.currentTarget.style.boxShadow = "0 8px 8px rgba(16, 17, 17, 0.5)"
              )}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)", e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")}
            >
              <strong>{board.title || "Untitled Board"}</strong>

              {/* card cover (main-left, previews-right) */}
              <div style={{ marginTop: 8 }}>
                <BoardCard board={board} imgs={imgs} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
