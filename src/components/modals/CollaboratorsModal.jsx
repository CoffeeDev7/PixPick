import React, { useEffect, useMemo, useRef, useState } from "react";
import { PLACEHOLDERS } from "../../lib/images";
import "./CollaboratorsModal.css";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getRoleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "viewer") return "Viewer";
  return "Can edit";
}

const CollaboratorsModal = ({
  isOpen,
  onClose,
  boardTitle,
  accessEntries,
  recentShares,
  shareLink,
  canUseNativeShare,
  onInviteCollaborator,
  onCopyLink,
  onShareBoard,
}) => {
  const overlayRef = useRef(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const collaboratorEmails = useMemo(
    () => new Set((accessEntries || []).map((entry) => normalizeEmail(entry.email)).filter(Boolean)),
    [accessEntries]
  );

  const visibleSuggestions = useMemo(
    () =>
      (recentShares || []).filter(
        (entry) => entry?.email && !collaboratorEmails.has(normalizeEmail(entry.email))
      ),
    [collaboratorEmails, recentShares]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setInviteEmail("");
    setFeedback(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      setFeedback({ type: "error", text: "Enter an email address to add a collaborator." });
      return;
    }

    setInvitePending(true);
    setFeedback(null);

    try {
      const result = await onInviteCollaborator(email);
      if (result?.message) {
        setFeedback({ type: result.ok ? "success" : "error", text: result.message });
      }
      if (result?.ok) setInviteEmail("");
    } finally {
      setInvitePending(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="access-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="access-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Board access"
      >
        <div className="access-modal__hero">
          <div>
            <span className="access-modal__eyebrow">Board access</span>
            <h3>{boardTitle || "Untitled board"}</h3>
            <p>Private by default. People need to sign in with Google before they can open this board.</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="access-modal__close"
          >
            ×
          </button>
        </div>

        <div className="access-modal__body">
          <div className="access-modal__top-grid">
            <section className="access-modal__section access-modal__section--share">
              <div className="access-modal__section-head">
                <div>
                  <h4>Share this board</h4>
                  <p>Send the link, then add the person so they can actually open it.</p>
                </div>
              </div>

              <div className="access-modal__share-card">
                <div className="access-modal__share-copy">
                  <span>Share link</span>
                  <strong>{String(shareLink || "").replace(/^https?:\/\//, "")}</strong>
                </div>
                <div className="access-modal__button-row">
                  <button type="button" className="access-modal__ghost-btn" onClick={onCopyLink}>
                    Copy link
                  </button>
                  <button type="button" className="access-modal__primary-btn" onClick={onShareBoard}>
                    {canUseNativeShare ? "Share board" : "Share board"}
                  </button>
                </div>
              </div>
            </section>

            <section className="access-modal__section">
              <div className="access-modal__section-head">
                <div>
                  <h4>Add collaborator</h4>
                  <p>Invite by email. Best case: someone who has already signed into PixPick with Google.</p>
                </div>
              </div>

              <form className="access-modal__invite-form" onSubmit={handleSubmit}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (feedback) setFeedback(null);
                  }}
                  placeholder="name@example.com"
                  className="access-modal__email-input"
                  autoComplete="email"
                />
                <button type="submit" className="access-modal__primary-btn" disabled={invitePending}>
                  {invitePending ? "Adding..." : "Add collaborator"}
                </button>
              </form>

              {visibleSuggestions.length > 0 && (
                <div className="access-modal__suggestions">
                  <span className="access-modal__suggestions-label">Recent people</span>
                  <div className="access-modal__suggestions-list">
                    {visibleSuggestions.map((entry) => (
                      <button
                        key={entry.email}
                        type="button"
                        className="access-modal__suggestion-chip"
                        onClick={() => {
                          setInviteEmail(entry.email);
                          setFeedback(null);
                        }}
                      >
                        <img
                          src={entry.photoURL || PLACEHOLDERS.profile}
                          alt={entry.displayName || entry.email}
                          onError={(e) => {
                            e.currentTarget.src = PLACEHOLDERS.profile;
                          }}
                        />
                        <span>
                          <strong>{entry.displayName || entry.email}</strong>
                          <small>{entry.email}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {feedback?.text && (
                <div className={`access-modal__feedback is-${feedback.type}`}>{feedback.text}</div>
              )}
            </section>
          </div>

          <section className="access-modal__section access-modal__section--access">
            <div className="access-modal__section-head">
              <div>
                <h4>{accessEntries.length} people with access</h4>
                <p>Owner first, then everyone who can currently open this board.</p>
              </div>
            </div>

            <div className="access-modal__list-shell">
              <div className="access-modal__list">
              {accessEntries.map((profile) => (
                <div key={profile.uid || profile.email || profile.displayName} className="access-modal__person-card">
                  <div className="access-modal__avatar-wrap">
                    <img
                      src={profile.photoURL || PLACEHOLDERS.profile}
                      alt={profile.displayName || "Unknown User"}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDERS.profile;
                      }}
                      className="access-modal__avatar"
                    />
                  </div>

                  <div className="access-modal__person-copy">
                    <strong>{profile.displayName || "Unknown User"}</strong>
                    <span>{profile.email || "No email provided"}</span>
                  </div>

                  <div className="access-modal__badges">
                    {profile.isCurrentUser && <span className="access-modal__badge access-modal__badge--self">You</span>}
                    <span className={`access-modal__badge access-modal__badge--${profile.role || "collaborator"}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorsModal;
