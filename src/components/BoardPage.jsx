// BoardPage.jsx 
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc, documentId, getDoc, getDocs, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, deleteDoc,
  limit, setDoc, where,
  writeBatch,
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

const MAX_FIRESTORE_SIZE = 1 * 1024 * 1024; // 1MB
export default function BoardPage({ user }) {
  const { id: boardId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Reorder state (jiggle + drag)
const [reorderMode, setReorderMode] = useState(false); // toggles jiggle & drag
const [draggingIndex, setDraggingIndex] = useState(null);
const [dragOverIndex, setDragOverIndex] = useState(null);

  const [images, setImages] = useState([]);
  const [boardTitle, setBoardTitle] = useState('');
  const [toast, setToast] = useState(null); // { msg, type, duration }
  const [modalIndex, setModalIndex] = useState(null);

  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorUIDs, setCollaboratorUIDs] = useState([]);
  const [collaboratorProfiles, setcollaboratorProfiles] = useState([]);

  // NEW: loading flag for images
  const [imagesLoading, setImagesLoading] = useState(true);

  // Board menu (3-dots)
  const [showBoardMenu, setShowBoardMenu] = useState(false);

  // put once in the component body (used by other effects sometimes)
  const imagesUnsubRef = useRef(null);

  // Comments modal state (image-level)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentList, setCommentList] = useState([]);
  const [commentText, setCommentText] = useState('');
  const commentsUnsubRef = useRef(null);

  // board-level comments (small button beside 3-dots)
  const [boardCommentModalOpen, setBoardCommentModalOpen] = useState(false);
  const [boardCommentList, setBoardCommentList] = useState([]);
  const [boardCommentText, setBoardCommentText] = useState('');
  const boardCommentsUnsubRef = useRef(null);
  const [boardCommentsCount, setBoardCommentsCount] = useState(0);

  // Collaborators modal
  const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false);

  const openCollaboratorsModal = () => setIsCollaboratorsModalOpen(true);
  const closeCollaboratorsModal = () => setIsCollaboratorsModalOpen(false);

  // per-image comment counts map { imageId: number }
  const [commentCounts, setCommentCounts] = useState({});
  const commentCountsUnsubsRef = useRef(new Map());

  // short "last opened" string
  const [lastOpenedShort, setLastOpenedShort] = useState('');

  // whether to notify collaborators when posting an image comment
  const [notifyFriends, setNotifyFriends] = useState(false);

  // separate flag for board-level comments
  const [boardNotifyFriends, setBoardNotifyFriends] = useState(false);

  // -------------------- Toast helper --------------------
  const showToast = (msg, type = 'info', duration = 5000) => {
    setToast({ msg, type, duration });
    setTimeout(() => setToast(null), duration);
  };

  // -------------------- small helpers --------------------
  function timeAgoShort(ts) {
    if (!ts) return '';
    let ms = 0;
    if (ts.toDate) ms = ts.toDate().getTime();
    else if (ts.seconds) ms = ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
    else if (typeof ts === 'number') ms = ts;
    else if (ts instanceof Date) ms = ts.getTime();
    else return '';

    const diff = Date.now() - ms;
    const mins = Math.round(diff / (1000 * 60));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  }

  async function getProfileCached(uid) {
  try {
    if (!uid) return { displayName: 'Unknown', photoURL: '' };
    const TTL = 1000 * 60 * 60 * 24; // 24h
    const now = Date.now();
    const key = `profile_${uid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed._cachedAt && now - parsed._cachedAt < TTL) {
        // use cached only if it has at least a displayName or a non-empty photoURL
        if (parsed.data && (parsed.data.displayName || parsed.data.photoURL)) {
          // quick optimistic return (fast UI)
          return parsed.data;
        }
      }
    }

    // fetch from Firestore
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : { displayName: 'Unknown', photoURL: '' };
    const serverUpdatedAt = snap.exists() ? data.updatedAt?.seconds || null : null;
    const toStore = { displayName: data.displayName || 'Unknown', photoURL: data.photoURL || '' };
    localStorage.setItem(key, JSON.stringify({ _cachedAt: now, serverUpdatedAt, data: toStore }));
    return toStore;
  } catch (err) {
    console.error('getProfileCached err', err);
    return { displayName: 'Unknown', photoURL: '' };
  }
}

// helper: split into chunks (Firestore 'in' supports up to 10)
function chunkArray(arr, n = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// resolve owner id if owner stored as email (optional safety)
async function resolveOwnerId(maybeOwner) {
  if (!maybeOwner) return null;
  if (typeof maybeOwner === 'string' && maybeOwner.includes('@')) {
    try {
      const q = query(collection(db, 'users'), where('email', '==', maybeOwner), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].id;
      return maybeOwner;
    } catch (err) {
      console.warn('resolveOwnerId failed', err);
      return maybeOwner;
    }
  }
  return maybeOwner;
}

// Combined realtime listeners: board doc (title/updatedAt) + collaborators subcollection (live)
// and then fast batched profile fetch + cached-first UI.
useEffect(() => {
  if (!boardId) return;
  let mounted = true;
  const boardRef = doc(db, 'boards', boardId);
  const collabsRef = collection(db, 'boards', boardId, 'collaborators');

  // keep owner value up-to-date for including in UID list
  const ownerRef = { current: null };

  // board listener (title and timestamps)
  const unsubBoard = onSnapshot(boardRef, (snap) => {
    if (!mounted || !snap.exists()) return;
    const data = snap.data();
    setBoardTitle(data.title || '(Untitled)');
    ownerRef.current = data.owner || data.ownerId || null;
    const ts = data.updatedAt || data.createdAt || null;
    setLastOpenedShort(timeAgoShort(ts));
  });

  // collaborators listener
  const unsubCollabs = onSnapshot(collabsRef, (snap) => {
    if (!mounted) return;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setCollaborators(docs);

    // build collaboratorUIDs including owner (resolve email->uid if needed)
    (async () => {
      const collabIDs = docs.map(d => d.id);
      let all = Array.from(new Set([...collabIDs]));
      if (ownerRef.current && !all.includes(ownerRef.current)) {
        // resolve owner if it's an email string stored in legacy data
        const maybeResolved = ownerRef.current && ownerRef.current.includes('@') ? await resolveOwnerId(ownerRef.current) : ownerRef.current;
        if (maybeResolved) all.push(maybeResolved);
      }
      if (mounted) setCollaboratorUIDs(all);
    })();
  });

  return () => {
    mounted = false;
    unsubBoard && unsubBoard();
    unsubCollabs && unsubCollabs();
  };
}, [boardId]);

// Profiles: cached-first rendering, then batch-fetch from users collection using documentId() in chunks
useEffect(() => {
  if (!collaboratorUIDs || collaboratorUIDs.length === 0) {
    setcollaboratorProfiles([]);
    return;
  }
  let cancelled = false;
  const now = Date.now();
  const TTL = 1000 * 60 * 60 * 24; // 24h

  // 1) immediate cached-first result
  const cachedList = collaboratorUIDs.map(uid => {
    try {
      const raw = localStorage.getItem(`profile_${uid}`);
      if (!raw) return { uid, displayName: 'Unknown', photoURL: '' };
      const parsed = JSON.parse(raw);
      if (parsed._cachedAt && now - parsed._cachedAt < TTL && parsed.data) {
        if (parsed.data.displayName || parsed.data.photoURL) return { uid, ...parsed.data };
      }
      return { uid, displayName: 'Unknown', photoURL: '' };
    } catch (e) {
      return { uid, displayName: 'Unknown', photoURL: '' };
    }
  });
  setcollaboratorProfiles(cachedList);

  // 2) batch fetch fresh profiles from Firestore
  (async () => {
    try {
      const uids = Array.from(new Set(collaboratorUIDs));
      const chunks = chunkArray(uids, 10); // Firestore 'in' limit = 10
      const fetches = chunks.map(async (chunk) => {
        const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      });
      const arrays = await Promise.all(fetches);
      const flat = arrays.flat();
      const map = new Map(flat.map(p => [p.uid, { displayName: p.displayName || 'Unknown', photoURL: p.photoURL || '' , email: p.email || 'No email' }]));
      const ordered = uids.map(uid => {
          const got = map.get(uid);
          const out = got || { displayName: 'Unknown', photoURL: '', email: 'Unknown email' };
          // update cache
          try {
            const key = `profile_${uid}`;
            const toStore = { _cachedAt: Date.now(), data: { displayName: out.displayName, photoURL: out.photoURL, email: out.email } };
            localStorage.setItem(key, JSON.stringify(toStore));
          } catch (e) { /* ignore localStorage errors */ }
          return { uid, ...out };
      });

      if (!cancelled) setcollaboratorProfiles(ordered);
    } catch (err) {
      console.error('Failed to fetch profiles in batch:', err);
    }
  })();

  return () => { cancelled = true; };
}, [collaboratorUIDs]);

  // escape key handler to exit reorder mode
  useEffect(() => {
  const onKey = (e) => {
    if (e.key === 'Escape' && reorderMode) {
      setReorderMode(false);
      setDraggingIndex(null);
      setDragOverIndex(null);
      showToast('Reorder mode exited', 'info', 1200);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [reorderMode]);

// lazy logs
useEffect(() => {
    const mountTime = performance.now();
    console.log("[BoardPage] mounted at", new Date().toLocaleTimeString());

    return () => {
      const unmountTime = performance.now();
      console.log(
        `[BoardPage] unmounted, stayed for ${(unmountTime - mountTime).toFixed(
          2
        )}ms`
      );
    };
  }, []);

  // -------------------- realtime images subscription --------------------
  useEffect(() => {
    if (!boardId) return;

    setImagesLoading(true); // show skeletons while we subscribe

    const q = query(collection(db, 'boards', boardId, 'images'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // normalize order: if order exists use it; else treat as large number so createdAt sorts next
        items.sort((a, b) => {
          const aOrder = (typeof a.order === 'number') ? a.order : Number.MAX_SAFE_INTEGER;
          const bOrder = (typeof b.order === 'number') ? b.order : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          // fallback: newest first by createdAt
          const aT = a.createdAt?.seconds || 0;
          const bT = b.createdAt?.seconds || 0;
          return bT - aT;
        });
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

  // -------------------- Reorder helpers --------------------
const toggleReorder = () => {
  setReorderMode((s) => {
    // if turning off, clear drag state
    if (s) {
      setDraggingIndex(null);
      setDragOverIndex(null);
    }
    return !s;
  });
};

  // delete a single image comment (optimistic UI + Firestore delete)
  const handleDeleteImageComment = async (commentId, commentCreatorId, imageId) => {
    // permission check (client-side): only comment author can delete.
    if (commentCreatorId !== user.uid) {
      showToast("You can only delete your own comments", "error", 2200);
      return;
    }

    const confirmDelete = window.confirm("Delete this comment?");
    if (!confirmDelete) return;

    // optimistic UI: remove immediately from local state
    setCommentList((prev) => prev.filter((c) => c.id !== commentId));

    try {
      await deleteDoc(doc(db, "boards", boardId, "images", imageId, "comments", commentId));
      showToast("Comment deleted", "success", 1600);
    } catch (err) {
      console.error("Failed to delete image comment", err);
      showToast("Could not delete comment — try again", "error", 3000);
      // rollback: re-open subscription for the current image
      if (typeof openCommentsForIndex === "function" && modalIndex !== null) {
        openCommentsForIndex(modalIndex);
      }
    }
  };

// Desktop HTML5 drag handlers
const onDragStart = (e, index) => {
  if (!reorderMode) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  setDraggingIndex(index);
  // small transparent drag image to avoid ghost
  try {
    const img = document.createElement('img');
    img.src = '/transparent-1x1.png'; // optional transparent 1x1 in public; optional fallback
    e.dataTransfer.setDragImage(img, 0, 0);
  } catch (err) { /* ignore */ }
};

const onDragOver = (e, index) => {
  if (!reorderMode) return;
  e.preventDefault(); // allow drop
  if (dragOverIndex !== index) setDragOverIndex(index);
};

const onDrop = async (e, index) => {
  if (!reorderMode) return;
  e.preventDefault();
  const from = Number(e.dataTransfer.getData('text/plain'));
  const to = index;

  if (Number.isNaN(from)) {
    setDraggingIndex(null);
    setDragOverIndex(null);
    return;
  }
  if (from === to) {
    setDraggingIndex(null);
    setDragOverIndex(null);
    return;
  }

  // local reorder
  const newImages = [...images];
  const [moved] = newImages.splice(from, 1);
  newImages.splice(to, 0, moved);
  setImages(newImages);

  // persist immediately
  await persistOrder(newImages);

  setDraggingIndex(null);
  setDragOverIndex(null);
};

const onDragEnd = () => {
  setDraggingIndex(null);
  setDragOverIndex(null);
};

// fallback move-by-button for mobile / accessibility
const moveImageBy = async (fromIndex, toIndex) => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= images.length || toIndex >= images.length) return;
  const newImages = [...images];
  const [moved] = newImages.splice(fromIndex, 1);
  newImages.splice(toIndex, 0, moved);
  setImages(newImages);
  await persistOrder(newImages);
};

// write 'order' field to Firestore in a batch (index 0 = first)
const persistOrder = async (orderedImages) => {
  if (!boardId) return;
  try {
    const batch = writeBatch(db);
    orderedImages.forEach((img, idx) => {
      const imgRef = doc(db, 'boards', boardId, 'images', img.id);
      batch.update(imgRef, { order: idx });
    });
    await batch.commit();
    showToast('Order saved', 'success', 1800);
  } catch (err) {
    console.error('persistOrder error', err);
    showToast('Could not persist order — try again', 'error', 3000);
  }
};

  // -------------------- per-image realtime comment counts --------------------
  useEffect(() => {
    if (!boardId) return;
    const map = commentCountsUnsubsRef.current;

    // add listeners for new images
    images.forEach((img) => {
      if (map.has(img.id)) return;
      const commentsRef = collection(db, 'boards', boardId, 'images', img.id, 'comments');
      const unsub = onSnapshot(commentsRef, (snap) => {
        setCommentCounts((prev) => ({ ...prev, [img.id]: snap.size }));
      });
      map.set(img.id, unsub);
    });

    // remove listeners for images that no longer exist
    const existingIds = new Set(images.map((i) => i.id));
    for (const [id, unsub] of Array.from(map.entries())) {
      if (!existingIds.has(id)) {
        unsub();
        map.delete(id);
        setCommentCounts((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    }

    return () => {
      // cleanup all listeners on unmount
      // (do not clear cache here)
      // we'll keep map listeners until component unmounts
    };
  }, [images, boardId]);

  // cleanup comment count listeners on unmount
  useEffect(() => {
    return () => {
      commentCountsUnsubsRef.current.forEach((unsub) => unsub());
      commentCountsUnsubsRef.current.clear();
    };
  }, []);

  // -------------------- board comments count + subscription helper --------------------
  useEffect(() => {
    if (!boardId) return;
    const ref = collection(db, 'boards', boardId, 'comments');
    const unsub = onSnapshot(ref, (snap) => {
      setBoardCommentsCount(snap.size);
    });
    return () => unsub();
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
        // prefer updatedAt -> lastOpenedAt -> createdAt
      const ts = data.updatedAt || data.createdAt || null;
        setLastOpenedShort(timeAgoShort(ts));
      } else {
        setBoardTitle('(Board not found)');
      }
    };

    fetchBoardTitle();
  }, [boardId]);

  // update header short time when images change (new pick added)
useEffect(() => {
  if (!images || images.length === 0) return;
  // images expected ordered by createdAt desc — use first one
  const newestImgTs = images[0].createdAt || null;
  if (newestImgTs) {
    setLastOpenedShort(timeAgoShort(newestImgTs));
  }
}, [images]); // images is your state from onSnapshot


  // -------------------- deep-link: open image modal when ?image=<id> present --------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const imageId = params.get('image');
    if (!imageId) return;

    if (images && images.length > 0) {
      const idx = images.findIndex((img) => img.id === imageId);
      if (idx !== -1) {
        setModalIndex(idx);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('image');
          window.history.replaceState({}, '', url.toString());
        } catch (err) {}
        return;
      }
    }
  }, [location.search, images]);




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

  const closeComments = () => {
    setCommentModalOpen(false);
    setCommentText('');
    setCommentList([]);
    if (commentsUnsubRef.current) {
      commentsUnsubRef.current();
      commentsUnsubRef.current = null;
    }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    const image = images[modalIndex];
    if (!image) return;
    try {
      const newDocRef = await addDoc(collection(db, 'boards', boardId, 'images', image.id, 'comments'), {
        text: commentText.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // optionally notify collaborators (excluding the poster)
      if (notifyFriends && collaborators && collaborators.length > 0) {
        try {
          const collaboratorUIDs = collaborators.map(c => c.id).filter(uid => uid && uid !== user.uid);
          const payload = {
            type: 'comment',
            text: `${user.displayName || 'Someone'} commented on a pick in ${boardTitle || ''}`,
            createdAt: serverTimestamp(),
            read: false,
            boardId,
            imageId: image.id,
            actor: user.uid,
            url: `/board/${boardId}?image=${image.id}`,
          };
          await Promise.all(collaboratorUIDs.map(uid => addDoc(collection(db, 'users', uid, 'notifications'), payload)));
        } catch (err) {
          console.warn('Could not create comment notifications', err);
        }
      }

      setCommentText('');
      setNotifyFriends(false); // reset checkbox
      showToast('Comment posted', 'success', 2000);
    } catch (err) {
      console.error('post comment error', err);
      showToast('Could not post comment', 'error', 3000);
    }
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

  const closeBoardComments = () => {
    setBoardCommentModalOpen(false);
    setBoardCommentText('');
    setBoardCommentList([]);
    if (boardCommentsUnsubRef.current) {
      boardCommentsUnsubRef.current();
      boardCommentsUnsubRef.current = null;
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

  


  // delete single image (from Firestore + Supabase if applicable)
const handleDeleteImage = async (imageId, index) => {
  const confirmDelete = window.confirm("Delete this pick?");
  if (!confirmDelete) {
    return;
  }
  setModalIndex(null); // close modal if open

  try {
    // First get the Firestore doc
    const imageDocRef = doc(db, "boards", boardId, "images", imageId);
    const imageDocSnap = await getDoc(imageDocRef);

    if (imageDocSnap.exists()) {
      const { src } = imageDocSnap.data();

      if (src) {
        // Extract Supabase storage path from public URL
        const urlPrefix = import.meta.env.VITE_SUPABASE_URLPREFIX;
        const storagePath = src.replace(urlPrefix, ""); // e.g. boards/.../filename.png

        // Delete from Supabase
        const { data, error: supabaseError } = await supabase.storage
          .from("pixpick-images")
          .remove([storagePath]);

        if (supabaseError) {
          console.error("Supabase deletion error:", supabaseError);
          showToast("Could not delete from storage", "error", 3000);
          return; // don't delete from Firestore if storage delete fails
        }
      }
    }

    // Delete Firestore doc
    await deleteDoc(imageDocRef);
    showToast("Pick deleted", "success", 2500);
  } catch (err) {
    console.error("delete image error", err);
    showToast("Could not delete pick", "error", 3000);
  }
};


  // -------------------- Share board logic --------------------
  const handleShareBoard = async () => {
    const email = prompt('Enter email of person to share with');
    if (!email || !email.trim()) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast('User not found', 'error', 3000);
        return;
      }
      const userDoc = snap.docs[0];
      const uid = userDoc.id;

      // write collaborator doc
      await setDoc(doc(db, 'boards', boardId, 'collaborators', uid), { role: 'collaborator', addedAt: serverTimestamp() });

      // OPTIONAL: create a notification for that user
      try {
        const payload = {
          type: 'shared_board',
          text: `${user.displayName || 'Someone'} shared a board with you: ${boardTitle || ''}`,
          createdAt: serverTimestamp(),
          read: false,
          boardId,
          actor: user.uid,
          url: `/board/${boardId}`,
        };
        await addDoc(collection(db, 'users', uid, 'notifications'), payload);
      } catch (err) {
        console.warn('Could not create share notification', err);
      }

      showToast('Board shared', 'success', 2500);
    } catch (err) {
      console.error('share board error', err);
      showToast('Could not share board', 'error', 3000);
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
  const isMobile = window.innerWidth < 768;

  return (
    <div style={{ marginTop: '0px' }} className='boardpage'>
      {/* back button  */}
        <button className="fixed-back-btn" onClick={() => navigate(-1)} aria-label="Go back" title="Back">
        {/* simple left chevron SVG */}
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M15 6 L9 12 L15 18" />
        </svg>
        </button>

      {/* boardpage HEADER kinda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0px' }}>
        
        {/* LEFT spacer: reserve same visual width as the floating button (56) + left offset (12) =>
          total 68 so the right side remains exactly to the right like before */}
        <div style={{ width: 68, height: 1 }} />
        {/* board comments button (restored) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <span style={{ fontSize: 13 }}>{reorderMode ? 'Done' : 'Reorder'}</span>
          </button>

          <button aria-label="Board settings"
            title='Board settings'
            className='onhoverbggrey'
            onClick={()=> setSettingsmodal(true)}
          >
            {/* gear/settings SVG */}
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

            {showBoardMenu && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '36px', minWidth: 180, background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 120 }}>
                <button onClick={handleShareBoard} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: 8, border: 'none', background: '#e6ffef', cursor: 'pointer', color: '#0b6b2f', borderRadius: 6, fontWeight: 600 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share board
                </button>

                <button onClick={() => handleRename(boardId, boardTitle)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                  Rename
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
      <PasteBox />


      {/* Images grid */}
      <ImageGrid
        images={images}
        imagesLoading={imagesLoading}
        reorderMode={reorderMode}
        setReorderMode={setReorderMode}
        draggingIndex={draggingIndex}
        dragOverIndex={dragOverIndex}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        setModalIndex={setModalIndex}
        handleDeleteImage={handleDeleteImage}
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
      />
    

      {/* Comments modal (polished, glassy, teal gradient) */}
      <CommentsModal
        commentModalOpen={commentModalOpen}
        closeComments={closeComments}
        commentList={commentList}
        user={user}
        handleDeleteImageComment={handleDeleteImageComment}
        images={images}
        modalIndex={modalIndex}
        commentText={commentText}
        setCommentText={setCommentText}
        postComment={postComment}
        notifyFriends={notifyFriends}
        setNotifyFriends={setNotifyFriends}
      />


      {/* Board comments modal — polished glassy teal style */}
      <BoardCommentsModal
        boardCommentModalOpen={boardCommentModalOpen}
        closeBoardComments={closeBoardComments}
        boardCommentList={boardCommentList}
        user={user}
        handleDeleteBoardComment={handleDeleteBoardComment}
        collaboratorProfiles={collaboratorProfiles}
        boardCommentText={boardCommentText}
        setBoardCommentText={setBoardCommentText}
        postBoardComment={postBoardComment}
        boardNotifyFriends={boardNotifyFriends}
        setBoardNotifyFriends={setBoardNotifyFriends}
        timeAgoShort={timeAgoShort}
      />


      {/* Toast */}
      <Toast toast={toast} setToast={setToast} />
    </div>
  );
}
