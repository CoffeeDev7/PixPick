// BoardPage.jsx 
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, documentId, getDoc, getDocs, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, deleteDoc,
  limit, setDoc, where,
} from 'firebase/firestore';
import './BoardPage.css'; 
import ImageGrid from './ImageGrid'; 
import Modal from './modals/Modal'; 
import CommentsModal from './modals/CommentsModal'; 
import BoardCommentsModal from './modals/BoardCommentsModal'; 
import Toast from './Toast';
import CollaboratorsModal from './modals/CollaboratorsModal';
import { supabase } from "../lib/supabase";
import PasteBox from './PasteBox';
import {
  useBoardAndCollaborators, useCollaboratorProfiles,  useImagesSubscription,  useCommentCounts,
  useBoardCommentsCount,  useDeepLinkImageOpen,  useModalKeyboardNavigation,  useEscapeToExit,
  useMountLogger,  useOutsideClick,  useFetchBoardTitle,
} from '../hooks/BoardPage.hooks';
import Loader from './Loader';
import { SettingsModal } from './modals/SettingsModal';

// Default settings
const defaultSettings = {
  animateEnabled: true,
  showCaptions: true,
  darkMode: false,
  // add more variables here as needed
};

export default function BoardPage({ user }) {
  const { id: boardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  
  // Load settings from localStorage, fallback to defaultSettings
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("boardSettings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  // multi-select state
const [multiSelectMode, setMultiSelectMode] = useState(false);
const [selectedImages, setSelectedImages] = useState(new Set()); // Set of image ids
const [bulkDeleting, setBulkDeleting] = useState(false);


  // Reorder state (jiggle + drag)
const [reorderMode, setReorderMode] = useState(false); // toggles jiggle & drag;

  //const [images, setImages] = useState([]);
  // const [boardTitle, setBoardTitle] = useState('');
  const [toast, setToast] = useState(null); // { msg, type, duration }
  const [modalIndex, setModalIndex] = useState(null);
  // Board menu (3-dots)
  const [showBoardMenu, setShowBoardMenu] = useState(false);

  // put once in the component body (used by other effects sometimes)
  const imagesUnsubRef = useRef(null);

  // Comments modal state (image-level)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentList, setCommentList] = useState([]);
  const [commentText, setCommentText] = useState('');
  const commentsUnsubRef = useRef(null);

  const [open, setOpen] = useState(false);

  // board-level comments (small button beside 3-dots)
  const [boardCommentModalOpen, setBoardCommentModalOpen] = useState(false);
  const [boardCommentList, setBoardCommentList] = useState([]);
  const [boardCommentText, setBoardCommentText] = useState('');
  const boardCommentsUnsubRef = useRef(null);
  //const [boardCommentsCount, setBoardCommentsCount] = useState(0);

  // Collaborators modal
  const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false);

  const openCollaboratorsModal = () => setIsCollaboratorsModalOpen(true);
  const closeCollaboratorsModal = () => setIsCollaboratorsModalOpen(false);

  // per-image comment counts map { imageId: number }
  //const [commentCounts, setCommentCounts] = useState({});
  const commentCountsUnsubsRef = useRef(new Map());

  // whether to notify collaborators when posting an image comment
  const [notifyFriends, setNotifyFriends] = useState(false);

  // separate flag for board-level comments
  const [boardNotifyFriends, setBoardNotifyFriends] = useState(false);


  // -------------------- useEffects --------------------
  // Complex useeffects  into HOOOKS --------------------
  const { images, imagesLoading } = useImagesSubscription(boardId);
  const commentCounts = useCommentCounts(boardId, images);
  const boardCommentsCount = useBoardCommentsCount(boardId);
  useDeepLinkImageOpen(location.search, images, setModalIndex);
  useModalKeyboardNavigation(modalIndex, images.length, setModalIndex);
  useEscapeToExit(reorderMode, () => { setReorderMode(false); showToast('Reorder mode exited','info',1200); });
  useMountLogger('BoardPage');
  useOutsideClick(menuRef, () => setShowBoardMenu(false), showBoardMenu);
  const { boardTitle, lastOpenedShort, setLastOpenedShort } = useFetchBoardTitle(boardId);
  const { setBoardTitle, collaborators, timeAgoShort, getProfileCached,  collaboratorUIDs} = useBoardAndCollaborators(boardId)
  const collaboratorProfiles = useCollaboratorProfiles(collaboratorUIDs);

    // Persist settings in localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("boardSettings", JSON.stringify(settings));
  }, [settings]);

  // -------------------- Toast helper --------------------
  const showToast = (msg, type = 'info', duration = 5000) => {
    setToast({ msg, type, duration });
    setTimeout(() => setToast(null), duration);
  };


  // -------------------- Reorder helpers --------------------
