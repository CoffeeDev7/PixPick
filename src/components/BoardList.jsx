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
          gap: var(--gap); /* default gap for plain mode */
        }

        .board-item {
          background: white;
          border-radius: var(--card-radius);
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(12, 12, 16, 0.05);
          cursor: pointer;
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

        /* Wide mode: each preview image is half the column height */
        .wide .preview-images img {
          width: 100%;
          height: calc(50% - (6px / 2)); /* 6px gap accounted for */
          object-fit: cover;
          object-position: top center;
          display: block;
        }

        /* Compact mode: previews fill their grid cells completely */
        .compact .preview-images img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          display: block;
        }

        /* Compact layout */
        .board-grid.compact {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          /* debug background:  /* background: #9a0b7bff; */ 
        }
          
        .compact .board-cover {
          display: grid;
          height: 150px; /* or whatever height you want */
          grid-template-columns: 1.8fr 1fr; /* main image + previews side-by-side */
          /* debug background:  /* background: #7d9a0bff; */ 
          gap:2px;
          padding: 2px;
        }

        .compact .preview-images {
          display: grid;
          grid-template-rows: repeat(2, 1fr);
          gap: 1px;
          /* debug background:  /* background: #6d1e1eff; */ 
        }

        /* Wide layout */
        .board-grid.wide {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--gap);
          /* debug background:  /* background: #1c1ca4ff; */ 
        }
        .wide .board-cover {
          height: 180px;
          grid-template-columns: 1.5fr 1fr;
          /* debug background:  /* background: #1ca48dff; */ 
        }
        .wide .preview-images {
          display: flex;
          flex-direction: column;
          gap: 6px;
          /* debug background:  /* background: #1a6d93ff; */ 
        }

        /* Plain mode: hide previews and show only the title/meta */
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
      `}</style>

      {/* Toggle Button */}
      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={() => setViewMode("wide")}
          style={{
            marginRight: "8px",
            background: viewMode === "wide" ? "#ddd" : "#fff",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Wide
        </button>
        <button
          onClick={() => setViewMode("compact")}
          style={{
            marginRight: "8px",
            background: viewMode === "compact" ? "#ddd" : "#fff",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Compact
        </button>

        {/* Plain option (shows just the title/meta) */}
        <button
          onClick={() => setViewMode("plain")}
          style={{
            background: viewMode === "plain" ? "#ddd" : "#fff",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Plain
        </button>
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
                    src={imgs[0] || "https://via.placeholder.com/300"}
                    alt=""
                  />
                </div>
                <div className="preview-images">
                  <img
                    src={imgs[1] || "https://via.placeholder.com/300"}
                    alt=""
                  />
                  <img
                    src={imgs[2] || "https://via.placeholder.com/300"}
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
