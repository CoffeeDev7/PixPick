import React from 'react';
import commenticon from '../../assets/comment-add-svgrepo-com.svg';

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

  // Desktop hover / toolbar visibility state
  const [isDesktop, setIsDesktop] = React.useState(true);
  const [showToolbar, setShowToolbar] = React.useState(true); // mobile default true
  const hideTimerRef = React.useRef(null);

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

  React.useEffect(() => {
    // detect desktop (hover capable) devices
    let mq;
    const check = () => {
      const canHover = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
        : !('ontouchstart' in window);
      setIsDesktop(!!canHover);
      // show toolbar by default on mobile, hidden by default on desktop
      setShowToolbar(!canHover);
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

  // make the timeout a little longer so it doesn't feel twitchy
  const VISIBILITY_MS = 500;

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowToolbar(false);
      hideTimerRef.current = null;
    }, VISIBILITY_MS);
  };

  const handleMouseEnter = () => {
    if (!isDesktop) return;
    setShowToolbar(true);
    scheduleHide();
  };

  const handleMouseMove = () => {
    if (!isDesktop) return;
    setShowToolbar(true);
    scheduleHide();
  };

  // IMPORTANT: don't hide immediately on leave — allow the user to move into toolbar
  const handleMouseLeave = () => {
    if (!isDesktop) return;
    scheduleHide();
  };

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const currentImage = images[modalIndex];

  // shared toolbar fade style
  const toolbarFadeStyle = {
    opacity: showToolbar ? 1 : 0,
    transition: 'opacity 220ms ease',
    pointerEvents: showToolbar ? 'auto' : 'none',
  };

  return (
    <div
      onClick={() => setModalIndex(null)}
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
      <img
        src={currentImage?.src}
        alt="Full view"
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          cursor: 'pointer',
          borderRadius: '8px',
          boxShadow: '0 0 20px rgba(0,0,0,0.4)',
          transition: 'transform 0.3s ease',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        draggable={false}
      />

      {/* toolbar under the image inside the modal:
          Add mouse handlers to the toolbar container so moving from image -> toolbar
          doesn't trigger immediate hide. */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          e.stopPropagation();
          // keep visible while mouse is over toolbar
          clearHideTimer();
          setShowToolbar(true);
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
          clearHideTimer();
          setShowToolbar(true);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          // schedule hide when leaving toolbar
          scheduleHide();
        }}
        style={{
          position: 'absolute',
          bottom: '8%',
          left: isMobile ? '40%' : '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          pointerEvents: 'auto',
          ...toolbarFadeStyle,
        }}
      >
        <button
          aria-label="Image comments"
          onClick={() => openCommentsForIndex(modalIndex)}
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
          }}
        >
          <img width="18" height="18" src={commenticon} alt="comments" />
          {commentCounts[currentImage?.id] != 0 && (
            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
              {commentCounts[currentImage?.id] ?? 0}
            </span>
          )}
        </button>
      </div>

      {/* Trash icon */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          e.stopPropagation();
          clearHideTimer();
          setShowToolbar(true);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          scheduleHide();
        }}
        style={{
          position: 'absolute',
          bottom: '8%',
          left: isMobile ? '60%' : '55%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          ...toolbarFadeStyle,
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
            transition: 'transform .12s ease, box-shadow .12s ease',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"fill="none"stroke="#fff"strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
            <polyline points="3 6 5 6 21 6" /> <path d="M19 6l-1 14H6L5 6" /> <path d="M10 11v6" />  <path d="M14 11v6" /> <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageModal;
