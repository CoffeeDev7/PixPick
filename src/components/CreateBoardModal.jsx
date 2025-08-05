import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { query, where, getDocs } from 'firebase/firestore';


export default function CreateBoardModal({ user, onCreate }) {
  const [title, setTitle] = useState("");

  const createBoard = async () => {
    if (!title.trim()) return;
    await addDoc(collection(db, "boards"), {
      title,
      ownerId: user.uid,
      sharedWith: [],
      createdAt: serverTimestamp(),
    });
    setTitle("");
    onCreate(); // signal parent to reload boards
  };

  return (
    // <div style={{ marginTop: '1rem' }}>
    //   <input
    //     value={title}
    //     onChange={(e) => setTitle(e.target.value)}
    //     placeholder="Enter board name"
    //     style={{
    //       padding: '8px',
    //       borderRadius: '6px',
    //       border: '1px solid #ccc',
    //       marginRight: '0.5rem'
    //     }}
    //   />
    //   <button onClick={createBoard} style={{ backgroundColor: '#3debabff', borderRadius: '26px'}}>+ Create Board</button>
    // </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        margin: "16px 0",
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New board name"
        style={{
          flex: 1,
          padding: "12px 12px",
          fontSize: "16px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          outline: "none",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          
        }}
      />

      <button
        onClick={createBoard}
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "8px",
          backgroundColor: "#f1f3f4",
          border: "none",
          fontSize: "24px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "#e0e0e0")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "#f1f3f4")
        }
      >
        +
      </button>
    </div>
  );
}
