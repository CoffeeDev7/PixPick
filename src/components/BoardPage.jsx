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
  updateDoc,
} from 'firebase/firestore';

export default function BoardPage({ user }) {
  const { id: boardId } = useParams();
  const [images, setImages] = useState([]);
  const [boardTitle, setBoardTitle] = useState("");
  const [toast, setToast] = useState("");
  const [modalIndex, setModalIndex] = useState(null);

  const pasteRef = useRef();
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 5000);
  };

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

  const saveImageToFirestore = async (src) => {
    const imageRef = collection(db, "boards", boardId, "images");
    await addDoc(imageRef, {
      src,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      rating: null,
    });
  };

  const handlePaste = async (event) => {
    let handled = false;
    const text = event.clipboardData.getData("text");

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

    const isGoogleRedirect = /google\.com\/imgres.*[?&]imgurl=/i.test(text);
    const isGoogleImageProxy = /images\.app\.goo\.gl/i.test(text);
    const isBrokenGoogleImageCopy = /google\.com\/url\?sa=i/i.test(text);
    const isDirectImageLink = /^https?:\/\/.+\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i.test(text);

    if (isGoogleImageProxy) {
      showToast("⚠️ Can't preview this Google image link. Open it in browser, then copy image directly.");
      handled = true;
    } else if (isBrokenGoogleImageCopy) {
      showToast("⚠️ 'Copy Link Address' from Google Images doesn't work. Try 'Copy Image or Copy Image Address' instead.");
      handled = true;
    } else if (isGoogleRedirect) {
      showToast("⚠️ This is a Google redirect link. Open the image, right-click, and choose 'Copy Image'.");
      handled = true;
    } else if (isDirectImageLink || text.startsWith("data:image/")) {
      await saveImageToFirestore(text);
      handled = true;
    }

    if (handled) event.preventDefault();
    event.target.value = "";
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const delta = touchEndX.current - touchStartX.current;
      const threshold = 50;
      if (delta > threshold) {
        setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (delta < -threshold) {
        setModalIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }

    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // keyword navigation
  useEffect(() => {
  const handleKeyDown = (e) => {
    if (modalIndex === null) return;

    if (e.key === "ArrowLeft") {
      setModalIndex((prev) =>
        prev === 0 ? (images.length - 1) : prev - 1
      );
    } else if (e.key === "ArrowRight") {
      setModalIndex((prev) =>
        prev === images.length - 1 ? 0 : prev + 1
      );
    } else if (e.key === "Escape") {
      setModalIndex(null);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [modalIndex, images.length]);

  return (
    <div style={{ marginTop: "5px" }}>
      <h2 style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
         {boardTitle}{" "} 
        <span style={{ fontSize: "0.9rem", color: "#888" }}>{images.length} {images.length === 1 ? "pick" : "picks"}</span>
      </h2>

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
        {images.map((img, i) => (
          <div
            key={img.id}
            style={{
              flex: "0 1 calc(50% - 6px)",
              background: "white",
              borderRadius: "8px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={img.src}
              alt="pasted"
              style={{
                width: "100%",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onClick={() => setModalIndex(i)}
            />
          </div>
        ))}
      </div>

      {modalIndex !== null && (
        <div
          onClick={() => setModalIndex(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={(e) => {
            touchEndX.current = e.touches[0].clientX;
          }}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={images[modalIndex]?.src}
            alt="Full view"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: "8px",
              boxShadow: "0 0 20px rgba(0,0,0,0.4)",
              transition: "transform 0.3s ease",
            }}
            // onClick={(e) => e.stopPropagation()} // Prevent image click from closing modal
          />
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#222",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: "6px",
            zIndex: 999,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
            fontSize: "14px",
            minWidth: "180px",
            maxWidth: "280px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div>{toast}</div>
          <div
            style={{
              marginTop: "6px",
              height: "4px",
              width: "100%",
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                background: "rgba(255, 255, 255, 0.6)",
                animation: "shrink 5s linear forwards",
              }}
            />
          </div>
          <style>
            {`
              @keyframes shrink {
                from { width: 100%; }
                to { width: 0%; }
              }
            `}
          </style>
        </div>
      )}
    </div>
  );
}
