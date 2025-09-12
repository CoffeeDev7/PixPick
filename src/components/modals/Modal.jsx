import React from 'react';
import commenticon from '../../assets/comment-add-svgrepo-com.svg';
import rotateicon from '../../assets/rotate-cw-svgrepo-com.svg';

const ImageModal = ({
  images,
  modalIndex,
  setModalIndex,
  commentCounts,
  openCommentsForIndex,
  handleDeleteImage,
  isMobile,
}) => {
  if (modalIndex === null) return null;

  // Touch handlers for swipe navigation
  const touchStartX = React.useRef(null);
  const touchEndX = React.useRef(null);

  // new state for overflow visibility (desktop hover)
  const [showOverflow, setShowOverflow] = React.useState(false);

  // Desktop detection (kept for potential future use)
  const [isDesktop, setIsDesktop] = React.useState(true);

  // Toolbar visibility states
  // showToolbar controls visual visibility; manualOpen = toolbar opened by overflow button
  const [showToolbar, setShowToolbar] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);

  const hideTimerRef = React.useRef(null);

  // Rotation state: increments (we keep it unbounded, normalized if needed elsewhere)
  const [rotationIdx, setRotationIdx] = React.useState(0);

  const handleTouchStart = (e) => {
    // keep swipe logic on the backdrop (outer div)
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

  React.useEffect(() => {
    // detect desktop (hover capable) devices - kept for other UI decisions
    let mq;
    const check = () => {
      const canHover =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
          : !('ontouchstart' in window);
      setIsDesktop(!!canHover);
    };
    check();
    if (window.matchMedia) {
      mq = window.matchMedia('(hover: hover) and (pointer: fine)');
      const onChange = () => check();
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else if (mq.removeListener) mq.removeListener(onChange);
      };
    }
    return () => {};
  }, []);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // If you still want a timeout-based auto-hide for non-manual opens, keep VISIBILITY_MS.
  // But when manualOpen is true, scheduleHide will no-op.
  const VISIBILITY_MS = 3500;

  const scheduleHide = () => {
    // do not auto-hide if toolbar was opened manually
    if (manualOpen) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowToolbar(false);
      hideTimerRef.current = null;
    }, VISIBILITY_MS);
  };

  React.useEffect(() => {
    // cleanup timer on unmount
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const currentImage = images[modalIndex];

  // reset rotation and toolbar when switching images
  React.useEffect(() => {
    setRotationIdx(0);
    setManualOpen(false);
    setShowToolbar(false);
  }, [modalIndex]);

  // rotation degrees computed from index
  const rotationDeg = rotationIdx * 90;
  const rotateImage = () => setRotationIdx((r) => r + 1);

  // toggle triggered by the overflow button (⋯)
  const toggleOverflow = (e) => {
    e.stopPropagation();
    const next = !manualOpen;
    setManualOpen(next);
    setShowToolbar(next);
    if (!next) {
      // if closing via overflow, ensure any timers are cleared
      clearHideTimer();
    } else {
      // if opening manually, keep it open until user toggles off
      clearHideTimer();
    }
  };

  // If user clicks outside (backdrop), modal closes. Ensure toolbar state cleared automatically.
  const onBackdropClick = () => {
    setManualOpen(false);
    setShowToolbar(false);
    setModalIndex(null);
  };

  // shared toolbar fade style
  const toolbarFadeStyle = {
    opacity: showToolbar ? 1 : 0,
    transition: 'opacity 180ms ease',
    pointerEvents: showToolbar ? 'auto' : 'none',
  };

  return (
    <div
      onClick={onBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* wrapper around image + controls so controls stick to image */}
      <div
        style={{
          position: 'relative',
          display: 'inline-block', // shrink-wrap to image size
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowOverflow(true)}
        onMouseLeave={() => setShowOverflow(false)}
      >
        {/* image (click to close) */}
        <img
          src={currentImage?.src}
          alt="Full view"
          style={{
            display: 'block',
            maxWidth: '90vw',
            maxHeight: '90vh',
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(0,0,0,0.4)',
            transition: 'transform 300ms ease',
            transform: `rotate(${rotationDeg}deg)`,
          }}
          draggable={false}
          onClick={() => setModalIndex(null)}
        />

        {/* Overflow button (fades in/out on desktop hover; always visible on touch devices) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            opacity: isDesktop ? (showOverflow ? 1 : 0) : 1,
            transition: 'opacity 200ms ease',
            pointerEvents: isDesktop ? (showOverflow ? 'auto' : 'none') : 'auto',
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
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              lineHeight: 1,
              boxShadow: manualOpen ? '0 10px 30px rgba(11,85,94,0.18)' : 'none',
              transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
              outline: 'none',
            }}
          >
            {/* simple overflow glyph */}
            ⋯
          </button>
        </div>

        {/* Centered toolbar that appears only when overflow is toggled (or manualOpen true) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            pointerEvents: 'auto',
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 999,
              border: 'none',
              background:
                'linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))',
              color: '#fff',
              cursor: 'pointer',
              transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <img width="18" height="18" src={rotateicon} alt="rotate" />
          </button>

          <button
            aria-label="Image comments"
            onClick={(e) => {
              e.stopPropagation();
              openCommentsForIndex(modalIndex);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 999,
              border: 'none',
              background:
                'linear-gradient(90deg, rgba(27,153,159,0.95), rgba(43,95,168,0.95))',
              color: '#fff',
              boxShadow: '0 10px 30px rgba(11,85,94,0.18)',
              cursor: 'pointer',
              transform: 'translateZ(0)',
              transition: 'transform .12s ease, box-shadow .12s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <img width="18" height="18" src={commenticon} alt="comments" />
            {commentCounts[currentImage?.id] != 0 && (
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
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
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              padding: '8px 12px',
              color: '#fff',
              borderRadius: 999,
              cursor: 'pointer',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              transition: 'transform .12s ease, box-shadow .12s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
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
    </div>
  );
};

export default ImageModal;
