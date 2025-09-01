import React from 'react';

// This new component handles the full-screen modal
const ImageModal = ({
  images,
  modalIndex,
  setModalIndex,
  commentCounts,
  openCommentsForIndex,
  handleDeleteImage,
  isMobile,
}) => {
  if (modalIndex === null) {
    return null;
  }

  // Touch handlers for swipe navigation
  const touchStartX = React.useRef(null);
  const touchEndX = React.useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
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

  const currentImage = images[modalIndex];

  return (
    <div
      onClick={() => setModalIndex(null)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <img
        src={currentImage?.src}
        alt="Full view"
        style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.4)', transition: 'transform 0.3s ease' }}
      />

      {/* toolbar under the image inside the modal: Comment button (keeps same visual position as before) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: "8%",
          left: isMobile ? "40%" : "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        <button
          aria-label="Image comments"
          onClick={() => openCommentsForIndex(modalIndex)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))",
            color: "#fff",
            boxShadow: "0 10px 30px rgba(11,85,94,0.18)",
            cursor: "pointer",
            transform: "translateZ(0)",
            transition: "transform .12s ease, box-shadow .12s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 18px 40px rgba(11,85,94,0.22)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 10px 30px rgba(11,85,94,0.18)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>
            {commentCounts[currentImage?.id] ?? 0}
          </span>
        </button>
      </div>

      {/* Trash icon */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: '8%',
          left: isMobile ? '60%' : '55%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <button
          aria-label="Delete"
          onClick={() => handleDeleteImage(currentImage?.id, modalIndex)}
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            padding: '8px 12px',
            color: '#fff',
            borderRadius: 999,
            cursor: 'pointer',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageModal;