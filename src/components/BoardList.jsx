import { useEffect, useState,useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FiMoreVertical, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { MdEdit } from 'react-icons/md';

export default function BoardList({ user, selected }) {
  const [boards, setBoards] = useState([]);
  const [menuOpenFor, setMenuOpenFor] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchBoards = async () => {
      let q;

      if (selected === "My Boards") {
        q = query(collection(db, "boards"), where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));
      } else if (selected === "Shared with Me") {
        q = query(collection(db, "boards"), where("sharedWith", "array-contains", user.uid), orderBy("createdAt", "desc"));
      } else {
        const ownedQuery = query(collection(db, "boards"), where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));
        const sharedQuery = query(collection(db, "boards"), where("sharedWith", "array-contains", user.uid), orderBy("createdAt", "desc"));
        const [ownedSnap, sharedSnap] = await Promise.all([getDocs(ownedQuery), getDocs(sharedQuery)]);
        const allBoards = [
          ...ownedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          ...sharedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ];
        setBoards(allBoards);
        return;
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setBoards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return () => unsubscribe();
    };

    fetchBoards();
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
  const confirmDelete = window.confirm("Are you sure you want to delete this board?");
  if (!confirmDelete) return;

  try {
    const boardRef = doc(db, "boards", boardId);

    // Delete all images in the board
    const imagesRef = collection(boardRef, "images");
    const imagesSnap = await getDocs(imagesRef);
    const imageDeletes = imagesSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));

    // Delete all collaborators if the subcollection exists
    const collabRef = collection(boardRef, "collaborators");
    const collabSnap = await getDocs(collabRef);
    const collabDeletes = collabSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));

    // Wait for all deletions to finish
    await Promise.all([...imageDeletes, ...collabDeletes]);

    // Now delete the board document itself
    await deleteDoc(boardRef);
    console.log("Board and its contents deleted successfully.");
  } catch (err) {
    console.error("Error deleting board and subcollections:", err);
    alert("Failed to delete the board completely. Try again.");
  }
};

const menuRef = useRef();

useEffect(() => {
  const handleClickOutside = (e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setMenuOpenFor(null); // close the menu
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);



  return (
    <div style={{ marginTop: "1.5rem" }}>
      {boards.length === 0 && <p>No boards to show</p>}
      {boards.map((board) => (
        <div
          key={board.id}
          style={{
            position: "relative",
            padding: "16px",
            marginBottom: "16px",
            borderRadius: "12px",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            transition: "box-shadow 0.2s ease",
            cursor: "pointer",
          }}
          onClick={() => navigate(`/board/${board.id}`)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)")
          }
        >
          <div>
            <strong style={{ fontSize: "1.1rem" }}>{board.title}</strong>
            <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
              {board.ownerId === user.uid
                ? "👑 You own this board"
                : "🤝 Shared with you"}
            </div>
          </div>

          {/* 3-dots button */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenFor(board.id);
            }}
            style={{
              padding: "6px",
              borderRadius: "50%",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#eee")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 96 960 960"
              width="20"
              fill="#444"
            >
              <circle cx="480" cy="276" r="60" />
              <circle cx="480" cy="576" r="60" />
              <circle cx="480" cy="876" r="60" />
            </svg>
          </div>

          {menuOpenFor === board.id && (
            <div
              ref={menuRef}
              style={{
                position: "absolute",
                top: "60px",
                right: "16px",
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
      ))}
    </div>
  );
}