const toggleReorder = () => {
  setReorderMode((s) => {
    // if turning off, clear drag state
    if (s) {
      // do nothing for now
    }
    return !s;
  });
};

const toggleSelectImage = (imageId) => {
  setSelectedImages((prev) => {
    const next = new Set(prev);
    if (next.has(imageId)) next.delete(imageId);
    else next.add(imageId);
    return next;
  });
};

// select all images currently loaded
const selectAllImages = () => {
  setSelectedImages(new Set(images.map(i => i.id)));
};
const clearSelection = () => setSelectedImages(new Set());

// keyboard delete key handling for multi-select
useEffect(() => {
  const onKey = (e) => {
    if (!multiSelectMode) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImages.size > 0) {
      e.preventDefault();
      handleDeleteSelected();
    }
    if (e.key === 'Escape' && multiSelectMode) {
      setMultiSelectMode(false);
      clearSelection();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [multiSelectMode, selectedImages]);

// -------------------- comments handling --------------------
  // open comments modal for a specific image (by index)
  const openCommentsForIndex = (index) => {
    const image = images[index];
    if (!image) return;
    setCommentModalOpen(true);

    const commentsRef = collection(db, 'boards', boardId, 'images', image.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'), limit(200));
    if (commentsUnsubRef.current) commentsUnsubRef.current();
    commentsUnsubRef.current = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // enrich with creator profile (displayName + photoURL)
      const enriched = await Promise.all(raw.map(async (c) => {
        const prof = await getProfileCached(c.createdBy);
        return { ...c, creatorName: prof.displayName, creatorPhoto: prof.photoURL };
      }));
      setCommentList(enriched);
    });
  };
  // -------------------- board-level comments modal --------------------
    const openBoardComments = () => {
      setBoardCommentModalOpen(true);
      const ref = collection(db, 'boards', boardId, 'comments');
      const q = query(ref, orderBy('createdAt', 'desc'), limit(200));
      if (boardCommentsUnsubRef.current) boardCommentsUnsubRef.current();
      boardCommentsUnsubRef.current = onSnapshot(q, async (snap) => {
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const enriched = await Promise.all(raw.map(async (c) => {
          const prof = await getProfileCached(c.createdBy);
          return { ...c, creatorName: prof.displayName, creatorPhoto: prof.photoURL };
        }));
        setBoardCommentList(enriched);
      });
    };


  // delete single image (from Firestore + Supabase if applicable)
  const handleDeleteImage = async (imageId, index) => {
    const confirmDelete = window.confirm("Delete this pick?");
    if (!confirmDelete) {
      return;
    }

    setModalIndex(null); // close modal if open

    try {
      // 1. Get Firestore doc
      const imageDocRef = doc(db, "boards", boardId, "images", imageId);
      //console.log("[Delete] Fetching Firestore doc:", imageDocRef.path);

      const imageDocSnap = await getDoc(imageDocRef);
      if (!imageDocSnap.exists()) {
        console.warn("[Delete] Firestore doc does not exist for:", imageId);
      } else {
        console.log("[Delete] Firestore doc data:", imageDocSnap.data());
      }

      if (imageDocSnap.exists()) {
        const { src, storage } = imageDocSnap.data();
        //console.log("[Delete] Image src from Firestore:", src);
        //console.log("[Delete] Storage object from Firestore:", storage);

        if (storage?.path) {
          // 2. Derive Supabase storage path
          const storagePath = storage.path;
          //console.log("[Delete] Derived storage path:", storagePath);

          // 3. Try Supabase delete
          const { data, error: supabaseError } = await supabase.storage
            .from("pixpick-images")
            .remove([storagePath]);

          //console.log("[Delete] Supabase response:", { data, supabaseError });

          if (supabaseError) {
            console.error("[Delete] Supabase deletion error:", supabaseError);
            showToast("Could not delete from storage", "error", 3000);
            return; // bail out before Firestore delete
          }
        } else {
          console.warn("[Delete] No src field found in Firestore doc");
        }
      }

      // 4. Delete Firestore doc
      //console.log("[Delete] Deleting Firestore doc:", imageDocRef.path);
      await deleteDoc(imageDocRef);

      console.log("[Delete] Successfully deleted Firestore doc:", imageId);
      showToast("Pick deleted", "success", 2500);
    } catch (err) {
      console.error("[Delete] Unexpected error:", err);
      showToast("Could not delete pick", "error", 3000);
    }
  };

  // delete multiple selected images (from Firestore + Supabase if applicable)
  const handleDeleteSelected = async () => {
  if (selectedImages.size === 0) return;
  const confirmDelete = window.confirm(`Delete ${selectedImages.size} selected picks? This cannot be undone.`);
  if (!confirmDelete) return;

  setBulkDeleting(true);
  showToast(`Deleting ${selectedImages.size} picks...`, 'info', 20000);

  try {
    // gather docs for selected images
    const selectedIds = Array.from(selectedImages);
    // fetch metadata for each (to read storage.path if present)
    const docRefs = selectedIds.map(id => doc(db, 'boards', boardId, 'images', id));
    // read docs in parallel
    const docSnaps = await Promise.all(docRefs.map(r => getDoc(r)));

    // collect supabase storage paths to remove
    const urlPrefix = import.meta.env.VITE_SUPABASE_URLPREFIX || '';
    const storagePaths = [];

    // docs to delete (where doc exists)
    const docsToDelete = [];

    docSnaps.forEach((snap, idx) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      docsToDelete.push({ id: snap.id, data: d });
      if (d.storage?.path) {
        storagePaths.push(d.storage.path);
      } else if (d.src && urlPrefix && d.src.startsWith(urlPrefix)) {
        // derive path from signed url prefix -> remove prefix
        storagePaths.push(d.src.replace(urlPrefix, ''));
      }
    });

    // 1) remove files from Supabase (if any)
    if (storagePaths.length > 0) {
      try {
        const { error: supabaseError } = await supabase.storage
          .from('pixpick-images')
          .remove(storagePaths);
        if (supabaseError) {
          console.warn('Supabase bulk delete error:', supabaseError);
          // don't fully abort: still attempt to delete Firestore docs, but notify user
          showToast('Some storage deletions failed — check console', 'error', 5000);
        }
      } catch (err) {
        console.error('Supabase bulk delete exception:', err);
        showToast('Storage deletion failed — check console', 'error', 5000);
      }
    }

    // 2) delete Firestore docs
    await Promise.all(docsToDelete.map(d => deleteDoc(doc(db, 'boards', boardId, 'images', d.id))));

    // 3) success cleanup
    setSelectedImages(new Set());
    setMultiSelectMode(false);
    showToast(`Deleted ${docsToDelete.length} picks`, 'success', 3500);

    // If modal is open on a deleted image, close it
    if (modalIndex != null) {
      const modalImage = images[modalIndex];
      if (modalImage && selectedIds.includes(modalImage.id)) {
        setModalIndex(null);
      }
    }
  } catch (err) {
    console.error('Bulk delete failed:', err);
    showToast('Could not delete selected picks', 'error', 5000);
  } finally {
    setBulkDeleting(false);
  }
};

  // -------------------- Share board logic --------------------
