import {
  doc, getDoc, getDocs, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, deleteDoc, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';

const BoardCommentsModal = ({
  boardCommentsUnsubRef,
  openBoardComments,
  boardCommentModalOpen,
  setBoardCommentModalOpen,
  boardCommentList,
  setBoardCommentList,
  user,
  collaboratorProfiles,
  collaborators,
  boardCommentText,
  setBoardCommentText,
  boardNotifyFriends,
  setBoardNotifyFriends,
  timeAgoShort,
  showToast,
  boardId,
  boardTitle,
}) => {
  if (!boardCommentModalOpen) {
    return null;
  }


  
    const closeBoardComments = () => {
      setBoardCommentModalOpen(false);
      setBoardCommentText('');
      setBoardCommentList([]);
      if (boardCommentsUnsubRef.current) {
        boardCommentsUnsubRef.current();
        boardCommentsUnsubRef.current = null;
      }
    };

      // delete a board-level comment (only allowed for comment author here)
      // If you want the board owner to also be able to delete others' comments,
      // keep an `ownerUID` state (set it when you fetch the board) and allow it.
    const handleDeleteBoardComment = async (commentId, commentCreatorId) => {
      // client-side permission check: only the author can delete here
      if (commentCreatorId !== user.uid) {
        // optionally allow board owner: if (user.uid !== ownerUID) { ... }
        showToast("You can only delete your own comments", "error", 2500);
        return;
      }
  
      const confirmDelete = window.confirm("Delete this comment?");
      if (!confirmDelete) return;
  
      // optimistic UI update
      setBoardCommentList((prev) => prev.filter((c) => c.id !== commentId));
  
      try {
        await deleteDoc(doc(db, "boards", boardId, "comments", commentId));
        showToast("Comment deleted", "success", 1800);
      } catch (err) {
        console.error("Failed to delete comment", err);
        showToast("Could not delete comment — try again", "error", 3000);
  
        // rollback UI (best effort)
        // re-fetch comments or insert back (simpler: re-open the modal which re-subscribes)
        if (typeof openBoardComments === "function") {
          openBoardComments();
        }
      }
    };

    const postBoardComment = async () => {
      if (!boardCommentText.trim()) return;
      try {
        const newDocRef = await addDoc(collection(db, 'boards', boardId, 'comments'), {
          text: boardCommentText.trim(),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
  
        if (boardNotifyFriends && collaborators && collaborators.length > 0) {
          try {
            const collaboratorUIDs = collaborators.map(c => c.id).filter(uid => uid && uid !== user.uid);
            const payload = {
              type: 'board_comment',
              text: `${user.displayName || 'Someone'} commented on the board ${boardTitle || ''}`,
              createdAt: serverTimestamp(),
              read: false,
              boardId,
              actor: user.uid,
              url: `/board/${boardId}`,
            };
            await Promise.all(collaboratorUIDs.map(uid => addDoc(collection(db, 'users', uid, 'notifications'), payload)));
          } catch (err) {
            console.warn('Could not create board comment notifications', err);
          }
        }
  
        setBoardCommentText('');
        setBoardNotifyFriends(false);
        showToast('Comment posted', 'success', 2000);
      } catch (err) {
        console.error('post board comment error', err);
        showToast('Could not post comment', 'error', 3000);
      }
    };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes modal-pop { from { opacity: 0; transform: translateY(8px) scale(.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes row-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            .pp-board-comment-scroll::-webkit-scrollbar { width: 10px; }
            .pp-board-comment-scroll::-webkit-scrollbar-thumb { background: rgba(10,10,12,0.08); border-radius: 8px; }
            .pp-board-comment-scroll::-webkit-scrollbar-track { background: transparent; }
          `,
        }}
      />

      {/* backdrop */}
      <div
        onClick={closeBoardComments}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, rgba(6,18,20,0.18), rgba(6,18,20,0.28))",
          backdropFilter: "blur(6px) saturate(1.05)",
          WebkitBackdropFilter: "blur(6px) saturate(1.05)",
          padding: 20,
        }}
      >
        {/* modal surface */}
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Board comments"
          style={{
            width: "94%",
            maxWidth: 720,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,252,253,0.9))",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 28px 70px rgba(6,10,14,0.36)",
            animation: "modal-pop 220ms cubic-bezier(.2,.9,.2,1)",
          }}
        >
          {/* header */}
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
                  color: "#e6fbff",
                  fontWeight: 800,
                  fontSize: 18,
                  boxShadow: "0 6px 18px rgba(8,10,12,0.08)",
                }}
              >
                🗨️
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Board Comments</div>
                <div style={{ fontSize: 12, opacity: 0.95 }}>Discuss the board with collaborators</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={closeBoardComments}
                aria-label="Close board comments"
                title="Close"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "rgba(255,255,255,0.12)",
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
            className="pp-board-comment-scroll"
            style={{
              padding: 14,
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "linear-gradient(180deg, rgba(255,255,255,0.0), rgba(250,253,254,0.6))",
            }}
          >
            {boardCommentList.length === 0 ? (
              <div
                style={{
                  color: "#274746",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: 20,
                  borderRadius: 10,
                  background: "linear-gradient(180deg, rgba(245,255,255,0.6), rgba(255,255,255,0.35))",
                  border: "1px solid rgba(10,20,20,0.03)",
                }}
              >
                No comments yet.
              </div>
            ) : (
              boardCommentList.map((c, idx) => {
                const profile = collaboratorProfiles.find((p) => p.uid === c.createdBy) || {};
                const isAuthor = c.createdBy === user.uid;
                return (
                  <div
                    key={c.id}
                    tabIndex={0}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,249,251,0.9))",
                      border: "1px solid rgba(6,12,14,0.04)",
                      boxShadow: "0 8px 20px rgba(8,12,16,0.04)",
                      animation: `row-fade ${160 + (idx % 6) * 20}ms ease both`,
                      position: "relative",
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                      <img
                        src={profile.photoURL || "/default-avatar.png"}
                        alt={profile.displayName || c.createdBy}
                        style={{ width: 44, height: 44, objectFit: "cover", display: "block" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#072f30" }}>
                            {profile.displayName || c.createdBy}
                          </div>
                          <div style={{ fontSize: 12, color: "#4b6b6b" }}>{timeAgoShort(c.createdAt)}</div>
                        </div>
                        {/* Delete button always visible for author */}
                        {isAuthor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBoardComment(c.id, c.createdBy);
                            }}
                            aria-label="Delete comment"
                            title="Delete comment"
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b82b2b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                              <path d="M10 11v6M14 11v6"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                      <div style={{ marginTop: 8, color: "#0b2f2f", fontSize: 15, lineHeight: 1.45 }}>
                        {c.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* footer */}
          <div
            style={{
              padding: 14,
              borderTop: "1px solid rgba(10,20,20,0.04)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(250,252,253,0.96))",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div
                  onClick={() => setBoardNotifyFriends(!boardNotifyFriends)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 22,
                    backgroundColor: boardNotifyFriends ? "#1b99bf" : "#d1d5db",
                    position: "relative",
                    transition: "background-color 0.3s ease",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      position: "absolute",
                      top: "50%",
                      left: boardNotifyFriends ? "calc(100% - 20px)" : "2px",
                      transform: "translateY(-50%)",
                      transition: "left 0.3s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
                <span style={{ fontSize: 13, color: "#073238", fontWeight: 700 }}>
                  Notify collaborators
                </span>
              </label>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b8b8b" }}>
                <span title="If checked, your collaborators will receive a notification about this board comment.">
                  {boardNotifyFriends ? "Will notify" : "Won’t notify"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={boardCommentText}
                onChange={(e) => setBoardCommentText(e.target.value)}
                placeholder="Write a comment..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { 
                    e.preventDefault();
                    postBoardComment();
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
                onClick={postBoardComment}
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

export default BoardCommentsModal;