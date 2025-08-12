// BoardPage.jsx — patched to support deep-links like /board/:id?image=<imageId>
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  deleteDoc,
  limit,
} from 'firebase/firestore';

export default function BoardPage({ user }) {
  const { id: boardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [images, setImages] = useState([]);
  const [boardTitle, setBoardTitle] = useState('');
  const [toast, setToast] = useState(null); // { msg, type, duration }
  const [modalIndex, setModalIndex] = useState(null);

  const pasteRef = useRef();
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorUIDs, setCollaboratorUIDs] = useState([]);
  const [collaboratorProfiles, setcollaboratorProfiles] = useState([]);

  // NEW: loading flag for images
  const [imagesLoading, setImagesLoading] = useState(true);

  // Long-press state for showing delete overlay on a particular image
  const [longPressedIndex, setLongPressedIndex] = useState(null);
  const longPressTimerRef = useRef(null);
  const LONG_PRESS_MS = 400; // 300ms like Pinterest

  // Board menu (3-dots)
  const [showBoardMenu, setShowBoardMenu] = useState(false);

  // put once in the component body (used by other effects sometimes)
  const imagesUnsubRef = useRef(null);

  // -------------------- Toast helper --------------------
  const showToast = (msg, type = 'info', duration = 5000) => {
    setToast({ msg, type, duration });
    setTimeout(() => setToast(null), duration);
  };

  const handleBack = () => {
    if (location.state && location.state.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          navigate(-1);
          return;
        }
      }
    } catch (err) {}
    navigate('/');
  };

  // -------------------- collaborators UIDs --------------------
  useEffect(() => {
    async function fetchCollaboratorAndOwnerUIDs() {
      if (!boardId) return;

      const boardRef = doc(db, 'boards', boardId);
      const boardSnap = await getDoc(boardRef);
      if (!boardSnap.exists()) return;

      const data = boardSnap.data();
      const ownerUID = data.owner || data.ownerId || null;

      const collaboratorsRef = collection(db, 'boards', boardId, 'collaborators');
      const collaboratorsSnap = await getDocs(collaboratorsRef);
      const collaboratorIDs = collaboratorsSnap.docs.map((d) => d.id);

      const allUIDs = Array.from(new Set([ownerUID, ...collaboratorIDs].filter(Boolean)));
      setCollaboratorUIDs(allUIDs);

      // update lastOpenedAt to signal board was opened (useful for the "last opened" display)
      try {
        await updateDoc(boardRef, { lastOpenedAt: serverTimestamp() });
      } catch (err) {
        // ignore if user can't write
      }
    }

    fetchCollaboratorAndOwnerUIDs();
  }, [boardId]);

  // realtime collaborators list
  useEffect(() => {
    if (!boardId) return;
    const collaboratorsRef = collection(db, 'boards', boardId, 'collaborators');
    const unsubscribe = onSnapshot(collaboratorsRef, (snapshot) => {
      setCollaborators(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [boardId]);

  // -------------------- profile caching + fetching --------------------
  useEffect(() => {
    async function fetchCollaboratorProfiles() {
      if (!collaboratorUIDs || collaboratorUIDs.length === 0) return;

      try {
        const TTL = 1000 * 60 * 60 * 24; // 24 hours
        const now = Date.now();

        const results = await Promise.all(
          collaboratorUIDs.map(async (uid) => {
            try {
              const cachedRaw = localStorage.getItem(`profile_${uid}`);
              if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached._cachedAt && now - cached._cachedAt < TTL) {
                  console.log(`Profile for ${uid} loaded from cache`);
                  return { uid, ...cached.data };
                }
              }

              console.log(`Profile for ${uid} fetched from Firestore`);

              const userSnap = await getDoc(doc(db, 'users', uid));
              const userData = userSnap.exists() ? userSnap.data() : { displayName: 'Unknown', photoURL: '' };

              const toStore = { displayName: userData.displayName || 'Unknown', photoURL: userData.photoURL || '' };
              localStorage.setItem(
                `profile_${uid}`,
                JSON.stringify({ _cachedAt: now, data: toStore })
              );

              return { uid, ...toStore };
            } catch (err) {
              console.error('error fetching profile for', uid, err);
              return { uid, displayName: 'Unknown', photoURL: '' };
            }
          })
        );

        setcollaboratorProfiles(results);
      } catch (error) {
        console.error('Error fetching collaborator profiles:', error);
      }
    }

    fetchCollaboratorProfiles();
  }, [collaboratorUIDs]);

  // -------------------- realtime images subscription --------------------
  useEffect(() => {
    if (!boardId) return;

    setImagesLoading(true); // show skeletons while we subscribe

    const q = query(collection(db, 'boards', boardId, 'images'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setImages(items);
        setImagesLoading(false);
      },
      (err) => {
        console.error('images onSnapshot error', err);
        setImagesLoading(false);
      }
    );

    imagesUnsubRef.current = unsubscribe;

    return () => {
      if (unsubscribe) unsubscribe();
      imagesUnsubRef.current = null;
    };
  }, [boardId]);

  // -------------------- fetch board title + lastOpened short --------------------
  useEffect(() => {
    const fetchBoardTitle = async () => {
      if (!boardId) return;
      const boardRef = doc(db, 'boards', boardId);
      const boardSnap = await getDoc(boardRef);
      if (boardSnap.exists()) {
        const data = boardSnap.data();
        setBoardTitle(data.title || '(Untitled)');
      } else {
        setBoardTitle('(Board not found)');
      }
    };

    fetchBoardTitle();
  }, [boardId]);

  // -------------------- deep-link: open image modal when ?image=<id> present --------------------
  useEffect(() => {
    // if there's ?image=... in URL, open that image in modal once images have loaded
    const params = new URLSearchParams(location.search);
    const imageId = params.get('image');
    if (!imageId) return;

    // if images already loaded, try to open immediately
    if (images && images.length > 0) {
      const idx = images.findIndex((img) => img.id === imageId);
      if (idx !== -1) {
        setModalIndex(idx);
        // remove the query param from URL (so re-opening doesn't keep it)
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('image');
          window.history.replaceState({}, '', url.toString());
        } catch (err) {}
        return;
      }
    }

    // otherwise, wait until images change (effect dependency covers it)
  }, [location.search, images]);

  // -------------------- image saving / paste handling (unchanged) --------------------
  const saveImageToFirestore = async (src) => {
    const imageRef = collection(db, 'boards', boardId, 'images');

    showToast(
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/eat (1).png" alt="Uploading" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Uploading image…</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Hold on — uploading to your board</div>
        </div>
      </div>,
      'info',
      20000
    );

    try {
      const docRef = await addDoc(imageRef, {
        src,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        rating: null,
      });

      showToast('Image uploaded', 'success', 3500);

      // OPTIONAL: create a notification for collaborators (deep-link includes image id so opening will show modal)
      // createNotificationsForUsers is assumed to be a helper you have — implement server-side fan-out when scaling.
      try {
        const collabSnap = await getDocs(collection(db, 'boards', boardId, 'collaborators'));
        const uids = collabSnap.docs.map(d => d.id).filter(Boolean);
        const payload = {
          type: 'board_activity',
          text: `${user.displayName || 'Someone'} added a pick to ${boardTitle || 'your board'}`,
          createdAt: serverTimestamp(),
          read: false,
          boardId,
          actor: user.uid,
          url: `/board/${boardId}?image=${docRef.id}`,
        };
        // write one notif doc per user under users/{uid}/notifications (naive fan-out)
        await Promise.all(uids.map(uid => addDoc(collection(db, 'users', uid, 'notifications'), payload)));
      } catch (err) {
        // ignore; best to do this server-side in Cloud Functions for scale
        console.warn('Could not create notifications for collaborators', err);
      }

    } catch (err) {
      console.error('Unexpected error saving image:', err);
      showToast('Upload failed — try again', 'error', 5000);
    }
  };

  const handlePaste = async (event) => {
    let handled = false;
    const text = event.clipboardData.getData('text');

    if (event.clipboardData && event.clipboardData.items) {
      for (let item of event.clipboardData.items) {
        if (item.type.indexOf('image') === 0) {
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
    } else if (isDirectImageLink || text.startsWith('data:image/')) {
      await saveImageToFirestore(text);
      handled = true;
    }

    if (handled) event.preventDefault();
    event.target.value = '';
  };

  // -------------------- long-press handlers --------------------
  const startLongPress = (index) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedIndex(index);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // delete single image
  const handleDeleteImage = async (imageId, index) => {
    const confirmDelete = window.confirm('Delete this pick?');
    if (!confirmDelete) {
      setLongPressedIndex(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'boards', boardId, 'images', imageId));
      showToast('Pick deleted', 'success', 2500);
      setLongPressedIndex(null);
    } catch (err) {
      console.error('delete image error', err);
      showToast('Could not delete pick', 'error', 3000);
    }
  };

  // -------------------- board rename / delete (3-dot menu) --------------------
  const handleRename = async (boardIdParam, currentTitle) => {
    const newTitle = prompt('Enter new title', currentTitle);
    if (newTitle && newTitle.trim() !== '') {
      const boardRef = doc(db, 'boards', boardIdParam);
      const capitalizedTitle = newTitle.trim().charAt(0).toUpperCase() + newTitle.trim().slice(1);
      try {
        await updateDoc(boardRef, { title: capitalizedTitle });
        showToast('Board renamed', 'success', 2000);
        setShowBoardMenu(false);
      } catch (err) {
        console.error('rename error', err);
        showToast('Could not rename board', 'error', 3000);
      }
    }
  };

  const handleDeleteBoard = async (boardIdParam) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this board?');
    if (!confirmDelete) return;

    try {
      const imagesSnap = await getDocs(collection(db, 'boards', boardIdParam, 'images'));
      await Promise.all(imagesSnap.docs.map((d) => deleteDoc(doc(db, 'boards', boardIdParam, 'images', d.id))));

      const collabSnap = await getDocs(collection(db, 'boards', boardIdParam, 'collaborators'));
      await Promise.all(collabSnap.docs.map((d) => deleteDoc(doc(db, 'boards', boardIdParam, 'collaborators', d.id))));

      await deleteDoc(doc(db, 'boards', boardIdParam));

      showToast('Board deleted', 'success', 2000);
      navigate('/');
    } catch (err) {
      console.error('delete board error', err);
      showToast('Could not delete board', 'error', 3000);
    }
  };

  // -------------------- keyboard navigation (unchanged) --------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalIndex === null) return;

      if (e.key === 'ArrowLeft') {
        setModalIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setModalIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setModalIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalIndex, images.length]);

  // -------------------- debug / logging --------------------
  useEffect(() => {
    // console.log('collaboratorprofiels:', collaboratorProfiles);
  }, [boardId, collaboratorProfiles]);

  const menuRef = useRef(null);
  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowBoardMenu(false);
      }
    }

    if (showBoardMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBoardMenu]);

  return (
    <div style={{ marginTop: '0px' }}>
      {/* boardpage HEADER kinda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0px' }}>
        <button onClick={handleBack} aria-label="Back" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 1, marginRight: 8, display: 'inline-flex', alignItems: 'center', outline: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <div style={{ position: 'relative' }} ref={menuRef}>
          <button aria-label="Board menu" onClick={() => setShowBoardMenu((s) => !s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, marginTop: 8, outline: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>

          {showBoardMenu && (
            <div role="menu" style={{ position: 'absolute', right: 0, top: '36px', minWidth: 160, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 120 }}>
              <button onClick={() => handleRename(boardId, boardTitle)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>Rename</button>
              <button onClick={() => handleDeleteBoard(boardId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#b82b2b' }}>Delete board</button>
            </div>
          )}
        </div>
      </div>

      {/* h2, picks, last opened */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginLeft: '8px' }}>
        <h2 style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', userSelect: 'none', margin: 0, lineHeight: 1.06, marginBottom: '10px' }}>
          {boardTitle}{' '}
          <span style={{ fontSize: '0.9rem', color: '#888', marginTop: '9px' }}>{images.length} {images.length === 1 ? 'pick' : 'picks'}</span>
        </h2>
      </div>

      {/* Collaborators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0px', marginTop: '6px', marginBottom: '12px', position: 'relative', marginLeft: '8px' }}>
        {collaboratorProfiles.map((profile, i) => (
          <img key={profile.uid} src={profile.photoURL} alt={profile.displayName} title={`${profile.displayName} (${profile.uid})`} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover', transform: `translateX(-${i * 10}px)`, zIndex: collaboratorProfiles.length - i }} />
        ))}
      </div>

      {/* Paste box */}
      <textarea ref={pasteRef} placeholder="Long press and tap Paste" onPaste={handlePaste} rows={2} style={{ display: 'block', width: '100%', height: '45px', border: '2px dashed #4caf50', background: '#eaffea', fontSize: '16px', marginBottom: '16px', padding: '10px', borderRadius: '8px', boxSizing: 'border-box' }} />

      {/* Images grid */}
      <div className="image-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between' }}>
        {imagesLoading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} style={{ flex: '0 1 calc(50% - 6px)', background: 'transparent', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.06)', padding: 10 }}>
              <div className="skeleton-dark rect" style={{ height: 160, borderRadius: 8 }} />
            </div>
          ))
        ) : images.length === 0 ? (
          <div style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', borderRadius: '8px', background: '#f9fafb', color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="15" x2="16" y2="15" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            There aren't any picks in this board yet.
          </div>
        ) : (
          images.map((img, i) => (
            <div key={img.id} onMouseDown={() => startLongPress(i)} onMouseUp={() => cancelLongPress()} onMouseLeave={() => cancelLongPress()} onTouchStart={() => startLongPress(i)} onTouchEnd={() => cancelLongPress()} onTouchCancel={() => cancelLongPress()} style={{ flex: '0 1 calc(50% - 6px)', background: longPressedIndex === i ? '#fff' : 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative' }}>
              <img src={img.src} alt="pasted" style={{ width: '100%', borderRadius: '6px', cursor: 'pointer', display: 'block' }} onClick={() => { if (longPressedIndex !== null) return; setModalIndex(i); }} />

              {longPressedIndex === i && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', zIndex: 40 }}>
                  <button onClick={() => handleDeleteImage(img.id, i)} aria-label="Delete pick" style={{ width: 56, height: 56, borderRadius: 12, display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', background: 'linear-gradient(180deg,#fff,#f6f6f6)', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalIndex !== null && (
        <div onClick={() => setModalIndex(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }} onTouchMove={(e) => { touchEndX.current = e.touches[0].clientX; }} onTouchEnd={() => { if (touchStartX.current !== null && touchEndX.current !== null) { const delta = touchEndX.current - touchStartX.current; const threshold = 50; if (delta > threshold) setModalIndex((prev) => prev === 0 ? images.length - 1 : prev - 1); else if (delta < -threshold) setModalIndex((prev) => prev === images.length - 1 ? 0 : prev + 1); } touchStartX.current = null; touchEndX.current = null; }}>
          <img src={images[modalIndex]?.src} alt="Full view" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 0 20px rgba(0,0,0,0.4)', transition: 'transform 0.3s ease' }} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '84px', left: '50%', transform: 'translateX(-50%)', zIndex: 1200, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }} role="status" aria-live="polite">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', minWidth: 220, maxWidth: 420, borderRadius: 12, boxShadow: '0 10px 30px rgba(8,10,20,0.35)', color: '#fff', background: toast.type === 'error' ? 'linear-gradient(180deg,#6f1f1f,#5b1515)' : toast.type === 'success' ? 'linear-gradient(180deg,#1b7a2b,#16621f)' : 'linear-gradient(180deg,#2b5fa8,#1b4aa0)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
              {toast.type === 'success' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="#e6ffef" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : toast.type === 'error' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M18 6L6 18M6 6l12 12" stroke="#ffdede" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: '1.05' }}>{toast.msg}</div>
            </div>

            <button onClick={() => setToast(null)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 16, padding: 8, marginLeft: 8 }}>×</button>
          </div>

          {toast.type === 'info' && (
            <div style={{ height: 6, width: '100%', maxWidth: 420, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,#ffffff80,#ffffff40)', transformOrigin: 'left', animation: `toast-progress ${ toast.duration || 20000 }ms linear forwards` }} />
            </div>
          )}

          <style>{` .shimmer { position: relative; overflow: hidden; background: #e0e0e0; } .shimmer::after { content: ''; position: absolute; top: 0; left: -150%; height: 100%; width: 150%; background: linear-gradient(90deg, rgba(224,224,224,0) 0%, rgba(255,255,255,0.7) 50%, rgba(224,224,224,0) 100%); animation: shimmerMove 1.2s infinite linear; } @keyframes shimmerMove { 100% { left: 150%; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes toast-progress { from { transform: scaleX(1); opacity: 1; } to { transform: scaleX(0); opacity: 0.6; } } .skeleton-dark { background: linear-gradient(90deg, #cfcfd3 0%, #bfbfc3 50%, #cfcfd3 100%); background-size: 200% 100%; animation: shimmer-dark 1.1s linear infinite; } .skeleton-dark.rect { width: 100%; height: 100%; border-radius: 8px; } @keyframes shimmer-dark { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } } `}</style>
        </div>
      )}
    </div>
  );
}
