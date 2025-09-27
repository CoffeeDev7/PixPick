import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import commenticon from '../../assets/comment-add-svgrepo-com.svg';
import rotateicon from '../../assets/rotate-cw-svgrepo-com.svg';
import infoicon from '../../assets/info-svgrepo-com.svg';

// InfoModal unchanged (kept as you provided)
export const InfoModal = ({ open, onClose, image }) => {
  if (!open) return null;

  function formatSize(bytes) {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  return (
    <div onClick={onClose} style={{ borderRadius: "16px", padding: "20px", width: "320px", maxWidth: "90%", boxShadow: "0 6px 20px rgba(0,0,0,0.4)", maxHeight: "80vh" }}>
      <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", width: "320px", maxWidth: "90%", boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "18px" }}>Image Info</h2>
        <p><strong>Title:</strong> {image?.title || "Mock Title"}</p>
        <p><strong>Uploaded By:</strong> {image?.user || "John Doe"}</p>
        <p><strong>Date:</strong>{" "}
          {image?.createdAt
            ? image.createdAt.toDate
              ? image.createdAt.toDate().toLocaleString()
              : image.createdAt
            : "2025-09-13, 10:00 AM"}
        </p>
        <p><strong>Resolution:</strong> {image?.resolution || "1080x720"}</p>
        <p><strong>Size:</strong>{" "}
          {image?.storage?.size
            ? formatSize(image.storage.size)
            : image?.size
            ? formatSize(image.size)
            : "Unknown"}
        </p>

        <button onClick={onClose} style={{ marginTop: "16px", padding: "8px 12px", border: "none", borderRadius: 999, background: "linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))", color: "#fff", cursor: "pointer" }}>
          Close
        </button>
      </div>
    </div>
  );
};

const ImageModal = ({
  images,
  modalIndex,
  setModalIndex,
  commentCounts,
  openCommentsForIndex,
  handleDeleteImage,
  settings,
}) => {
  if (modalIndex === null) return null;
  const [infoOpen, setInfoOpen] = React.useState(false);

  const touchStartX = React.useRef(null);
  const touchEndX = React.useRef(null);
  const [showOverflow, setShowOverflow] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);
  const [showToolbar, setShowToolbar] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);
  const hideTimerRef = React.useRef(null);
  const [rotationIdx, setRotationIdx] = React.useState(0);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const VISIBILITY_MS = 3500;
  const scheduleHide = () => {
    if (manualOpen) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowToolbar(false);
      hideTimerRef.current = null;
    }, VISIBILITY_MS);
  };

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    let mq;
    const check = () => {
      const canHover =
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
          : !("ontouchstart" in window);
      setIsDesktop(!!canHover);
    };
    check();
    if (window.matchMedia) {
      mq = window.matchMedia("(hover: hover) and (pointer: fine)");
      const onChange = () => check();
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", onChange);
        else if (mq.removeListener) mq.removeListener(onChange);
      };
    }
    return () => {};
  }, []);

  const currentImage = images[modalIndex];

  React.useEffect(() => {
    setRotationIdx(0);
    setManualOpen(false);
    setShowToolbar(false);
  }, [modalIndex]);

  const rotationDeg = rotationIdx * 90;
  const rotateImage = () => setRotationIdx((r) => r + 1);

  const prevImage = (e) => {
  if (e) e.stopPropagation();
  if (isAnimatingRef.current) return;
  directionRef.current = -1;
  setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
};

const nextImage = (e) => {
  if (e) e.stopPropagation();
  if (isAnimatingRef.current) return;
  directionRef.current = 1;
  setModalIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
};

  const toggleOverflow = (e) => {
    e.stopPropagation();
    const next = !manualOpen;
    setManualOpen(next);
    setShowToolbar(next);
    if (!next) clearHideTimer();
    else clearHideTimer();
  };

  const onBackdropClick = () => {
    setManualOpen(false);
    setShowToolbar(false);
    setModalIndex(null);
  };

  // Touch handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };
