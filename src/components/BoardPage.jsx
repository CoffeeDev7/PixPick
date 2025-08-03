// src/components/BoardPage.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  getDoc,
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
  const [boardTitle, setBoardTitle] = useState("");
  const [modalsrc, setModalsrc] = useState(null);

  const pasteRef = useRef();

  useEffect(() => {
    const q = query(
      collection(db, "boards", boardId, "images"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setImages(items);
    });
    return () => unsubscribe();
  }, [boardId]);

  useEffect(() => {
    const fetchBoardTitle = async () => {
      const boardRef = doc(db, "boards", boardId);
      const boardSnap = await getDoc(boardRef);
      if (boardSnap.exists()) {
        const data = boardSnap.data();
        setBoardTitle(data.title || "(Untitled)");
      } else {
        setBoardTitle("(Board not found)");
      }
    };
    fetchBoardTitle();
  }, [boardId]);

  const handlePaste = async (event) => {
    let handled = false;
    if (event.clipboardData && event.clipboardData.items) {
      for (let item of event.clipboardData.items) {
        if (item.type.indexOf("image") === 0) {
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
      const text = event.clipboardData.getData("text");
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        await saveImageToFirestore(text);
      }
    }

    if (handled) event.preventDefault();
    event.target.value = "";
  };

  const saveImageToFirestore = async (src) => {
    const imageRef = collection(db, "boards", boardId, "images");
    await addDoc(imageRef, {
      src,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      rating: null,
    });
  };

  const handleRatingChange = async (imageId, newRating) => {
    const imageDocRef = doc(db, "boards", boardId, "images", imageId);
    await updateDoc(imageDocRef, { rating: newRating });
  };

  return (
    <div style={{ marginTop: "60px" }}>
      {" "}
      {/* 60PX IS THE HEIGHT OF THE HEADER */}
      <h2>
        📋 {boardTitle}{" "}
        <span style={{ fontSize: "0.9rem", color: "#888" }}>({boardId})</span>
      </h2>
      {/* <p>📱 On phone: Tap the green box, then long press to paste</p> */}
      <textarea
        ref={pasteRef}
        placeholder="Long press and tap Paste"
        onPaste={handlePaste}
        rows={2}
        style={{
          display: "block",
          width: "100%",
          height: "80px",
          border: "2px dashed #4caf50",
          background: "#eaffea",
          fontSize: "16px",
          marginBottom: "16px",
          padding: "10px",
          borderRadius: "8px",
          boxSizing: "border-box",
        }}
      />
      <div
        className="image-container"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "space-between",
        }}
      >
        {images.map((img) => (
          <div
            key={img.id}
            className="img-box"
            style={{
              flex: "0 1 calc(50% - 6px)",
              boxSizing: "border-box",
              background: "white",
              borderRadius: "8px",

              marginBottom: "12px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={img.src}
              alt="pasted"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onClick={() => setModalsrc(img.src)}
            />

            {modalsrc && (
              <div
                onClick={() => setModalsrc(null)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 999,
                }}
              >
                <img
                  src={modalsrc}
                  alt="Full view"
                  style={{
                    maxWidth: "90%",
                    maxHeight: "90%",
                    borderRadius: "8px",
                    boxShadow: "0 0 20px rgba(0,0,0,0.4)",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
