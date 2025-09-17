import { useEffect, useRef, useState } from 'react';
import {
  doc, collection,  onSnapshot, query, orderBy,getDoc, getDocs, where, limit, documentId,
} from 'firebase/firestore';
import { db } from '../firebase';

// ------------------ small helpers ------------------
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

function chunkArray(arr, n = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// basic cached profile getter (keeps parity with BoardPage.getProfileCached)
export async function getProfileCached(uid) {
  try {
    if (!uid) return { displayName: 'Unknown', photoURL: '' };
    const TTL = 1000 * 60 * 60 * 24; // 24h
    const now = Date.now();
    const key = `profile_${uid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed._cachedAt && now - parsed._cachedAt < TTL) {
        if (parsed.data && (parsed.data.displayName || parsed.data.photoURL)) {
          return parsed.data;
        }
      }
    }

    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : { displayName: 'Unknown', photoURL: '' };
    const toStore = { displayName: data.displayName || 'Unknown', photoURL: data.photoURL || '' };
    localStorage.setItem(key, JSON.stringify({ _cachedAt: now, data: toStore }));
    return toStore;
  } catch (err) {
    console.error('getProfileCached err', err);
    return { displayName: 'Unknown', photoURL: '' };
  }
}

// ------------------ hooks ------------------

// 1) Board + collaborators realtime listeners
export function useBoardAndCollaborators(boardId) {
  const [boardTitle, setBoardTitle] = useState('');
  const [lastOpenedShort, setLastOpenedShort] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorUIDs, setCollaboratorUIDs] = useState([]);
  const ownerRef = useRef(null);

  useEffect(() => {
    if (!boardId) return;
    let mounted = true;
    const boardRef = doc(db, 'boards', boardId);
    const collabsRef = collection(db, 'boards', boardId, 'collaborators');

    const unsubBoard = onSnapshot(boardRef, (snap) => {
      if (!mounted || !snap.exists()) return;
      const data = snap.data();
      setBoardTitle(data.title || '(Untitled)');
      ownerRef.current = data.owner || data.ownerId || null;
      const ts = data.updatedAt || data.createdAt || null;
      setLastOpenedShort(timeAgoShort(ts));
    });

    const unsubCollabs = onSnapshot(collabsRef, (snap) => {
      if (!mounted) return;
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCollaborators(docs);

      (async () => {
        const collabIDs = docs.map((d) => d.id);
        let all = Array.from(new Set([...collabIDs]));
        if (ownerRef.current && !all.includes(ownerRef.current)) {
          // attempt to resolve owner if it's an email string
          if (typeof ownerRef.current === 'string' && ownerRef.current.includes('@')) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', ownerRef.current), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) all.push(snap.docs[0].id);
              else all.push(ownerRef.current);
            } catch (err) {
              console.warn('resolveOwnerId failed', err);
              all.push(ownerRef.current);
            }
          } else {
            all.push(ownerRef.current);
          }
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

  return { boardTitle, setBoardTitle, collaborators, timeAgoShort, getProfileCached, lastOpenedShort, setLastOpenedShort, collaborators, collaboratorUIDs };
}

// 2) Cached-first batch fetch of collaborator profiles
export function useCollaboratorProfiles(collaboratorUIDs) {
  const [collaboratorProfiles, setCollaboratorProfiles] = useState([]);

  useEffect(() => {
    if (!collaboratorUIDs || collaboratorUIDs.length === 0) {
      setCollaboratorProfiles([]);
      return;
    }
    let cancelled = false;
    const now = Date.now();
    const TTL = 1000 * 60 * 60 * 24;

    // cached-first
    const cachedList = collaboratorUIDs.map((uid) => {
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

    setCollaboratorProfiles(cachedList);

    (async () => {
      try {
        const uids = Array.from(new Set(collaboratorUIDs));
        const chunks = chunkArray(uids, 10);
        const fetches = chunks.map(async (chunk) => {
          const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        });
        const arrays = await Promise.all(fetches);
        const flat = arrays.flat();
        const map = new Map(flat.map((p) => [p.uid, { displayName: p.displayName || 'Unknown', photoURL: p.photoURL || '', email: p.email || 'No email' }]));
        const ordered = uids.map((uid) => {
          const got = map.get(uid);
          const out = got || { displayName: 'Unknown', photoURL: '', email: 'Unknown email' };
          try {
            const key = `profile_${uid}`;
            const toStore = { _cachedAt: Date.now(), data: { displayName: out.displayName, photoURL: out.photoURL, email: out.email } };
            localStorage.setItem(key, JSON.stringify(toStore));
          } catch (e) {}
          return { uid, ...out };
        });
        if (!cancelled) setCollaboratorProfiles(ordered);
      } catch (err) {
        console.error('Failed to fetch profiles in batch:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collaboratorUIDs]);

  return collaboratorProfiles;
}

// 3) Escape key handler hook (generic)
export function useEscapeToExit(enabled, onExit) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onExit && onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onExit]);
}

// 4) Mount logger (for debugging)
export function useMountLogger(name = 'Component') {
  useEffect(() => {
    const mountTime = performance.now();
    console.log(`[${name}] mounted at`, new Date().toLocaleTimeString());
    return () => {
      const unmountTime = performance.now();
      console.log(`[${name}] unmounted, stayed for ${(unmountTime - mountTime).toFixed(2)}ms`);
    };
  }, [name]);
}

// 5) Images realtime subscription (returns images + loading). Mirrors onSnapshot in BoardPage
export function useImagesSubscription(boardId) {
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const imagesUnsubRef = useRef(null);

  useEffect(() => {
    if (!boardId) return;
    setImagesLoading(true);
    const q = query(collection(db, 'boards', boardId, 'images'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
          const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
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

  return { images, imagesLoading };
}

// 6) Per-image realtime comment counts
export function useCommentCounts(boardId, images) {
  const [commentCounts, setCommentCounts] = useState({});
  const unsubsRef = useRef(new Map());

  useEffect(() => {
    if (!boardId) return;
    const map = unsubsRef.current;

    images.forEach((img) => {
      if (map.has(img.id)) return;
      const commentsRef = collection(db, 'boards', boardId, 'images', img.id, 'comments');
      const unsub = onSnapshot(commentsRef, (snap) => {
        setCommentCounts((prev) => ({ ...prev, [img.id]: snap.size }));
      });
      map.set(img.id, unsub);
    });

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
      // keep listeners until unmount in original implementation; here we do nothing per-run
    };
  }, [images, boardId]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current.clear();
    };
  }, []);

  return commentCounts;
}

// 7) Board comments count subscription
export function useBoardCommentsCount(boardId) {
  const [boardCommentsCount, setBoardCommentsCount] = useState(0);
  useEffect(() => {
    if (!boardId) return;
    const ref = collection(db, 'boards', boardId, 'comments');
    const unsub = onSnapshot(ref, (snap) => {
      setBoardCommentsCount(snap.size);
    });
    return () => unsub();
  }, [boardId]);
  return boardCommentsCount;
}

// 8) One-off fetch board title (keeps parity with existing fetch)
export function useFetchBoardTitle(boardId) {
  const [boardTitle, setBoardTitle] = useState('');
  const [lastOpenedShort, setLastOpenedShort] = useState('');

  useEffect(() => {
    const fetchBoardTitle = async () => {
      if (!boardId) return;
      const boardRef = doc(db, 'boards', boardId);
      const boardSnap = await getDoc(boardRef);
      if (boardSnap.exists()) {
        const data = boardSnap.data();
        setBoardTitle(data.title || '(Untitled)');
        const ts = data.updatedAt || data.createdAt || null;
        setLastOpenedShort(timeAgoShort(ts));
      } else {
        setBoardTitle('(Board not found)');
      }
    };
    fetchBoardTitle();
  }, [boardId]);

  return { boardTitle, lastOpenedShort , setLastOpenedShort};
}

// 9) Deep-link: open image modal when ?image= present
export function useDeepLinkImageOpen(searchString, images, onOpenAtIndex) {
  useEffect(() => {
    try {
      const params = new URLSearchParams(searchString);
      const imageId = params.get('image');
      if (!imageId) return;
      if (images && images.length > 0) {
        const idx = images.findIndex((img) => img.id === imageId);
        if (idx !== -1) {
          onOpenAtIndex && onOpenAtIndex(idx);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('image');
            window.history.replaceState({}, '', url.toString());
          } catch (err) {}
          return;
        }
      }
    } catch (e) {
      // ignore malformed URL
    }
  }, [searchString, images, onOpenAtIndex]);
}

// 10) Modal keyboard navigation
export function useModalKeyboardNavigation(modalIndex, imagesLength, setModalIndex) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalIndex === null) return;
      if (e.key === 'ArrowLeft') {
        setModalIndex((prev) => (prev === 0 ? imagesLength - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setModalIndex((prev) => (prev === imagesLength - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setModalIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalIndex, imagesLength, setModalIndex]);
}

// 11) Click-outside hook
export function useOutsideClick(ref, onOutside, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutside && onOutside(event);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, onOutside, enabled]);

}

// ------------------ end hooks ------------------

// Small note: these hooks aim to mirror the original BoardPage useEffects with minimal API
// changes. You can import any subset into BoardPage and wire state setters to your
// existing local state (e.g. setModalIndex).
