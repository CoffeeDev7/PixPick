// PasteBox.jsx
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { db } from '../firebase';
import {
  doc, collection, addDoc, getDocs, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { FiPlus} from 'react-icons/fi';
import { IoCloudOutline } from "react-icons/io5";
import { supabase } from '../lib/supabase';

const PasteBox = forwardRef(({ modalIndex, boardId, boardTitle, user, showToast, setLastOpenedShort }, ref) => {
  const pasteRef = useRef(null);
  const fileInputRef = useRef(null);

  // UI state
  const [overlayVisible, setOverlayVisible] = useState(false); // overlay + pastebox visible
  const [dragCounter, setDragCounter] = useState(0); // robust drag enter/leave counting
  const [dragActive, setDragActive] = useState(false);
  const MAX_FIRESTORE_SIZE = 1 * 1024 * 1024; // 1MB

  // plus button scroll fade
  const [showFab, setShowFab] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 5) {
        setShowFab(false); // fade out when scrolling down
      } else {
        setShowFab(true); // fade back in at top
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  // -------------------- image saving / paste handling (unchanged logic) --------------------
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

      setLastOpenedShort('just now');

      try {
        const boardRef = doc(db, 'boards', boardId);
        await updateDoc(boardRef, { updatedAt: serverTimestamp() });
      } catch (err) {
        console.warn('Could not update board.updatedAt', err);
      }

      showToast('Image uploaded', 'success', 3500);

      try {
        const collabSnap = await getDocs(collection(db, 'boards', boardId, 'collaborators'));
        const uids = collabSnap.docs
          .map(d => d.id)
          .filter(uid => uid && uid !== user.uid);

        if (uids.length > 0) {
          const payload = {
            type: 'board_activity',
            text: `${user.displayName || 'Someone'} added a pick to ${boardTitle || 'your board'}`,
            createdAt: serverTimestamp(),
            read: false,
            boardId,
            actor: user.uid,
            url: `/board/${boardId}?image=${docRef.id}`,
          };
          await Promise.all(
            uids.map(uid =>
              addDoc(collection(db, 'users', uid, 'notifications'), payload)
            )
          );
        }
      } catch (err) {
        console.warn('Could not create notifications for collaborators', err);
      }
    } catch (err) {
      console.error('Unexpected error saving image:', err);
      showToast('Upload failed — try again', 'error', 5000);
    }
  };

  // helper: returns true for "likely image" urls (even if no file extension)
  function isLikelyImageUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      const proxyHosts = /(gstatic\.com|googleusercontent\.com|ggpht\.com|bp\.blogspot\.com|lh3\.googleusercontent\.com|cdn\.instagram\.com)/i;
      if (proxyHosts.test(u.hostname)) return true;
      if (/[?&](imgurl|imgrefurl|q|tbn|source)=/i.test(u.search)) return true;
      if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(u.pathname + u.search)) return true;
    } catch (e) {}
    return false;
  }

  // PASTE handler (keeps your advanced URL logic)
  const handlePaste = async (event) => {
    let handled = false;

    if (event.clipboardData && event.clipboardData.items) {
      for (let item of event.clipboardData.items) {
        if (item.type && item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          console.log(`📋 Pasted file detected. Size: ${file.size} bytes`);
          if (file.size > MAX_FIRESTORE_SIZE) {
            console.log(`➡️ Using Supabase upload (file > 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
            await saveImageToSupabase(file);
          } else {
            const reader = new FileReader();
            reader.onload = async function (e) {
              console.log(`➡️ Using inline upload (file <= 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
              await saveImageToFirestore(e.target.result);
            };
            reader.readAsDataURL(file);
            // wait for reader to finish is handled by onload above (async awaited)
            // since we don't block here, mark handled and let the rest of function skip text processing
          }
          handled = true;
        }
      }
    }

    // If we already handled an image file from clipboard items, skip text/url processing
    if (handled) {
      try { event.preventDefault(); } catch (e) {}
      if (event.target) event.target.value = '';
      return;
    }

    const text = (event.clipboardData && event.clipboardData.getData('text')) || '';
    const isDataUrl = text.startsWith('data:image/');
    const isDirectImageLink = /^https?:\/\/.+\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i.test(text);
    const isGoogleAppProxy = /images\.app\.goo\.gl/i.test(text);
    const isGoogleImgresRedirect = /google\.com\/imgres.*[?&]imgurl=/i.test(text);
    const isBrokenGoogleImageCopy = /google\.com\/url\?sa=i/i.test(text);
    const isLikelyImage = isLikelyImageUrl(text);

    if (isGoogleAppProxy) {
      showToast("⚠️ Can't preview this Google image link. Open it in browser, then copy image directly.");
      handled = true;
    } else if (isBrokenGoogleImageCopy) {
      showToast("⚠️ 'Copy Link Address' from Google Images doesn't work. Try 'Copy Image' or 'Copy Image Address' instead.");
      handled = true;
    } else if (isGoogleImgresRedirect) {
      showToast("⚠️ This is a Google redirect link. Open the image, right-click, and choose 'Copy Image'.");
      handled = true;
    } else if (isDataUrl) {
      await saveImageToFirestore(text);
      handled = true;
    } else if (isDirectImageLink) {
      await saveImageToFirestore(text);
      handled = true;
    } else if (isLikelyImage) {
      try {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image failed to load'));
          img.src = text;
        });
        await saveImageToFirestore(text);
        handled = true;
      } catch (err) {
        try {
          await saveImageToFirestore(text);
          handled = true;
        } catch (err2) {
          console.warn('image import failed:', err2);
          showToast("⚠️ Couldn't import that image URL. Open the image in a new tab and copy the image directly, or try 'Open image' → 'Copy image address'.");
          handled = true;
        }
      }
    }

    if (handled) {
      event.preventDefault();
      if (event.target) event.target.value = '';
    }
  };

  // DROP handler (files or dragged links)
  const handleDrop = async (event) => {
    event.preventDefault();
    let handled = false;

    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      for (let file of event.dataTransfer.files) {
        if (file.type && file.type.startsWith("image/")) {
          if (file.size > MAX_FIRESTORE_SIZE) {
            console.log(`➡️ Using Supabase upload (file > 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
            await saveImageToSupabase(file);
          } else {
            const reader = new FileReader();
            reader.onload = async (e) => {
              console.log(`➡️ Using inline upload (file <= 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
              await saveImageToFirestore(e.target.result, file.size);
            };
            reader.readAsDataURL(file);
          }
          handled = true;
        }
      }
    }

    if (!handled) {
      const text = event.dataTransfer.getData("text") || "";
      if (text) {
        await handlePaste({ clipboardData: { getData: () => text, items: [] }, preventDefault: () => {}, target: event.target });
        handled = true;
      }
    }

    setDragActive(false);
    setOverlayVisible(false);
    try { if (event.dataTransfer) event.dataTransfer.clearData(); } catch (e) {}

    if (handled && event.target) {
      event.target.value = "";
    }
  };

  // Supabase upload for large images (kept as in your original)
  const saveImageToSupabase = async (file) => {
    const imageRef = collection(db, "boards", boardId, "images");

    showToast("Dragging this chunky boy to the cloud ... 🐦‍🔥", "info", 20000);
    try {
      function sanitizeFileName(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, "_");
      }
      const fileName = sanitizeFileName(file.name);
      const path = `boards/${boardId}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("pixpick-images")
        .upload(path, file);

      if (uploadError){
        showToast(`supabasing Upload failed: ${uploadError.message}`, "error", 8000);
      }
      const { data: signedData, error: signedError } = await supabase.storage
        .from("pixpick-images")
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;

      const docRef = await addDoc(imageRef, {
        src: signedData.signedUrl,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        rating: null,
        storage: {
          provider: "supabase",
          path,
          size: file.size,
          contentType: file.type,
        },
      });

      try {
        const boardRef = doc(db, 'boards', boardId);
        await updateDoc(boardRef, { updatedAt: serverTimestamp() });
      } catch (err) {
        console.warn("Could not update board.updatedAt", err);
      }

      showToast(`File uploaded (${(file.size / (1024 * 1024)).toFixed(2)} MB) ✅`, "success", 3500);

      try {
        const collabSnap = await getDocs(collection(db, 'boards', boardId, 'collaborators'));
        const uids = collabSnap.docs.map((d) => d.id).filter((uid) => uid && uid !== user.uid);

        if (uids.length > 0) {
          const payload = {
            type: "board_activity",
            text: `${user.displayName || "Someone"} added a pick to ${boardTitle || "your board"}`,
            createdAt: serverTimestamp(),
            read: false,
            boardId,
            actor: user.uid,
            url: `/board/${boardId}?image=${doc(id)}`,
          };
          await Promise.all(
            uids.map((uid) => addDoc(collection(db, 'users', uid, 'notifications'), payload))
          );
        }
      } catch (err) {
        console.warn("Could not create notifications for collaborators", err);
      }
    } catch (err) {
      console.error("❌ Supabase upload failed:", err);
      // showToast("Upload failed — try again", "error", 5000);
    }
  };

  // -------------------- Smart page-level drag handlers --------------------
  useEffect(() => {
    const onWindowDragEnter = (e) => {
      e.preventDefault();
      // increment counter
      setDragCounter(c => c + 1);
      setDragActive(true);
      setOverlayVisible(true);
    };

    const onWindowDragOver = (e) => {
      e.preventDefault();
      setDragActive(true);
      setOverlayVisible(true);
    };

    const onWindowDragLeave = (e) => {
      e.preventDefault();
      setDragCounter(c => {
        const next = Math.max(0, c - 1);
        if (next === 0) {
          setDragActive(false);
          setOverlayVisible(false);
        }
        return next;
      });
    };

    const onWindowDrop = (e) => {
      // let the specific drop handler manage it via overlay drop
      e.preventDefault();
      setDragCounter(0);
      setDragActive(false);
      setOverlayVisible(false);
    };

    window.addEventListener('dragenter', onWindowDragEnter);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('drop', onWindowDrop);

    // allow paste while overlayVisible (catch global paste)
    const onWindowPaste = (e) => {
      // if overlay open, only call handlePaste for events NOT coming from our textarea
      if (!overlayVisible) return;
      if (pasteRef.current && (pasteRef.current === e.target || pasteRef.current.contains(e.target))) {
        // textarea will handle this paste — avoid duplication
        return;
      }
      handlePaste(e);
    };
    window.addEventListener('paste', onWindowPaste);

    // keyboard escape to hide overlay
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOverlayVisible(false);
        setDragActive(false);
        setDragCounter(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('dragenter', onWindowDragEnter);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('paste', onWindowPaste);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [overlayVisible]); // overlayVisible in deps so paste binding respects current state

  // click file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // handle file selection via file input
  const handleFileInputChange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > MAX_FIRESTORE_SIZE) {
      await saveImageToSupabase(f);
    } else {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        await saveImageToFirestore(ev.target.result);
      };
      reader.readAsDataURL(f);
    }
    // hide overlay after selection
    setOverlayVisible(false);
    e.target.value = '';
  };

  // simple helper to show pastebox (for + Add)
  const revealPastebox = () => {
    setOverlayVisible(true);
    // focus after next tick
    //setTimeout(() => pasteRef.current?.focus?.(), 80);
  };

  // expose methods to parent (openFilePicker & revealPastebox)
  useImperativeHandle(ref, () => ({
    openFilePicker,
    revealPastebox,
  }), [openFilePicker, revealPastebox]);

  // -------------------- Render --------------------
  return (
    <>
      {/* Visible trigger for discoverability */}
      <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000, // stays above other content
            transition: 'opacity 0.4s ease',
            opacity: modalIndex!=null ? 0 : (showFab ? 1 : 0), // hide when modal open
            pointerEvents: showFab ? 'auto' : 'none', // avoid blocking clicks when hidden
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}>
        <button
          onClick={revealPastebox}
          aria-label="Add Pick"
          style={{
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            border: 'none',
            width: '60px', // Set a fixed width
            height: '60px', // Set a fixed height
            borderRadius: '50%', // Make it circular
            cursor: 'pointer',
            boxShadow: '0 6px 15px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center', // Center the icon
            backgroundColor: '#2e494a',
            border: '1px solid #4a6f70',
            outline: 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease', // Add transition for smooth hover effects
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <FiPlus size={32} />
          
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </div>

      {/* Overlay + Pastebox (appears on drag or when user clicks + Add) */}
      {overlayVisible && (
        <div
          onClick={() => {
            setOverlayVisible(false);
            setDragActive(false);
            setDragCounter(0);
          }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={handleDrop}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: dragActive ? 'rgba(12,18,28,0.55)' : 'rgba(12,18,28,0.4)',
            transition: 'background 0.18s ease',
          }}
        >
          <div
            style={{
              width: Math.min(820, window.innerWidth - 48),
              maxWidth: 'calc(100% - 48px)',
              borderRadius: 12,
              padding: 18,
              background: '#0f1720',
              boxShadow: '0 12px 40px rgba(2,6,23,0.6)',
              color: '#e6eef8',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'stretch'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {dragActive ? 'Drop your image to add it' : 'Paste Box'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* <button
                  onClick={() => { setOverlayVisible(false); setDragActive(false); setDragCounter(0); }}
                  style={{
                    background: 'transparent',
                    color: '#b9c6d6',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button> */}
                <button
                  onClick={openFilePicker}
                  style={{
                    background: '#1f6feb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(31,111,235,0.3)',
                  }}
                >
                  <IoCloudOutline size={20} style={{ marginRight: 6, position: 'relative', top: -1 }} />
                  Choose file
                </button>
              </div>
            </div>

            <textarea
              ref={pasteRef}
              className="my-textarea-input"
              placeholder="Paste anything..."
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              rows={4}
              style={{
                display: 'block',
                width: '100%',
                height: dragActive ? '150px' : '60px',
                maxHeight: '220px',
                border: dragActive ? '2px solid rgba(100, 149, 237, 0.95)' : '2px dashed rgba(255,255,255,0.06)',
                background: 'linear-gradient(90deg,#111827,#0b1220)',
                fontSize: '15px',
                marginBottom: '0',
                padding: '12px',
                borderRadius: '10px',
                boxSizing: 'border-box',
                transition: 'height 0.25s ease, border 0.12s ease',
                color: '#e6eef8',
                outline: 'none',
                resize: 'none'
              }}
            />

            <div style={{ fontSize: 13, color: '#9fb0c9' }}>
              Tip: You can also drop images directly anywhere on this page, even without this box.
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default PasteBox;