const handleShareBoard = () => {
  // make a quick overlay with an input + your card
  const overlay = document.createElement("div");
  overlay.style = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #fff; padding: 16px; border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; gap: 12px; z-index: 9999;
    width: 300px;
  `;
  overlay.innerHTML = `
    <label style="font-weight: bold;">Enter email to share:</label>
    <input type="text" id="shareEmailInput" placeholder="Enter email"
      style="padding: 8px; border: 1px solid #ccc; border-radius: 6px; width: 100%;" />
    <div id="quickCard" style="
      display: flex; align-items: center; gap: 10px; cursor: pointer;
      padding: 8px; border: 1px solid #eee; border-radius: 6px;
      background: #f9f9f9;
    ">
      <img src="https://lh3.googleusercontent.com/a/ACg8ocIeDVvBYzPUvLuvJvrLEZ_m32K__iYmw1dKDc-WQnQXWlhRASdC=s96-c"
        style="width:36px; height:36px; border-radius:50%;" />
      <div style="display:flex; flex-direction:column;">
        <strong>Karthik</strong>
      </div>
    </div>
    <div style="display:flex; justify-content:flex-end; gap: 8px;">
      <button id="cancelShareBtn" style="padding:6px 12px;">Cancel</button>
      <button id="confirmShareBtn" style="padding:6px 12px; background:#4caf50; color:#fff; border:none; border-radius:4px;">Share</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#shareEmailInput");
  const quickCard = overlay.querySelector("#quickCard");
  const cancelBtn = overlay.querySelector("#cancelShareBtn");
  const confirmBtn = overlay.querySelector("#confirmShareBtn");

  quickCard.onclick = () => {
    input.value = "satyakarthik2020@gmail.com"; // autofill
  };

  cancelBtn.onclick = () => {
    document.body.removeChild(overlay);
  };

  confirmBtn.onclick = async () => {
    const email = input.value.trim();
    if (!email) return;
    await shareWithEmail(email);
    document.body.removeChild(overlay);
  };
};

