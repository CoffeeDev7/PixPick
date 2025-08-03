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
      createdAt: serverTimestamp()
    });
    setTitle("");
    onCreate(); // signal parent to reload boards
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter board name"
        style={{
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          marginRight: '0.5rem'
        }}
      />
      <button onClick={createBoard}>+ Create Board</button>
    </div>
  );
}
