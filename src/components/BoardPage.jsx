// src/components/BoardPage.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export default function BoardPage({ user }) {
  const { id: boardId } = useParams();
  const [images, setImages] = useState([]);
  const pasteRef = useRef();

  useEffect(() => {
    // Auto-focus paste area
    pasteRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'boards', boardId, 'images'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setImages(items);
    });
    return () => unsubscribe();
  }, [boardId]);

  const handlePaste = async (event) => {
    let handled = false;
    if (event.clipboardData && event.clipboardData.items) {
      for (let item of event.clipboardData.items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = async function (e) {
            await saveImageToFirestore(e.target.result);
          };
          reader.readAsDataURL(file);
          handled = true;
        }
      }
    }

    if (!handled) {
      const text = event.clipboardData.getData('text');
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        await saveImageToFirestore(text);
      }
    }

    if (handled) event.preventDefault();
    event.target.value = '';
  };

  const saveImageToFirestore = async (src) => {
    const imageRef = collection(db, 'boards', boardId, 'images');
    await addDoc(imageRef, {
      src,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      rating: null,
    });
  };

  const handleRatingChange = async (imageId, newRating) => {
    const imageDocRef = doc(db, 'boards', boardId, 'images', imageId);
    await updateDoc(imageDocRef, { rating: newRating });
  };

  return (
    <div>
      <h2>📋 Board: {boardId}</h2>
      <p>📱 On phone: Tap the green box, then long press to paste</p>
      <textarea
        ref={pasteRef}
        placeholder="Long press and tap Paste"
        onPaste={handlePaste}
        rows={2}
        style={{
          display: 'block',
          width: '100%',
          height: '80px',
          border: '2px dashed #4caf50',
          background: '#eaffea',
          fontSize: '16px',
          marginBottom: '16px',
          padding: '10px',
          borderRadius: '8px',
          boxSizing: 'border-box'
        }}
      />

      <div className="image-container" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        justifyContent: 'space-between'
      }}>
        {images.map((img) => (
          <div key={img.id} className="img-box" style={{
            flex: '0 1 48%',
            boxSizing: 'border-box',
            background: 'white',
            borderRadius: '8px',
            padding: '8px',
            marginBottom: '12px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            <img src={img.src} alt="pasted" style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
              borderRadius: '6px'
            }} />
            <select
              value={img.rating || ''}
              onChange={(e) => handleRatingChange(img.id, e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Rate this</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
