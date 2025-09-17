import {
  doc, getDoc, getDocs, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, deleteDoc, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
// This new component handles the comments modal
const CommentsModal = ({
  commentsUnsubRef,
  commentModalOpen,
  setCommentModalOpen,
  commentList,
  setCommentList,
  user,
  images,
  modalIndex,
  commentText,
  setCommentText,
  collaborators,
  notifyFriends,
  setNotifyFriends,
  showToast,
  boardId,
  boardTitle,
}) => {
  if (!commentModalOpen) {
    return null;
  }

   const postComment = async () => {
      if (!commentText.trim()) return;
      const image = images[modalIndex];
      if (!image) return;
      try {
        const newDocRef = await addDoc(collection(db, 'boards', boardId, 'images', image.id, 'comments'), {
          text: commentText.trim(),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
  
        // optionally notify collaborators (excluding the poster)
        if (notifyFriends && collaborators && collaborators.length > 0) {
          try {
            const collaboratorUIDs = collaborators.map(c => c.id).filter(uid => uid && uid !== user.uid);
            const payload = {
              type: 'comment',
              text: `${user.displayName || 'Someone'} commented on a pick in ${boardTitle || ''}`,
              createdAt: serverTimestamp(),
              read: false,
              boardId,
              imageId: image.id,
              actor: user.uid,
              url: `/board/${boardId}?image=${image.id}`,
            };
            await Promise.all(collaboratorUIDs.map(uid => addDoc(collection(db, 'users', uid, 'notifications'), payload)));
          } catch (err) {
            console.warn('Could not create comment notifications', err);
          }
        }
  
        setCommentText('');
        setNotifyFriends(false); // reset checkbox
        showToast('Comment posted', 'success', 2000);
      } catch (err) {
        console.error('post comment error', err);
        showToast('Could not post comment', 'error', 3000);
      }
    };

    const closeComments = () => {
    setCommentModalOpen(false);
    setCommentText('');
    setCommentList([]);
    if (commentsUnsubRef.current) {
      commentsUnsubRef.current();
      commentsUnsubRef.current = null;
    }
  };

   // delete a single image comment (optimistic UI + Firestore delete)
  const handleDeleteImageComment = async (commentId, commentCreatorId, imageId) => {
    // permission check (client-side): only comment author can delete.
    if (commentCreatorId !== user.uid) {
      showToast("You can only delete your own comments", "error", 2200);
      return;
    }

    const confirmDelete = window.confirm("Delete this comment?");
    if (!confirmDelete) return;

    // optimistic UI: remove immediately from local state
    setCommentList((prev) => prev.filter((c) => c.id !== commentId));

    try {
      await deleteDoc(doc(db, "boards", boardId, "images", imageId, "comments", commentId));
      showToast("Comment deleted", "success", 1600);
    } catch (err) {
      console.error("Failed to delete image comment", err);
      showToast("Could not delete comment — try again", "error", 3000);
      // rollback: re-open subscription for the current image
      if (typeof openCommentsForIndex === "function" && modalIndex !== null) {
        openCommentsForIndex(modalIndex);
      }
    }
  };

  

  return (
    <>
      {/* local keyframes + scrollbar styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes modal-pop { from { opacity: 0; transform: translateY(8px) scale(.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes accent-fade { from { opacity: 0 } to { opacity: 1 } }
            .pp-comment-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
            .pp-comment-scroll::-webkit-scrollbar-thumb { background: rgba(10,10,12,0.08); border-radius: 8px; }
            .pp-comment-scroll::-webkit-scrollbar-track { background: transparent; }
          `,
        }}
      />

      {/* backdrop — semi-transparent gradient + blur */}
      <div
        onClick={closeComments}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(5,20,24,0.18), rgba(5,20,24,0.28))",
          backdropFilter: "blur(6px) saturate(1.05)",
          WebkitBackdropFilter: "blur(6px) saturate(1.05)",
          padding: 20,
        }}
      >
        {/* modal surface (stop propagation so clicks inside don't close) */}
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
          style={{
            width: "94%",
            maxWidth: 720,
            maxHeight: "80vh",
            background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(245,251,253,0.86))",
            borderRadius: 14,
            boxShadow: "0 30px 70px rgba(6,10,14,0.36)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid rgba(255,255,255,0.6)",
            animation: "modal-pop 220ms cubic-bezier(.2,.9,.2,1)",
          }}
        >
          {/* header with teal gradient */}
          <div
            style={{
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              background: "linear-gradient(90deg, rgba(27,153,159,1) 0%, rgba(87,173,199,1) 60%)",
              color: "#fff",
              boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.12)",
                  boxShadow: "0 6px 18px rgba(10,10,12,0.08)",
                  fontWeight: 800,
                  fontSize: 18,
                  color: "#e6fbff",
                }}
              >
                💬
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>
                  Comments
                </div>
                <div style={{ fontSize: 12, opacity: 0.92 }}>
                  Discuss this image with collaborators
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={closeComments}
                aria-label="Close comments"
                title="Close"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "#E23D28 ",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 6px 14px rgba(8,10,12,0.12)",
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* scrollable comments area */}
          <div
            className="pp-comment-scroll"
            style={{
              padding: 14,
              overflowY: "auto",
              flex: 1,
              background: "linear-gradient(180deg, rgba(255,255,255,0.0), rgba(250,253,254,0.4))",
              gap: 10,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {commentList.length === 0 ? (
              <div
                style={{
                  color: "#274746",
                  textAlign: "center",
                  padding: 28,
                  borderRadius: 10,
                  background: "linear-gradient(180deg, rgba(240,255,255,0.6), rgba(255,255,255,0.35))",
                  border: "1px solid rgba(10,20,20,0.03)",
                  fontWeight: 600,
                }}
              >
                No comments yet — be the first to write one.
              </div>
            ) : (
              commentList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 8,
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(248,249,251,0.86))",
                    border: "1px solid rgba(6,12,14,0.03)",
                    boxShadow: "0 8px 20px rgba(8,12,16,0.04)",
                    alignItems: "flex-start",
                  }}
                >
                  <img
                    src={c.creatorPhoto || "/default-avatar.png"}
                    alt={c.creatorName || c.createdBy}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      objectFit: "cover",
                      flexShrink: 0,
                      boxShadow: "0 6px 18px rgba(6,12,14,0.06)",
                      border: "1px solid rgba(255,255,255,0.5)",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#072f30" }}>
                          {c.creatorName || c.createdBy}
                        </div>
                        <div style={{ fontSize: 12, color: "#4b6b6b" }}>
                          {c.createdAt?.seconds
                            ? `${Math.round((Date.now() - c.createdAt.seconds * 1000) / 60000)}m`
                            : ""}
                        </div>
                      </div>
                      {/* delete for owner */}
                      {c.createdBy === user.uid && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImageComment(c.id, c.createdBy, images[modalIndex]?.id);
                          }}
                          aria-label="Delete comment"
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 6,
                            marginLeft: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#b82b2b",
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#b82b2b"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            <path d="M10 11v6M14 11v6"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 8, color: "#0b2f2f", fontSize: 15, lineHeight: 1.4 }}>
                      {c.text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* footer: notify toggle + input */}
          <div
            style={{
              padding: 14,
              borderTop: "1px solid rgba(10,20,20,0.04)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,252,253,0.94))",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Toggle button */}
              <label style={{ position: "relative", display: "inline-block", width: 42, height: 22, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={notifyFriends}
                  onChange={(e) => setNotifyFriends(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: notifyFriends ? "#1b99bf" : "#ccc",
                    borderRadius: 34,
                    transition: "0.3s",
                  }}
                ></span>
                <span
                  style={{
                    position: "absolute",
                    content: '""',
                    height: 16,
                    width: 16,
                    left: notifyFriends ? "22px" : "4px",
                    bottom: 3,
                    backgroundColor: "white",
                    borderRadius: "50%",
                    transition: "0.3s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                ></span>
              </label>
              <span style={{ fontSize: 13, color: "#073238", fontWeight: 700 }}>
                Notify collaborators
              </span>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b8b8b" }}>
                <span title="If checked, your collaborators will receive a notification about this comment.">
                  {notifyFriends ? "Will notify" : "Won't notify"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    postComment();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(6,12,14,0.06)",
                  background: "rgba(255,255,255,0.9)",
                  outline: "none",
                  fontSize: 14,
                  color: "#072f30",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              />
              <button
                onClick={postComment}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(90deg,#1B99BF,#2B5FA8)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 800,
                  boxShadow: "0 8px 20px rgba(27,153,159,0.14)",
                }}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommentsModal;