import React, { useRef } from 'react';

const PasteBox = ({  }) => {
  const pasteRef = useRef(null);
    const [dragActive, setDragActive] = React.useState(false);

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
  
        // optimistic immediate UI: show "just now"
      setLastOpenedShort('just now');
  
      // update the board doc so board.updatedAt / lastOpenedAt is fresh for others
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
      .filter(uid => uid && uid !== user.uid); // exclude yourself
  
    if (uids.length > 0) { // only send if others exist
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
      // common hosts Google uses for thumbnails / image hosting
      const proxyHosts = /(gstatic\.com|googleusercontent\.com|ggpht\.com|bp\.blogspot\.com|lh3\.googleusercontent\.com|cdn\.instagram\.com)/i;
      if (proxyHosts.test(u.hostname)) return true;
  
      // google image redirect param or thumbnail param
      if (/[?&](imgurl|imgrefurl|q|tbn|source)=/i.test(u.search)) return true;
  
      // fallback: extension check
      if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(u.pathname + u.search)) return true;
    } catch (e) {
      // not a valid URL
    }
    return false;
  }
  
  // Replace your handler with this
  const handlePaste = async (event) => {
    let handled = false;
  
    // If image file(s) are present in clipboard items, handle them first
    if (event.clipboardData && event.clipboardData.items) {
      for (let item of event.clipboardData.items) {
        if (item.type && item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          console.log(`📋 Pasted file detected. Size: ${file.size} bytes`);
  
          if (file.size > 1 * 1024 * 1024) {
            // >1MB → Supabase
            console.log(`➡️ Using Supabase upload (file > 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
            await saveImageToSupabase(file);
          } else {
            // <=1MB → Firestore inline (base64)
            const reader = new FileReader();
            reader.onload = async function (e) {
              console.log(`➡️ Using inline upload (file <= 1MB) ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
              await saveImageToFirestore(e.target.result);
            };
            reader.readAsDataURL(file);
          }
          handled = true;
        }
      }
    }
  
  
    // text fallback (URL or data URL)
    const text = event.clipboardData.getData('text') || '';
  
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
      // direct link with extension — you were already handling this
      await saveImageToFirestore(text);
      handled = true;
    } else if (isLikelyImage) {
      // NEW: treat gstatic / googleusercontent / tbn-style URLs as images
      // Prefer server-side import (recommended) to avoid CORS & hotlink issues.
      try {
        // Try an in-client quick validation using Image to see if it loads
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image failed to load'));
          img.src = text;
          // in some browsers this will still "load" even if CORS would block canvas ops; it's just a presence check
        });
  
        // At this point the URL loads — use a URL-import path (server proxy) to persist it.
        // Implement saveImageUrlToFirestore(url) to either:
        //  - call your server /import endpoint which fetches the remote image and uploads to Firebase Storage
        //  - OR try client fetch->blob (may hit CORS)
        await saveImageToFirestore(text);
        handled = true;
      } catch (err) {
        // image didn't load in the client — still attempt server-side import as a fallback
        try {
          await saveImageToFirestore(text); // server should fetch it
          handled = true;
        } catch (err2) {
          console.warn('image import failed:', err2);
          showToast("⚠️ Couldn't import that image URL. Open the image in a new tab and copy the image directly, or try 'Open image' → 'Copy image address'.");
          handled = true;
        }
      }
    }
  
    if (handled) {
      event.preventDefault();         // stop default paste into textarea
      if (event.target) event.target.value = '';
    }
  };
  
  
  const handleDrop = async (event) => {
    event.preventDefault();
    let handled = false;
  
   // 1. Handle file drops (like dragging an image from desktop)
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      for (let file of event.dataTransfer.files) {
        if (file.type && file.type.startsWith("image/")) {
          console.log(`📥 Dropped file detected. Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
  
          if (file.size > MAX_FIRESTORE_SIZE) {
            console.log("➡️ Using Supabase upload (file > 1MB)");
            await saveImageToSupabase(file);
          } else {
            console.log("➡️ Using Firestore inline upload (file <= 1MB)");
            // convert to dataURL and reuse your existing small-image flow
            const reader = new FileReader();
            reader.onload = async (e) => {
              await saveImageToFirestore(e.target.result, file.size);
            };
            reader.readAsDataURL(file);
          }
          handled = true;
        }
      }
    }
  
    // 2. Handle text/URLs (like dragging from another tab)
    // NOTE: if we already handled files above, skip text to avoid duplicates
    if (!handled) {
      const text = event.dataTransfer.getData("text") || "";
      if (text) {
        console.log("goign old way")
        // Reuse the same logic you already wrote for paste:
        await handlePaste({ clipboardData: { getData: () => text, items: [] }, preventDefault: () => {}, target: event.target });
        handled = true;
      }
    }
  
    // cleanup UI state & input value
    setDragActive(false);
    try { if (event.dataTransfer) event.dataTransfer.clearData(); } catch (e) { /* ignore */ }
  
    if (handled && event.target) {
      event.target.value = "";
    }
  };
  
  // -------------------- Supabase upload for large images --------------------
  // requires setting up Supabase project + storage bucket + API keys
  // see https://supabase.com/docs/guides/storage for details
  // and
  
  
  const saveImageToSupabase = async (file) => {
    const imageRef = collection(db, "boards", boardId, "images");
  
    showToast("Dragging this chunky boy to the cloud ... 🐦‍🔥", "info", 20000);
  
    try {
      // sanitize filename
      function sanitizeFileName(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, "_"); // safe chars only
      }
  
      const fileName = sanitizeFileName(file.name);
      const path = `boards/${boardId}/${Date.now()}-${fileName}`;
  
      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from("pixpick-images")
        .upload(path, file);
  
      if (uploadError) throw uploadError;
  
      // ⚡️ Generate signed URL (1 week validity for example)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("pixpick-images")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  
      if (signedError) throw signedError;
  
      // Save Firestore doc with storage info (keep path so you can re-generate)
      const docRef = await addDoc(imageRef, {
        src: signedData.signedUrl, // this is the temp view URL
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        rating: null,
        storage: {
          provider: "supabase",
          path, // keep path for future signed URL refresh
          size: file.size,
          contentType: file.type,
        },
      });
  
      console.log(
        `✅ Uploaded to Supabase: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
      );
  
      // refresh board.updatedAt
      try {
        const boardRef = doc(db, "boards", boardId);
        await updateDoc(boardRef, { updatedAt: serverTimestamp() });
      } catch (err) {
        console.warn("Could not update board.updatedAt", err);
      }
  
      showToast(
        `File uploaded (${(file.size / (1024 * 1024)).toFixed(2)} MB) ✅`,
        "success",
        3500
      );
  
      // notifications
      try {
        const collabSnap = await getDocs(
          collection(db, "boards", boardId, "collaborators")
        );
        const uids = collabSnap.docs
          .map((d) => d.id)
          .filter((uid) => uid && uid !== user.uid);
  
        if (uids.length > 0) {
          const payload = {
            type: "board_activity",
            text: `${
              user.displayName || "Someone"
            } added a pick to ${boardTitle || "your board"}`,
            createdAt: serverTimestamp(),
            read: false,
            boardId,
            actor: user.uid,
            url: `/board/${boardId}?image=${docRef.id}`,
          };
          await Promise.all(
            uids.map((uid) =>
              addDoc(collection(db, "users", uid, "notifications"), payload)
            )
          );
        }
      } catch (err) {
        console.warn("Could not create notifications for collaborators", err);
      }
    } catch (err) {
      console.error("❌ Supabase upload failed:", err);
      showToast("Upload failed — try again", "error", 5000);
    }
  };
  
  
  const handleDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };
  
  const handleDragLeave = (event) => {
    // classic case: when leaving the drop area reset the visual flag
    setDragActive(false);
  };
  return (
    <textarea
      ref={pasteRef}
      className="my-textarea-input"
      placeholder="Paste or Drag images/links here..."
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      rows={4}
      style={{
        display: 'block',
        width: '100%',
        height: dragActive ? '80px' : '40px', // default height
        maxHeight: '200px', // maximum expanded height
        border: dragActive ? '2px solid #2196f3' : '2px dashed #4caf50',
        background: dragActive
          ? '#e3f2fd'
          : 'linear-gradient(90deg,rgba(167, 201, 115, 1) 0%, rgba(6, 103, 112, 1) 55%, rgba(129, 227, 102, 1) 100%)',
        fontSize: '16px',
        marginBottom: '16px',
        padding: '10px',
        borderRadius: '10px',
        boxSizing: 'border-box',
        transition: 'height 0.3s ease, box-shadow 0.3s ease',
        outline: 'none',
        overflow: 'hidden',
        resize: 'none',
        animation: dragActive ? 'pulseBorder 0.7s infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.height = '45px';
        e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.height = '40px';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
};

export default PasteBox;
