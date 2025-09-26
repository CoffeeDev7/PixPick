import React, { useEffect, useRef, useState } from "react"; import { Link, useLocation, useNavigate } from "react-router-dom"; import { collection, onSnapshot, query, orderBy, limit, doc, getDoc, } from "firebase/firestore"; import { db } from "../firebase"; import Loader from "../components/Loader";
import { motion } from "framer-motion";
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';

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

    // single snapshot to populate cache (we keep live listener below for selection)
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
  // listense to images subcollections for boards currently in `boards`
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
        // if component unmounted, ignore
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

    // show loader when switching selection
    setLoadingBoards(true);

    // cleanup any previous per-board collab listeners
    collabUnsubsRef.current.forEach((u) => u());
    collabUnsubsRef.current.clear();

    // ensure we cleanup previous board collection unsub
    if (boardCollectionUnsubRef.current) {
      boardCollectionUnsubRef.current();
      boardCollectionUnsubRef.current = null;
    }

    // We try to order by updatedAt on server to get sensible ordering immediately.
    // Fallback to client-side sorting by updatedAt||createdAt in case some docs
    // are missing updatedAt.
    const qBoards = query(collection(db, "boards"), orderBy("updatedAt", "desc"));
    const boardUnsub = onSnapshot(qBoards, async (boardsSnap) => {
      if (!mountedRef.current) return;

      // collect boards depending on the selected filter
      const tempBoards = [];

      // We'll build a list of candidate boards and then apply filters:
      const candidateBoards = [];
      boardsSnap.forEach((boardDoc) => {
        candidateBoards.push({ id: boardDoc.id, ...boardDoc.data() });
      });

      // Helper to sort by updatedAt or createdAt
      const sortByRecency = (arr) =>
        arr.sort((a, b) => {
          const aTs = (a.updatedAt?.seconds ?? a.updatedAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0);
          const bTs = (b.updatedAt?.seconds ?? b.updatedAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0);
          return bTs - aTs;
        });

      if (selected === "My Boards") {
        // only boards owned by me
        for (const bd of candidateBoards) {
          if (bd.ownerId === user.uid) tempBoards.push(bd);
        }
        setBoards(sortByRecency(tempBoards));
        setLoadingBoards(false);
      } else {
        // For Shared with Me or All Boards we will set per-board collaborator listeners
        // For performance we don't create duplicate listeners (collabUnsubsRef guards this)
        // Also we maintain `boards` via setBoards when a collaborator entry indicates the user is part of it.

        // Start with clearing boards for this view
        setBoards([]);

        // We'll iterate through candidateBoards and for each board create a collaborator snapshot
        // That snapshot will decide whether to include the board in the `boards` state.
        candidateBoards.forEach((boardData) => {
          const boardId = boardData.id;

          // If we already have a listener for this board, skip
          if (collabUnsubsRef.current.has(boardId)) return;

          const collabQ = collection(db, "boards", boardId, "collaborators");
          const unsub = onSnapshot(collabQ, (collabSnap) => {
            if (!mountedRef.current) return;

            const isCollaborator = collabSnap.docs.some((c) => c.id === user.uid);
            const isOwner = boardData.ownerId === user.uid;

            if (selected === "Shared") {
              // include boards where user is a collaborator (but not owner)
              if (isCollaborator && !isOwner) {
                setBoards((prev) => {
                  const without = prev.filter((b) => b.id !== boardId);
                  const next = [...without, boardData];
                  return sortByRecency(next);
                });
              } else {
                setBoards((prev) => prev.filter((b) => b.id !== boardId));
              }
            } else if(selected === "Notifications") {
              navigate('/notifications'); 
            } else if(selected === "Friends") {
              navigate('/friends');
            } else if(selected === "Home") {
              setSelected('My Boards');
            }
            setLoadingBoards(false);
          }, (err) => {
            console.warn("collab listener error", boardId, err);
            setLoadingBoards(false);
          });

          collabUnsubsRef.current.set(boardId, unsub);
        });

        // If there were zero candidate boards, hide loader
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
      // cleanup
      if (boardCollectionUnsubRef.current) {
        boardCollectionUnsubRef.current();
        boardCollectionUnsubRef.current = null;
      }
      collabUnsubsRef.current.forEach((u) => u());
      collabUnsubsRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selected]);

    // ---------- styles (unchanged but kept here) ----------
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

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
    gap: 12,
    alignItems: "start",
    background: "linear-gradient(to right top, #408083, #408083, #408083, #408083, #408083)",
    padding: 12,
    borderRadius: 12,
  };

  // ---------- Card sizing that scales inside each grid cell ----------
  const SIZES = {
    mainPercent: 0.62,
    previewPercent: 0.38,
    mainHeight: 180,
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

  // BoardCard identical adapted to percent widths
  function BoardCard({ board, imgs }) {
    const initial = [imgs[0] || placeholder, imgs[1] || placeholder, imgs[2] || placeholder];
    const [cardImgs, setCardImgs] = useState(initial);

    useEffect(() => {
      // if imgs change (new picture added), update the preview thumbnails immediately
      setCardImgs([imgs[0] || placeholder, imgs[1] || placeholder, imgs[2] || placeholder]);
    }, [imgs]);

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

  // ---------- UI styles ----------
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

  // ---------- Render ----------
  return (
    <div>
      {/* Filter Tabs */}
      <div style={filterBarStyle}>
        {["My Boards", "Shared"].map((label) => (
          <motion.button
            key={label}
            style={{...filterBtn(selected === label),
              display: "flex",           // make button content a flex row
              alignItems: "center",      // vertical centering
              justifyContent: "center",  // optional: keep text centered if button is wide
              gap: "0px", }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelected(label)}
          >
            {/* Conditionally render the correct icon based on the label */}
            <img
              src={label === "My Boards" ? homeicon : sharedicon}
              alt={label === "My Boards" ? "Home Icon" : "Shared Icon"}
              height={20}
              width={20}
              // Add a small margin to the right if you want space between the icon and text (recommended)
               style={{ marginRight: '8px' }}
            />
            {/* Display the label text next to the icon */}
            {label}
          </motion.button>
        ))}
      </div>

      {/* Loader when switching views or initial load */}
      <Loader visible={loadingBoards} text={`Loading ${selected ? selected : "boards"}…`} />

      {(!loadingBoards && boards.length === 0) ? (
        <h4 style={{ textAlign: "center", marginTop: 20 }}>No boards found</h4>
      ) : null}

      <div style={gridStyle}>
        {boards.map((board) => {
          const imgs = latestboardimages[board.id] || [];
          const to = `/board/${board.id}`;
          return (
            <Link
              key={board.id}
              to={to}
              state={{ background: location }}
              style={{
                ...boardItemStyle,
                display: "block",
                padding: 12,
                borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                textDecoration: "none",
                color: "inherit",
                overflow: "hidden",
                marginBottom: 0,
                minHeight: SIZES.mainHeight + 40,
              }}
            >
              <strong>{board.title || "Untitled Board"}</strong>

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