const shareWithEmail = async (email) => {
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      showToast("User not found", "error", 3000);
      return;
    }
    const userDoc = snap.docs[0];
    const uid = userDoc.id;

    await setDoc(doc(db, "boards", boardId, "collaborators", uid), {
      role: "collaborator",
      addedAt: serverTimestamp(),
    });

    try {
      const payload = {
        type: "shared_board",
        text: `${user.displayName || "Someone"} shared a board with you: ${boardTitle || ""}`,
        createdAt: serverTimestamp(),
        read: false,
        boardId,
        actor: user.uid,
        url: `/board/${boardId}`,
      };
      await addDoc(collection(db, "users", uid, "notifications"), payload);
    } catch (err) {
      console.warn("Could not create share notification", err);
    }

    showToast("Board shared", "success", 2500);
  } catch (err) {
    console.error("share board error", err);
    showToast("Could not share board", "error", 3000);
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
  const confirmDelete = window.confirm("Are you sure you want to delete this board?");
  if (!confirmDelete) return;

  try {
    // 1. Get all images under this board
    const imagesSnap = await getDocs(collection(db, "boards", boardIdParam, "images"));

    const urlPrefix = import.meta.env.VITE_SUPABASE_URLPREFIX;
    const storagePaths = [];

    imagesSnap.forEach((docSnap) => {
      const { src } = docSnap.data();
      if (src?.startsWith(urlPrefix)) {
        const storagePath = src.replace(urlPrefix, ""); // e.g. boards/boardId/file.png
        storagePaths.push(storagePath);
      }
    });

    // 2. Delete from Supabase in one go
    if (storagePaths.length > 0) {
      const { error: supabaseError } = await supabase.storage
        .from("pixpick-images")
        .remove(storagePaths);

      if (supabaseError) {
        console.error("Supabase deletion error:", supabaseError);
        showToast("Could not delete images from storage", "error", 3000);
        return; // don’t delete Firestore board if Supabase cleanup fails
      }
    }

    // 3. Delete Firestore images
    await Promise.all(
      imagesSnap.docs.map((d) =>
        deleteDoc(doc(db, "boards", boardIdParam, "images", d.id))
      )
    );

    // 4. Delete collaborators
    const collabSnap = await getDocs(collection(db, "boards", boardIdParam, "collaborators"));
    await Promise.all(
      collabSnap.docs.map((d) =>
        deleteDoc(doc(db, "boards", boardIdParam, "collaborators", d.id))
      )
    );

    // 5. Delete the board itself
    await deleteDoc(doc(db, "boards", boardIdParam));

    showToast("Board and all its picks deleted 🎯", "success", 2500);
    navigate("/");
  } catch (err) {
    console.error("delete board error", err);
    showToast("Could not delete board", "error", 3000);
  }
};

  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ marginTop: '0px' }} className='boardpage'>
      { /* show loader while images are loading */ }
      <Loader visible={imagesLoading} text={`Loading ${boardTitle ? boardTitle : 'board'}…`} />


        {/* back button  */}
        <button className="fixed-back-btn" onClick={() => navigate(-1)} aria-label="Go back" title="Back">
        {/* simple left chevron SVG */}
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M15 6 L9 12 L15 18" />
        </svg>
        </button>

      {/* boardpage HEADER kinda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0px' }}>
        <div style={{ width: 68, height: 1 }} />
        {/* board comments button (restored) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* share board button */}
          <button onClick={handleShareBoard}  title="Share board" className='onhoverbggrey'>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>

        {/* Multi-select toggle */}
        <button
          onClick={() => {
            const turningOn = !multiSelectMode;
            setMultiSelectMode(turningOn);
            if (!turningOn) clearSelection();
          }}
          title={multiSelectMode ? "Exit select mode" : "Select multiple picks"}
          style={{
                background: selectedImages.size > 0 ? '#4dabeeff' : 'transparent',
                color: selectedImages.size > 0 ? '#efefef' : '#333',
                border: 'none',
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                outline: 'none',
              }}
        >
          {multiSelectMode ? 'Cancel' : 'Select'}
        </button>

        {multiSelectMode && (
          <>
            <button
              onClick={() => selectedImages.size === images.length ? clearSelection() : selectAllImages()}
              
              style={{
                background: selectedImages.size > 0 ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.06)',
                color: selectedImages.size > 0 ? '#efefef' : '#666',
                border: 'none',
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer' ,
              }}
            >
              {selectedImages.size === images.length ? 'Clear' : 'Select all'}
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedImages.size === 0 || bulkDeleting}
              style={{
                background: selectedImages.size > 0 ? '#ee6c4d' : 'rgba(0,0,0,0.06)',
                color: selectedImages.size > 0 ? '#efefef' : '#666',
                border: 'none',
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer'
              }}
              title="Delete selected picks"
            >
              Delete {selectedImages.size > 0 ? `(${selectedImages.size})` : ''}
            </button>
          </>
        )}

        <SettingsModal open={open} setOpen={setOpen} settings={settings} setSettings={setSettings} />

        <button aria-label="Board settings"  title='Board settings'  className='onhoverbggrey'
          onClick={()=> setOpen(prev => !prev)}
        >
          {/* gear/settings  */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"strokeLinecap="round"strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33  1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51  1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06  a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
                a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06  a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9  a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
                a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9 c0 .66.39 1.26 1 1.51h.09a2 2 0 0 1 0 4h-.09  a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>

          <div style={{ position: 'relative' }} ref={menuRef}>
            <button aria-label="Board menu" onClick={() => setShowBoardMenu((s) => !s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, marginTop: 8, outline: 'none' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </button>

          {/* 3-dots menu */}
          {showBoardMenu && (
            <div role="menu" style={{ position: 'absolute', right: 0, top: '36px', minWidth: 180, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 120 }}>

              <button onClick={() => handleRename(boardId, boardTitle)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                <span style={{ fontSize: 16, color: "#0f0f0fff" }}>Rename</span>
              </button>

          {/* reorder toggle */}
          <button
            aria-pressed={reorderMode}
            onClick={toggleReorder}
            title={reorderMode ? "Finish reordering" : "Reorder images"}
            className={`onhoverbggrey ${reorderMode ? "active" : ""}`}
          >
            {/* reorder SVG (subtle grid-like icon) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={reorderMode ? '#fff' : '#333'} strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          <span style={{ fontSize: 16 }}>{reorderMode ? 'Done' : 'Reorder'}</span>
          </button>

              <button
                aria-label="Board comments"
                onClick={openBoardComments}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  position: "relative",
                }}
              >
                {/* chat bubble svg */}
                <div style={{ position: "relative", display: "inline-block" }}>
                  <svg width="20" height="20"  viewBox="0 0 24 24"fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>

                  {/* count badge */}
                  {boardCommentsCount > 0 && (
                    <span
                      style={{
                        position: "absolute", top: -6, right: -6, background: "#2d95baff", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: 11, fontWeight: 600, lineHeight: 1, }}
                    >
                      {boardCommentsCount}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: 16, color: "#0f0f0fff" }}>Board comments</span>
              </button>

              <button onClick={() => handleDeleteBoard(boardId)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#b82b2b' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                Delete board
              </button>

            </div>
          )}
          </div>
        </div>
      </div>
      {/* h2, picks, last opened */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginLeft: '8px' }}>
        <h2 style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', userSelect: 'none', margin: 0, lineHeight: 1.06, marginBottom: '10px' }}>
          {boardTitle}{' '}
          <span style={{ fontSize: '0.9rem', color: '#888', marginTop: '9px' }}>{images.length} {images.length === 1 ? 'pick' : 'picks'} {lastOpenedShort ? (<><span style={{ margin: '0 6px' }}>·</span>{lastOpenedShort}</>) : null}</span>
        </h2>
      </div>
            
      {/* Collaborators */}
      <div onClick={openCollaboratorsModal} style={{ cursor: 'pointer', display: 'flex', width: 'fit-content',alignItems: 'center', gap: '0px', marginTop: '6px', marginBottom: '12px', position: 'relative', marginLeft: '8px' }} title={collaboratorProfiles.length > 0 ? collaboratorProfiles.map(p => p.displayName || 'Unknown User').join(', ') : 'No collaborators'}>
        {collaboratorProfiles.map((profile, i) => {
        const photo = profile.photoURL || "/public/eat (1).png"; // fallback image
        const name = profile.displayName || "Unknown User";

        return (
          <img
            key={profile.uid}
            src={photo}
            alt={name}
            title={`${name} (${profile.uid})`}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover',
              transform: `translateX(-${i * 10}px)`,
              zIndex: collaboratorProfiles.length - i,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            }}
          />

        );
        })}

        {/* The new modal component */}
        <CollaboratorsModal
          isOpen={isCollaboratorsModalOpen}
          onClose={closeCollaboratorsModal}
          collaboratorProfiles={collaboratorProfiles}
        />

      </div>

      {/* Paste box */}
      <style>{`
          @keyframes pulseBorder {
            0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.6); }
            50% { box-shadow: 0 0 10px 4px rgba(33, 150, 243, 0.9); }
            100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.3); }
          }
      `}</style>

      {/* Text area for paste / drag-and-drop */}
      <PasteBox modalIndex={modalIndex} boardId={boardId} boardTitle={boardTitle} user={user} showToast={showToast} setLastOpenedShort={setLastOpenedShort}/>


      {/* Images grid */}
      <ImageGrid
        images={images}
        reorderMode={reorderMode}
        setReorderMode={setReorderMode}
        setModalIndex={setModalIndex}
        multiSelectMode={multiSelectMode}
        selectedImages={selectedImages}
        toggleSelectImage={toggleSelectImage}
      />


      {/* Modal */}
      <Modal
        images={images}
        modalIndex={modalIndex}
        setModalIndex={setModalIndex}
        commentCounts={commentCounts}
        openCommentsForIndex={openCommentsForIndex}
        handleDeleteImage={handleDeleteImage}
        isMobile={isMobile}
        settings={settings}
      />
    
      {/* Comments modal (polished, glassy, teal gradient) */}
      <CommentsModal
        commentsUnsubRef={commentsUnsubRef} openCommentsForIndex={openCommentsForIndex} commentModalOpen={commentModalOpen} setCommentModalOpen={setCommentModalOpen}
        commentList={commentList} setCommentList={setCommentList} user={user} images={images} modalIndex={modalIndex} commentText={commentText}
        setCommentText={setCommentText} collaborators={collaborators} notifyFriends={notifyFriends} setNotifyFriends={setNotifyFriends} showToast={showToast}
        boardId={boardId} boardTitle={boardTitle}
      />

      {/* Board comments modal — polished glassy teal style */}
      <BoardCommentsModal
        boardCommentsUnsubRef={boardCommentsUnsubRef} openBoardComments={openBoardComments} boardCommentModalOpen={boardCommentModalOpen}
        setBoardCommentModalOpen={setBoardCommentModalOpen} boardCommentList={boardCommentList} setBoardCommentList={setBoardCommentList}
        user={user} collaboratorProfiles={collaboratorProfiles} boardCommentText={boardCommentText}  setBoardCommentText={setBoardCommentText}
        boardNotifyFriends={boardNotifyFriends} setBoardNotifyFriends={setBoardNotifyFriends} timeAgoShort={timeAgoShort}  showToast={showToast} boardId={boardId} boardTitle={boardTitle} collaborators={collaborators}
      />

      {/* Toast */}
      <Toast toast={toast} setToast={setToast} />
    </div>
  );
}
