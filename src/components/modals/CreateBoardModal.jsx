import { useState } from "react";
import { addDoc, collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase"; // adjust path if needed
import "./CreateBoardModal.css"; // optional: for custom styles
import confetti from "canvas-confetti";

export default function CreateBoardModal({ user, onCreate }) {
  const [title, setTitle] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const createBoard = async () => {
    if (!title.trim()) return;

    try {
      // Create the board
      const boardRef = await addDoc(collection(db, "boards"), {
        title,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });

      // Add creator as collaborator
      const collabRef = doc(db, "boards", boardRef.id, "collaborators", user.uid);
      await setDoc(collabRef, {
        id: user.uid,
        role: "owner",
        boardId: boardRef.id,
        boardTitle: title,
        ownerId: user.uid,
      });

      setTitle("");
      setIsOpen(false);
      onCreate();

      //give confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (error) {
      console.error("Error creating board:", error);
    }
  };

  return (
    <>
      {/* "+" button aligned next to title */}
      <button
        className="create-board-btn"
        onClick={() => setIsOpen(true)}
      >
        +
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "flex-start", // ← instead of center
            justifyContent: "center",
            paddingTop: "15vh", // space from top
            overflowY: "auto", // allow scroll if keyboard pushes
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: "linear-gradient(90deg,rgba(27, 153, 159, 1) 0%, rgba(87, 173, 199, 1) 50%, rgba(238, 108, 77, 1) 100%)",
              // from cssgradient.io
              padding: "20px",
              borderRadius: "34px",
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px" }}>Create New Board ✨</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBoard();
              }}
              style={{ display: "flex", gap: "12px" }}
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Board name"
                autoFocus
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  borderRadius: "83px",
                  border: "1px solid #ccc",
                  outline: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "0 16px",
                  borderRadius: "81px",
                  backgroundColor: "#ee6c4d",
                  border: "none",
                  color: "white",
                  fontSize: "16px",
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                  outline: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#3b8dd9")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#ee6c4d")
                }
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
