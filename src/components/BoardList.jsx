// BoardList.jsx
import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate, useLocation } from "react-router-dom";
import { FiTrash2 } from "react-icons/fi";
import { MdEdit } from "react-icons/md";
import { MdViewModule, MdViewDay, MdTextFields, MdSearch, MdMoreVert } from "react-icons/md";
import './BoardList.css'

export default function BoardList({ user, selected }) {
  const [boards, setBoards] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [latestboardimages, setlatestboardimages] = useState({});
  const [cachedLatestImages, setCachedLatestImages] = useState({}); // resolved (and optionally cached) urls
  const [viewMode, setViewMode] = useState("wide"); // "wide" | "compact" | "plain"
  const [imagesLoading, setImagesLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef();
  const imagesUnsubsRef = useRef(new Map());

  // search + view popover state
  const [searchTerm, setSearchTerm] = useState("");
  const [viewPopoverOpen, setViewPopoverOpen] = useState(false);
  const viewPopoverRef = useRef();

  // --- persist viewMode to localStorage so it survives navigation
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pixpick_view_mode");
      if (saved) setViewMode(saved);
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pixpick_view_mode", viewMode);
    } catch (err) {
      // ignore
    }
  }, [viewMode]);

  // --- image cache (in-memory map on window so it survives remounts within SPA)
  // value: Map<src -> { loaded: true }>
  if (!window.__pixpickImageCache) window.__pixpickImageCache = new Map();

  // resolve a src to a cached marker (we keep the src but log/load)
  // returns a Promise that resolves to src (or data/objectURL if you wanted to transform)
  const resolveCachedSrc = (src) => {
    return new Promise((resolve) => {
      if (!src) return resolve(src);

      const cache = window.__pixpickImageCache;
      if (cache.has(src)) {
        // Already cached in memory
        console.log("[pixpick] loaded image from in-memory cache:");
        return resolve(src);
      }

      // create an Image to warm browser cache and detect load
      const img = new Image();
      img.onload = () => {
        try {
          cache.set(src, { loaded: true, ts: Date.now() });
        } catch (err) {
          // ignore storage errors
        }
        console.log("[pixpick] image cached after load:");
        resolve(src);
      };
      img.onerror = () => {
        // still resolve to original src so UI can attempt to load it (broken images will show as usual)
        console.warn("[pixpick] image failed to load (will still use src):", src);
        resolve(src);
      };

      // finally assign src to start loading
      img.src = src;
      // if the image is already in browser http cache the onload might not fire synchronously -> still fine
    });
  };

  // When latestboardimages changes, resolve each src via cache helper and store in cachedLatestImages
  useEffect(() => {
    let active = true;
    const allBoardIds = Object.keys(latestboardimages || {});
    if (allBoardIds.length === 0) {
      setCachedLatestImages({});
      return;
    }

    (async () => {
      const result = {};
      for (const boardId of allBoardIds) {
        const arr = latestboardimages[boardId] || [];
        // resolve each src in order (fire off resolves in parallel)
        const promises = arr.map((s) => resolveCachedSrc(s));
        try {
          const resolved = await Promise.all(promises);
          if (!active) return;
          result[boardId] = resolved;
        } catch (err) {
          console.error("Error resolving cached images:", err);
          result[boardId] = arr;
        }
      }
      if (active) setCachedLatestImages((prev) => ({ ...prev, ...result }));
    })();

    return () => {
      active = false;
    };
  }, [latestboardimages]);

  // Fetch boards list (unchanged logic, but kept careful)
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

  // Fetch latest 3 images for each board
  useEffect(() => {
    if (!user) return;
    setImagesLoading(true);

    const visibleBoardIds = boards.map((b) => b.id);

    visibleBoardIds.forEach((boardId) => {
      if (imagesUnsubsRef.current.has(boardId)) return;

      const imagesRef = collection(db, "boards", boardId, "images");
      const q = query(imagesRef, orderBy("createdAt", "desc"), limit(3));

      const unsub = onSnapshot(
        q,
        (snap) => {
          const latestImages = snap.docs.map((d) => d.data().src || "");
          setlatestboardimages((prev) => {
            const old = prev[boardId] || [];
            const same =
              old.length === latestImages.length &&
              old.every((v, i) => v === latestImages[i]);
            if (same) return prev;
            return { ...prev, [boardId]: latestImages };
          });
          setImagesLoading(false);
        },
        (err) => {
          console.error("images listener error for", boardId, err);
        }
      );

      imagesUnsubsRef.current.set(boardId, unsub);
    });

    // remove listeners for boards not visible
    imagesUnsubsRef.current.forEach((unsub, id) => {
      if (!visibleBoardIds.includes(id)) {
        unsub();
        imagesUnsubsRef.current.delete(id);
        setlatestboardimages((prev) => {
          if (!prev[id]) return prev;
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
        setCachedLatestImages((prev) => {
          if (!prev[id]) return prev;
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    });

    return () => {
      imagesUnsubsRef.current.forEach((unsub) => unsub());
      imagesUnsubsRef.current.clear();
    };
  }, [user, selected, boards]);

  const handleRename = (boardId, currentTitle) => {
    const newTitle = prompt("Enter new title", currentTitle);
    if (newTitle && newTitle.trim() !== "") {
      const boardRef = doc(db, "boards", boardId);
      const capitalizedTitle = newTitle.trim().charAt(0).toUpperCase() + newTitle.trim().slice(1);
      updateDoc(boardRef, { title: capitalizedTitle });
    }
  };

  const handleDelete = async (boardId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this board?");
    if (!confirmDelete) return;
    try {
      const boardRef = doc(db, "boards", boardId);
      const imagesRefCol = collection(boardRef, "images");
      const imagesSnap = await getDocs(imagesRefCol);
      const imageDeletes = imagesSnap.docs.map((d) => deleteDoc(d.ref));
      const collabRef = collection(boardRef, "collaborators");
      const collabSnap = await getDocs(collabRef);
      const collabDeletes = collabSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all([...imageDeletes, ...collabDeletes]);
      await deleteDoc(boardRef);
    } catch (err) {
      console.error("Error deleting board:", err);
      alert("Failed to delete the board. Try again.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenFor(null);
      if (viewPopoverRef.current && !viewPopoverRef.current.contains(e.target)) setViewPopoverOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // filtered boards based on search term (case-insensitive)
  const filteredBoards = boards.filter((b) =>
    b.title ? b.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) : false
  );

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* DO NOT style `body` here — scope to the component root  */}
      <style>{`
        :root { --max-width: 640px; --gap: 14px; --card-radius: 12px; }
        .container { width: 100%; max-width: var(--max-width); }
        .board-grid { display: grid; gap: var(--gap); }
        .board-item { background: white; border-radius: var(--card-radius); overflow: hidden; box-shadow: 0 6px 18px rgba(12,12,16,0.05); cursor: pointer; position: relative; }
        .board-item:hover { transform: translateY(-6px); box-shadow: 0 14px 30px rgba(12,12,16,0.08); }
        .board-cover { padding: 8px; box-sizing: border-box; gap: 6px; display: grid; }
        .main-image, .preview-images { border-radius: 10px; overflow: hidden; background: #ddd; }
        .main-image img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        /* WIDE: preview-images as two equal rows, no gaps left behind */
        
        .wide .preview-images img {width: 100%;
          height: calc(50% - (6px / 2));
          object-fit: cover;
          object-position: top center;
          display: block; }
        .compact .preview-images { display: grid; grid-template-rows: 1fr 1fr; gap: 1px; }
        .compact .preview-images img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .board-grid.compact { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .compact .board-cover { display: grid; height: 150px; grid-template-columns: 1.8fr 1fr; gap: 2px; padding: 2px; }
        .board-grid.wide { display: grid; grid-template-columns: 1fr; gap: var(--gap); }
        .wide .board-cover { height: 180px; grid-template-columns: 1.5fr 1fr; }
        .board-grid.plain .board-cover { display: none; }
        .board-info { padding: 10px 12px 14px; }
        .board-title { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .board-meta { margin: 6px 0 0; color: #7b7b84; font-size: 13px; }

        /* segmented pill (kept for popover control) */
        .segmented-pill { display: inline-flex; align-items: center; gap: 6px; background: #ffffff; border-radius: 999px; padding: 6px; border: 1px solid rgba(16,16,20,0.08); box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset; }
        .seg-btn { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 999px; cursor: pointer; transition: all 160ms ease; user-select: none; color: #5b5b66; background: transparent; border: none; outline: none; }
        .seg-btn:hover { transform: translateY(-2px); background: rgba(16,16,20,0.03); }
        .seg-btn.active { background: #1b999f; color: white; box-shadow: 0 6px 14px rgba(16,16,20,0.16); transform: translateY(-1px); }
        .seg-labels { display: inline-flex; gap: 10px; margin-left: 10px; align-items: center; color: #6b6b75; font-size: 13px; }

        /* search */
        .search-row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
        .search-input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #e6e6ea; background: #fff; box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset; display: flex; align-items: center; gap: 8px; }
        .search-input input { border: none; outline: none; flex: 1; font-size: 14px; }
        .view-popover { position: absolute; top: 46px; right: 0; background: #fff; border-radius: 10px; padding: 10px; box-shadow: 0 12px 36px rgba(0,0,0,0.12); z-index: 150; }
        /* skeleton */
        .skeleton { background: linear-gradient(90deg, #e9e9eb 0%, #f3f3f4 50%, #e9e9eb 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
        .skeleton.rect { width: 100%; height: 100%; border-radius: 10px; }
        .preview-skeleton { width: 100%; height: 50%; border-radius: 6px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {/* Top controls area */}
      <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div />
        </div>

        {/* Search + view button row */}
        <div className="search-row">
          <div className="search-input" role="search" aria-label="Search boards">
            <MdSearch size={18} style={{ opacity: 0.6 }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search boards by title..."
              aria-label="Search boards"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="clear-btn" aria-label="Clear search">
                ×
              </button>
            )}

          </div>

          {/* view popover toggle */}
          <div style={{ position: "relative" }} ref={viewPopoverRef}>
            <button
              title="Change view"
              aria-label="Change view"
              onClick={() => setViewPopoverOpen((s) => !s)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: "1px solid #e6e6ea",
                background: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}
            >
              <MdMoreVert size={20} />
            </button>

            {viewPopoverOpen && (
              <div className="view-popover" role="dialog" aria-label="View options">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="segmented-pill" role="tablist" aria-label="View mode">
                    <button
                      className={`seg-btn ${viewMode === "wide" ? "active" : ""}`}
                      onClick={() => { setViewMode("wide"); setViewPopoverOpen(false); }}
                      title="Wide view"
                      aria-pressed={viewMode === "wide"}
                    >
                      <MdViewModule size={18} />
                    </button>

                    <button
                      className={`seg-btn ${viewMode === "compact" ? "active" : ""}`}
                      onClick={() => { setViewMode("compact"); setViewPopoverOpen(false); }}
                      title="Compact view"
                      aria-pressed={viewMode === "compact"}
                    >
                      <MdViewDay size={18} />
                    </button>

                    <button
                      className={`seg-btn ${viewMode === "plain" ? "active" : ""}`}
                      onClick={() => { setViewMode("plain"); setViewPopoverOpen(false); }}
                      title="Plain list"
                      aria-pressed={viewMode === "plain"}
                    >
                      <MdTextFields size={18} />
                    </button>
                  </div>

                  <div className="seg-labels" aria-hidden="true" style={{ marginLeft: 8 }}>
                    <div style={{ opacity: viewMode === "wide" ? 1 : 0.5 }}>Wide</div>
                    <div style={{ opacity: viewMode === "compact" ? 1 : 0.5 }}>Compact</div>
                    <div style={{ opacity: viewMode === "plain" ? 1 : 0.5 }}>Plain</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredBoards.length === 0 && <p>No boards to show</p>}

      <div className={`board-grid ${viewMode}`}>
        {filteredBoards.map((board) => {
          const imgs = cachedLatestImages[board.id] || latestboardimages[board.id] || [];
          return (
            <div
              key={board.id}
              className="board-item"
              onClick={() => navigate(`/board/${board.id}`, { state: { from: location.pathname } })}
            >
              <div className="board-cover">
                <div className="main-image">
                  {imagesLoading ? (
                    <div className="skeleton rect" />
                  ) : (
                    <img
                      src={
                        imgs[0] ||
                        "https://e1.pxfuel.com/desktop-wallpaper/472/398/desktop-wallpaper-plain-white-gallery-white-plain.jpg"
                      }
                      alt=""
                    />
                  )}
                </div>
                <div className="preview-images">
                  {imagesLoading ? (
                    <>
                      <div className="skeleton preview-skeleton" />
                      <div className="skeleton preview-skeleton" />
                    </>
                  ) : (
                    <>
                      <img
                        src={
                          imgs[1] ||
                          "https://e1.pxfuel.com/desktop-wallpaper/472/398/desktop-wallpaper-plain-white-gallery-white-plain.jpg"
                        }
                        alt=""
                      />
                      <img
                        src={
                          imgs[2] ||
                          "https://e1.pxfuel.com/desktop-wallpaper/472/398/desktop-wallpaper-plain-white-gallery-white-plain.jpg"
                        }
                        alt=""
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="board-info">
                <h4 className="board-title">{board.title}</h4>
                <div className="board-meta">
                  {board.ownerId === user.uid ? "👑 You own this board" : "🤝 Shared with you"}
                </div>
              </div>

              {menuOpenFor === board.id && (
                <div
                  ref={menuRef}
                  style={{
                    position: "absolute",
                    top: "40px",
                    right: "10px",
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 1000,
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    onClick={() => { setMenuOpenFor(null); handleRename(board.id, board.title); }}
                    style={{ padding: "10px 14px", fontSize: "14px", cursor: "pointer", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <MdEdit size={18} /> Rename
                  </div>
                  <div
                    onClick={() => { setMenuOpenFor(null); handleDelete(board.id); }}
                    style={{ padding: "10px 14px", fontSize: "14px", cursor: "pointer", color: "red", display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <FiTrash2 size={18} /> Delete
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
