import { useEffect, useState,useRef } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
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
        q = query(collection(db, "boards"), where("ownerId", "==", user.uid));
      } else if (selected === "Shared with Me") {
        q = query(collection(db, "boards"), where("sharedWith", "array-contains", user.uid));
      } else {
        const ownedQuery = query(collection(db, "boards"), where("ownerId", "==", user.uid));
        const sharedQuery = query(collection(db, "boards"), where("sharedWith", "array-contains", user.uid));
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

const handleDelete = (boardId) => {
  const confirm = window.confirm("Are you sure you want to delete this board?");
  if (confirm) {
    const boardRef = doc(db, "boards", boardId);
    deleteDoc(boardRef);
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
            padding: "12px",
            marginBottom: "12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <div
            onClick={() => navigate(`/board/${board.id}`)}
            style={{ paddingRight: "24px" }}
          >
            <strong>{board.title}</strong>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {board.ownerId === user.uid
                ? "👑 You own this board"
                : "🤝 Shared with you"}
            </div>
          </div>

          {/* Three Dots Button */}
          <div
            onClick={(e) => {
              e.stopPropagation(); // Prevent navigating
              setMenuOpenFor(menuOpenFor === board.id ? null : board.id);
            }}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              fontSize: "20px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <FiMoreVertical />
          </div>

          {/* Dropdown Menu */}
      {menuOpenFor === board.id && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "40px",
            right: "12px",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
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
              padding: "8px 12px",
              fontSize: "14px",
              cursor: "pointer",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <MdEdit style={{ fontSize: "18px" }} />
            <span>Rename</span>
          </div>

          <div
            onClick={() => {
              setMenuOpenFor(null);
              handleDelete(board.id);
            }}
            style={{
              padding: "8px 12px",
              fontSize: "14px",
              cursor: "pointer",
              color: "red",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiTrash2 style={{ fontSize: "18px" }} />
            <span>Delete</span>
          </div>
        </div>
      )}
        </div>
      ))}
    </div>
  );
}