// --- update handleTouchEnd to also respect isAnimatingRef and set direction BEFORE state ---
const handleTouchEnd = () => {
  if (isAnimatingRef.current) {
    touchStartX.current = null;
    touchEndX.current = null;
    return;
  }

  if (touchStartX.current !== null && touchEndX.current !== null) {
    const delta = touchEndX.current - touchStartX.current;
    const threshold = 40;

    if (delta > threshold) {
      // swipe right => previous
      directionRef.current = -1;
      setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    } else if (delta < -threshold) {
      // swipe left => next
      directionRef.current = 1;
      setModalIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }
  }

  touchStartX.current = null;
  touchEndX.current = null;
};



  // --- replace keyboard useEffect with this (sets direction FIRST) ---
React.useEffect(() => {
  const handleKeyDown = (e) => {
    if (modalIndex === null || isAnimatingRef.current) return;

    if (e.key === "ArrowLeft") {
      directionRef.current = -1;
      setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    } else if (e.key === "ArrowRight") {
      directionRef.current = 1;
      setModalIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (e.key === "Escape") {
      setModalIndex(null);
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [modalIndex, images.length]);

  // direction: +1 = next (slide left), -1 = prev (slide right)
  // derive direction from last user action by storing it in ref when changing index
  const directionRef = React.useRef(1);
  // --- add this ref near other refs ---
  const isAnimatingRef = React.useRef(false);
  React.useEffect(() => {
    // whenever modalIndex changes we assume directionRef already set by prev/next handlers
    // (we set it below in onClick handlers)
  }, [modalIndex]);

  // When user clicks prev/next we updated directionRef; ensure our prev/next update it:
  const handlePrev = (e) => { if (e) e.stopPropagation(); directionRef.current = -1; prevImage(e); };
  const handleNext = (e) => { if (e) e.stopPropagation(); directionRef.current = 1; nextImage(e); };

  // === motion variants for entering/exiting ===
  const imageVariants = {
    enter: ({ dir }) => ({
      opacity: 0,
      x: 600 * dir,
      scale: 0.986,
      transition: {
        type: "spring",
        stiffness:60,
        damping: 34,
        mass: 0.6,
      },
    }),
    center: ({ rotation }) => ({
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        delay: 0.06,
        type: "spring",
        stiffness: 420,
        damping: 30,
        mass: 0.8,
      },
      // rotation is handled on the inner <img> (so variants don't fight transforms)
    }),
    exit: ({ dir }) => ({
      opacity: 0,
      x: -600 * dir,
      scale: 0.986,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 34,
        mass: 0.6,
      },
    }),
  };

  // style for fade toolbar
  const toolbarFadeStyle = {
    opacity: showToolbar ? 1 : 0,
    transition: "opacity 180ms ease",
    pointerEvents: showToolbar ? "auto" : "none",
  };

  return (
    <div
      onClick={onBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
    >
      <div
        style={{
          position: "relative",
          display: "inline-block",
          // a predictable container so that animated children don't jump around
          width: "min(90vw, 1200px)",
          height: "min(90vh, 800px)",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowOverflow(true)}
        onMouseLeave={() => setShowOverflow(false)}
      >
        {/* AnimatePresence wraps a motion.div container per image.
            We set key=modalIndex so switching index mounts/unmounts the motion.div */}
            {console.log('settings in modal:', settings)}
            {console.log('settings.animateEnabled:', settings?.animateEnabled)}
        {settings.animateEnabled ? (
          <AnimatePresence initial={false} custom={{ dir: directionRef.current, rotation: rotationDeg }}>
            <motion.div
              key={currentImage?.id ?? modalIndex}            // use stable id if available
              custom={{ dir: directionRef.current, rotation: rotationDeg }}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                pointerEvents: "auto",
                objectFit: "contain",
              }}
              onClick={() => setModalIndex(null)}
            >
              {/* Inner image is purely rotated by CSS so framer's translate/opacity doesn't fight rotate */}
              <img
                src={currentImage?.src}
                alt="Full view"
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  cursor: "pointer",
                  borderRadius: "8px",
                  boxShadow: "0 0 20px rgba(0,0,0,0.4)",
                  userSelect: "none",
                  transform: `rotate(${rotationDeg}deg)`,
                  transition: "transform 300ms ease",
                }}
                draggable={false}
                onClick={() => setModalIndex(null)}
              />
            </motion.div>
        </AnimatePresence>) :
         ( <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                pointerEvents: "auto",
              }}
              onClick={() => setModalIndex(null)}>
                
            <img
                src={currentImage?.src}
                alt="Full view"
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  cursor: "pointer",
                  borderRadius: "8px",
                  boxShadow: "0 0 20px rgba(0,0,0,0.4)",
                  userSelect: "none",
                  transform: `rotate(${rotationDeg}deg)`,
                  transition: "transform 300ms ease",
                }}
                draggable={false}
                onClick={() => setModalIndex(null)}
              />
          </div>
        )}
        

        {/* Overflow button */}
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 2,
            right: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            opacity: isDesktop ? (showOverflow ? 1 : 0) : 1,
            transition: "opacity 200ms ease",
            pointerEvents: isDesktop ? (showOverflow ? "auto" : "none") : "auto",
          }}
        >
          <button
            aria-label="More actions"
            title="More"
            onClick={(e) => {
              e.stopPropagation();
              toggleOverflow(e);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              width: isDesktop ? 44 : 28,
              height: isDesktop ? 34 : 28,
              borderRadius: 10,
              border: "none",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              lineHeight: 1,
              boxShadow: manualOpen ? "0 10px 30px rgba(11,85,94,0.18)" : "none",
              transition: "transform .12s ease, box-shadow .12s ease, background .12s ease",
              outline: "none",
            }}
          >
            ⋯
          </button>
        </div>

        {/* Center toolbar */}
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            pointerEvents: "auto",
            zIndex: 1050,
            ...toolbarFadeStyle,
          }}
        >
          <button
            aria-label="Rotate image"
            title="Rotate"
            onClick={(e) => {
              e.stopPropagation();
              rotateImage();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 12px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))",
              color: "#fff",
              cursor: "pointer",
              transition: "transform .12s ease, box-shadow .12s ease, background .12s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <img width="18" height="18" src={rotateicon} alt="rotate" />
          </button>

          <button
            aria-label="Info image"
            title="Info"
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen(true);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 12px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))",
              color: "#fff",
              cursor: "pointer",
              transition: "transform .12s ease, box-shadow .12s ease, background .12s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <img width="18" height="18" src={infoicon} alt="info" />
          </button>

          <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} image={currentImage} />

          <button
            aria-label="Image comments"
            onClick={(e) => {
              e.stopPropagation();
              openCommentsForIndex(modalIndex);
            }}
            onTouchStart={(e) => e.stopPropagation()}
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
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <img width="18" height="18" src={commenticon} alt="comments" />
            {commentCounts[currentImage?.id] != 0 && (
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                {commentCounts[currentImage?.id] ?? 0}
              </span>
            )}
          </button>

          <button
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteImage(currentImage?.id, modalIndex);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "none",
              padding: "8px 12px",
              color: "#fff",
              borderRadius: 999,
              cursor: "pointer",
              display: "flex",
              gap: 8,
              alignItems: "center",
              transition: "transform .12s ease, box-shadow .12s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
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

        {/* Arrow Buttons (use handlePrev/handleNext so directionRef updates) */}
        <button
          aria-label="Previous image"
          onClick={(e) => { directionRef.current = -1; prevImage(e); }}
          onTouchStart={(e) => { e.stopPropagation(); directionRef.current = -1; prevImage(); }}
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1200,
            width: isDesktop ? 56 : 0,
            height: isDesktop ? 64 : 0,
            borderRadius: 12,
            border: "none",
            background: "rgba(0,0,0,0.02)",
            opacity: isDesktop ? 0.4 : 0,
            display: isDesktop ? "inline-flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 150ms ease, transform 120ms ease",
            pointerEvents: isDesktop ? "auto" : "none",
            outline: "none",
            backdropFilter: "blur(4px)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.transform = 'translateY(-50%)'; }}
        >
          <svg width="18" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          aria-label="Next image"
          onClick={(e) => { directionRef.current = 1; nextImage(e); }}
          onTouchStart={(e) => { e.stopPropagation(); directionRef.current = 1; nextImage(); }}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1200,
            width: isDesktop ? 56 : 0,
            height: isDesktop ? 64 : 0,
            borderRadius: 12,
            border: "none",
            background: "rgba(0,0,0,0.02)",
            opacity: isDesktop ? 0.4 : 0,
            display: isDesktop ? "inline-flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 150ms ease, transform 120ms ease",
            pointerEvents: isDesktop ? "auto" : "none",
            outline: "none",
            backdropFilter: "blur(4px)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translateY(-50%) translateX(-4px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; e.currentTarget.style.transform = 'translateY(-50%)'; }}
        >
          <svg width="18" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageModal;
