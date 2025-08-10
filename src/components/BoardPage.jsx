// src/components/BoardPage.jsx
import { use, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  getDocs,
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
  const [toast, setToast] = useState(null); // { msg: string, type: 'info' | 'error' | 'success' }
  const [modalIndex, setModalIndex] = useState(null);

  const pasteRef = useRef();
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorUIDs, setCollaboratorUIDs] = useState([]);
  const [collaboratorProfiles, setcollaboratorProfiles] = useState([]);

  // fetch collaborator UIDs when the boardId changes
useEffect(() => {
  async function fetchCollaboratorAndOwnerUIDs() {
    if (!boardId) return;

    // 1. Get the board document to extract owner UID
    const boardRef = doc(db, "boards", boardId);
    const boardSnap = await getDoc(boardRef);
    if (!boardSnap.exists()) return;

    const ownerUID = boardSnap.data().owner;

    // 2. Get all collaborator document IDs
    const collaboratorsRef = collection(db, "boards", boardId, "collaborators");
    const collaboratorsSnap = await getDocs(collaboratorsRef);
    const collaboratorIDs = collaboratorsSnap.docs.map(doc => doc.id);

    // 3. Merge and remove duplicates using Set
    // ✅ Remove undefined using .filter(Boolean)
    const allUIDs = Array.from(new Set([ownerUID, ...collaboratorIDs].filter(Boolean)));

    // 4. Save to state
    setCollaboratorUIDs(allUIDs);
  }

  fetchCollaboratorAndOwnerUIDs();
}, [boardId]);



useEffect(() => {
  const collaboratorsRef = collection(db, 'boards', boardId, 'collaborators');
  const unsubscribe = onSnapshot(collaboratorsRef, (snapshot) => {
    setCollaborators(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
  return () => unsubscribe();
}, [boardId]);


  // replace your old showToast with this
const showToast = (msg, type = "info", duration = 5000) => {
  // store the duration so progress bar can match it
  setToast({ msg, type, duration });
  setTimeout(() => setToast(null), duration);
};


useEffect(() => {
  async function fetchCollaboratorProfiles() {
    if (!collaboratorUIDs || collaboratorUIDs.length === 0) return;

    try {
      const promises = collaboratorUIDs.map(uid => getDoc(doc(db, "users", uid)));
      const docs = await Promise.all(promises);
      const profiles = docs.map(d => ({ uid: d.id, ...d.data() }));
      setcollaboratorProfiles(profiles);
    } catch (error) {
      console.error("Error fetching collaborator profiles:", error);
    }
  }

  fetchCollaboratorProfiles();
  console.log("collaboratorUIDs", collaboratorUIDs);
  console.log("collaborators:", collaborators);

}, [collaboratorUIDs]);



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

  // nicer uploading toast with spinner and progress bar
  showToast(
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img
        src="/eat (1).png"           // note: file should be in public/ as /eat (1).png
        alt="Uploading"
        style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontWeight: 600 }}>Uploading image…</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
          Hold on — uploading to your board
        </div>
      </div>
    </div>,
    "info",
    20000
  );

  try {
    await addDoc(imageRef, {
      src,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      rating: null,
    });

    // success — compact polished toast
    showToast(
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(180deg,#ffffff10,#ffffff06)",
          }}
        >
          <img src="/octopus.png" alt="Success" style={{ width: 46, height: 46 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 700 }}>Image uploaded</div>
          <div style={{ fontSize: 13, color: "#eafaf0" }}>Ready to view on the board</div>
        </div>
      </div>,
      "success",
      3500
    );
  } catch (err) {
    if (err?.message?.includes('The value of property "src" is longer than')) {
      showToast(
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/water.png" alt="Error" style={{ width: 64, height: 64, borderRadius: 8 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, color: "#ffdede" }}>Image too large</div>
            <div style={{ fontSize: 13, color: "#ffdede" }}>
              Try "Copy image address" instead of copying the image data.
            </div>
          </div>
        </div>,
        "error",
        6000
      );
    } else {
      console.error("Unexpected error saving image:", err);
      showToast(
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            ❌
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, color: "#ffdede" }}>Upload failed</div>
            <div style={{ fontSize: 13, color: "#ffdede" }}>Try again in a moment.</div>
          </div>
        </div>,
        "error",
        5000
      );
    }
  }
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

useEffect(() => {
console.log("collaboratorprofiels:", collaboratorProfiles);
}, [boardId, collaboratorProfiles]);

  return (
    <div style={{ marginTop: "0px" }}>
      <h2
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          userSelect: "none",
          margin:0, // remove default heading margins
          lineHeight: 1.06, // tighten line height so the title + subtitle are compact
          marginBottom: "10px",
          marginTop: "16px",
        }}
      >
        {boardTitle}{" "}
        <span style={{ fontSize: "0.9rem", color: "#888",marginTop: "9px" }}>
          {images.length} {images.length === 1 ? "pick" : "picks"}
        </span>
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0px",
          marginTop: "6px", // small gap — tweak (4px/6px/8px) to taste
          marginBottom: "12px",
          position: "relative", // ensure overlapping works well
        }}
      >
        {collaboratorProfiles.map((profile, i) => (
          <img
            key={profile.uid}
            src={profile.photoURL}
            alt={profile.displayName}
            title={`${profile.displayName} (${profile.uid})`}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "2px solid white",
              objectFit: "cover",
              transform: `translateX(-${i * 10}px)`,
              zIndex: collaboratorProfiles.length - i,
            }}
          />
        ))}
      </div>

      <textarea
        ref={pasteRef}
        placeholder="Long press and tap Paste"
        onPaste={handlePaste}
        rows={2}
        style={{
          display: "block",
          width: "100%",
          height: "45px",
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
      bottom: "84px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 1200,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "auto",
    }}
    role="status"
    aria-live="polite"
  >
    {/* card */}
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        minWidth: 220,
        maxWidth: 420,
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(8,10,20,0.35)",
        color: "#fff",
        background:
          toast.type === "error"
            ? "linear-gradient(180deg,#6f1f1f,#5b1515)"
            : toast.type === "success"
            ? "linear-gradient(180deg,#1b7a2b,#16621f)"
            : "linear-gradient(180deg,#2b5fa8,#1b4aa0)",
      }}
    >
      {/* left icon / avatar */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          background: "rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {/* simple icons — adjust if you want SVGs */}
        {toast.type === "success" ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="#e6ffef" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : toast.type === "error" ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" stroke="#ffdede" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          // info spinner
          <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        )}
      </div>

      {/* message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: "1.05" }}>
          {/* if msg is JSX it will render; if string it will render too */}
          {toast.msg}
        </div>
      </div>

      {/* close button */}
      <button
        onClick={() => setToast(null)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.9)",
          cursor: "pointer",
          fontSize: 16,
          padding: 8,
          marginLeft: 8,
        }}
      >
        ×
      </button>
    </div>

    {/* progress bar for info type */}
    {toast.type === "info" && (
      <div
        style={{
          height: 6,
          width: "100%",
          maxWidth: 420,
          borderRadius: 6,
          overflow: "hidden",
          background: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "linear-gradient(90deg,#ffffff80,#ffffff40)",
            transformOrigin: "left",
            animation: `toast-progress ${toast.duration || 20000}ms linear forwards`,
          }}
        />
      </div>
    )}

    {/* styles */}
    <style>
      {`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes toast-progress {
          from { transform: scaleX(1); opacity: 1; }
          to { transform: scaleX(0); opacity: 0.6; }
        }
      `}
    </style>
  </div>
)}

    </div>
  );
}
