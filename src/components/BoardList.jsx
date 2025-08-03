import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function BoardList({ user, selected }) {
  const [boards, setBoards] = useState([]);
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

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {boards.length === 0 && <p>No boards to show</p>}
      {boards.map(board => (
        <div
          key={board.id}
          onClick={() => navigate(`/board/${board.id}`)}
          style={{
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          <strong>{board.title}</strong>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {board.ownerId === user.uid ? '👑 You own this board' : '🤝 Shared with you'}
          </div>
        </div>
      ))}
    </div>
  );
}
