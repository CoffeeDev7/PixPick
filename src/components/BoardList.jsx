import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FiTrash2 } from "react-icons/fi";
import { MdEdit } from "react-icons/md";
import { MdViewModule, MdViewDay, MdTextFields } from "react-icons/md"; // refined icons

export default function BoardList({ user, selected }) {
  const [boards, setBoards] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [latestboardimages, setlatestboardimages] = useState({});
  const [viewMode, setViewMode] = useState("wide"); // "wide" or "compact" or "plain"
  const navigate = useNavigate();
  const menuRef = useRef();

  // Fetch boards list
  useEffect(() => {
    if (!user) return;

    const fetchBoards = async () => {
      let q;
      if (selected === "My Boards") {
        q = query(
          collection(db, "boards"),
          where("ownerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
      } else if (selected === "Shared with Me") {
        q = query(
          collection(db, "boards"),
          where("sharedWith", "array-contains", user.uid),
          orderBy("createdAt", "desc")
        );
      } else {
        const ownedQuery = query(
          collection(db, "boards"),
          where("ownerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const sharedQuery = query(
          collection(db, "boards"),
          where("sharedWith", "array-contains", user.uid),
          orderBy("createdAt", "desc")
        );
        const [ownedSnap, sharedSnap] = await Promise.all([
          getDocs(ownedQuery),
          getDocs(sharedQuery),
        ]);
        setBoards([
          ...ownedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          ...sharedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        ]);
        return;
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setBoards(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      return () => unsubscribe();
    };

    fetchBoards();
  }, [user, selected]);

  // Fetch latest 3 images for each board
  useEffect(() => {
    if (!user) return;

    const fetchBoardsWithImages = async () => {
      let boardsQuery;
      if (selected === "My Boards") {
        boardsQuery = query(
          collection(db, "boards"),
          where("ownerId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
      } else if (selected === "Shared with Me") {
        boardsQuery = query(
          collection(db, "boards"),
          where("sharedWith", "array-contains", user.uid),
          orderBy("createdAt", "desc")
        );
      } else {
        boardsQuery = query(
          collection(db, "boards"),
          orderBy("createdAt", "desc")
        );
      }

      const boardsSnap = await getDocs(boardsQuery);
      const newLatestImages = {};

      await Promise.all(
        boardsSnap.docs.map(async (docSnap) => {
          const boardId = docSnap.id;
          const imagesRef = collection(db, "boards", boardId, "images");
          const imageQuery = query(
            imagesRef,
            orderBy("createdAt", "desc"),
            limit(3)
          );
          const imageSnap = await getDocs(imageQuery);
          const latestImages = imageSnap.docs.map(
            (imgDoc) => imgDoc.data().src || ""
          );
          newLatestImages[boardId] = latestImages;
        })
      );

      setlatestboardimages(newLatestImages);
    };

    fetchBoardsWithImages();
  }, [user, selected]);

  const handleRename = (boardId, currentTitle) => {
    const newTitle = prompt("Enter new title", currentTitle);
    if (newTitle && newTitle.trim() !== "") {
      const boardRef = doc(db, "boards", boardId);
      const capitalizedTitle =
        newTitle.trim().charAt(0).toUpperCase() + newTitle.trim().slice(1);
      updateDoc(boardRef, { title: capitalizedTitle });
    }
  };

  const handleDelete = async (boardId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this board?"
    );
    if (!confirmDelete) return;

    try {
      const boardRef = doc(db, "boards", boardId);
      const imagesRef = collection(boardRef, "images");
      const imagesSnap = await getDocs(imagesRef);
      const imageDeletes = imagesSnap.docs.map((docSnap) =>
        deleteDoc(docSnap.ref)
      );

      const collabRef = collection(boardRef, "collaborators");
      const collabSnap = await getDocs(collabRef);
      const collabDeletes = collabSnap.docs.map((docSnap) =>
        deleteDoc(docSnap.ref)
      );

      await Promise.all([...imageDeletes, ...collabDeletes]);
      await deleteDoc(boardRef);
    } catch (err) {
      console.error("Error deleting board:", err);
      alert("Failed to delete the board. Try again.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* Embedded CSS for both views */}
      <style>{`
        :root {
          --max-width: 640px;
          --gap: 14px;
          --card-radius: 12px;
        }
        body {
          background: #f7f7f8;
        }
        .container {
          width: 100%;
          max-width: var(--max-width);
        }
        .board-grid {
          display: grid;
          gap: var(--gap);
        }
        .board-item {
          background: white;
          border-radius: var(--card-radius);
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(12, 12, 16, 0.05);
          cursor: pointer;
          position: relative;
        }
        .board-item:hover {
          transform: translateY(-6px);
          box-shadow: 0 14px 30px rgba(12, 12, 16, 0.08);
        }
        .board-cover {
          padding: 8px;
          box-sizing: border-box;
          gap: 6px;
          display: grid;
        }
        .main-image,
        .preview-images {
          border-radius: 10px;
          overflow: hidden;
          background: #ddd;
        }
        .main-image img{
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
        }
        .wide .preview-images img {
          width: 100%;
          height: calc(50% - (6px / 2));
          object-fit: cover;
          object-position: top center;
          display: block;
        }
        .compact .preview-images img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          display: block;
        }
        .board-grid.compact {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .compact .board-cover {
          display: grid;
          height: 150px;
          grid-template-columns: 1.8fr 1fr;
          gap:2px;
          padding: 2px;
        }
        .compact .preview-images {
          display: grid;
          grid-template-rows: repeat(2, 1fr);
          gap: 1px;
        }
        .board-grid.wide {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--gap);
        }
        .wide .board-cover {
          height: 180px;
          grid-template-columns: 1.5fr 1fr;
        }
        .wide .preview-images {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .board-grid.plain .board-cover {
          display: none;
        }
        .board-info {
          padding: 10px 12px 14px;
        }
        .board-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .board-meta {
          margin: 6px 0 0;
          color: #7b7b84;
          font-size: 13px;
        }

        /* Clean rounded icon-only segmented control (pill) */
        .segmented-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border-radius: 999px;
          padding: 6px;
          border: 1px solid rgba(16,16,20,0.08);
          box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset;
        }

        .seg-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 160ms ease;
          user-select: none;
          position: relative;
          color: #5b5b66;
          background: transparent;
          border: none;
          outline: none;
        }

        .seg-btn:hover {
          transform: translateY(-2px);
          background: rgba(16,16,20,0.03);
        }

        .seg-btn:focus {
          box-shadow: 0 0 0 4px rgba(34, 100, 255, 0.08);
        }

        .seg-btn.active {
          background: linear-gradient(180deg, rgba(16,16,20,0.04), rgba(16,16,20,0.02));
          color: #111;
          box-shadow: 0 6px 14px rgba(16,16,20,0.06);
          transform: translateY(-1px);
        }

        /* small label under control (optional) */
        .seg-labels {
          display: inline-flex;
          gap: 10px;
          margin-left: 10px;
          align-items: center;
          color: #6b6b75;
          font-size: 13px;
        }

        /* visually hidden text for a11y (if you want) */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>

      {/* Rounded icon-only segmented control */}
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center" }}>
        <div className="segmented-pill" role="tablist" aria-label="View mode">
          <button
            className={`seg-btn ${viewMode === "wide" ? "active" : ""}`}
            onClick={() => setViewMode("wide")}
            title="Wide view"
            aria-pressed={viewMode === "wide"}
            aria-label="Wide view"
          >
            <MdViewModule size={18} />
            <span className="sr-only">Wide</span>
          </button>

          <button
            className={`seg-btn ${viewMode === "compact" ? "active" : ""}`}
            onClick={() => setViewMode("compact")}
            title="Compact view"
            aria-pressed={viewMode === "compact"}
            aria-label="Compact view"
          >
            <MdViewDay size={18} />
            <span className="sr-only">Compact</span>
          </button>

          <button
            className={`seg-btn ${viewMode === "plain" ? "active" : ""}`}
            onClick={() => setViewMode("plain")}
            title="Plain list"
            aria-pressed={viewMode === "plain"}
            aria-label="Plain list"
          >
            <MdTextFields size={18} />
            <span className="sr-only">Plain</span>
          </button>
        </div>

        {/* optional descriptive labels - remove if you prefer purely icon-only */}
        <div className="seg-labels" aria-hidden="true">
          <div style={{ opacity: viewMode === "wide" ? 1 : 0.5 }}>Wide</div>
          <div style={{ opacity: viewMode === "compact" ? 1 : 0.5 }}>Compact</div>
          <div style={{ opacity: viewMode === "plain" ? 1 : 0.5 }}>Plain</div>
        </div>
      </div>

      {boards.length === 0 && <p>No boards to show</p>}

      <div className={`board-grid ${viewMode}`}>
        {boards.map((board) => {
          const imgs = latestboardimages[board.id] || [];
          return (
            <div
              key={board.id}
              className="board-item"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <div className="board-cover">
                <div className="main-image">
                  <img
                    src={
                      imgs[0] ||
                      "https://e1.pxfuel.com/desktop-wallpaper/472/398/desktop-wallpaper-plain-white-gallery-white-plain.jpg"
                    }
                    alt=""
                  />
                </div>
                <div className="preview-images">
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
                </div>
              </div>

              <div className="board-info">
                <h4 className="board-title">{board.title}</h4>
                <div className="board-meta">
                  {board.ownerId === user.uid
                    ? "👑 You own this board"
                    : "🤝 Shared with you"}
                </div>
              </div>

              {/* 3-dot menu */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenFor(board.id);
                }}
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  padding: "6px",
                  borderRadius: "50%",
                  cursor: "pointer",
                }}
              >
                ⋮
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
                    onClick={() => {
                      setMenuOpenFor(null);
                      handleRename(board.id, board.title);
                    }}
                    style={{
                      padding: "10px 14px",
                      fontSize: "14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <MdEdit size={18} /> Rename
                  </div>
                  <div
                    onClick={() => {
                      setMenuOpenFor(null);
                      handleDelete(board.id);
                    }}
                    style={{
                      padding: "10px 14px",
                      fontSize: "14px",
                      cursor: "pointer",
                      color: "red",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
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
