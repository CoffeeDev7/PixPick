// App.jsx — updated: animated desktop toast for new notifications + deep-link handling + bell pulse animation
import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BoardList from './components/BoardList';
import CreateBoardModal from './components/modals/CreateBoardModal';
import BoardPage from './components/BoardPage';
import NotificationsPage from './components/Notifications';
import { auth, provider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { Suspense, lazy, useEffect, useState, useRef } from 'react';
import LoginPage from './components/LoginPage';
import { doc, getDoc,setDoc, collection, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import bellicon from './assets/bell_552745.png';
import Friends from './components/Friends';

export default function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState('My Boards');
  const [boardsCache, setBoardsCache] = useState([]);

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const location = useLocation();
  // If this navigation has a background saved, it'll be here:
  const backgroundLocation = location.state && location.state.background;

  const navigate = useNavigate();

  // make header hide only when this is a real board page (not modal)
  const isBoardPage = location.pathname.startsWith('/board/') && !backgroundLocation;
  const [authLoading, setAuthLoading] = useState(true);

  // notifications state (for top header)
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRefDom = useRef(null);

  // desktop toast state (tiny ephemeral notification animation)
  const [desktopNotif, setDesktopNotif] = useState(null); // {id, title, text}


  // Prevent background scroll while modal is open (when backgroundLocation exists)
  useEffect(() => {
    if (backgroundLocation) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [backgroundLocation]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false); // auth check is done
    });
    return () => unsubscribe();
  }, []);

  // realtime notifications listener for current user (simple, client-side)
  // Add these refs in your component body (near other refs)
const prevNotifIdsRef = useRef(new Set());
const desktopTimerRef = useRef(null);
const actorProfileCacheRef = useRef(new Map()); // caches { uid -> { photoURL, displayName } }

// Helper to normalize ids
const norm = (s) => String(s || "").trim();

/* ---------- Snapshot listener (replace your existing desktop listener) ---------- */
useEffect(() => {
  if (!user) {
    setNotifications([]);
    prevNotifIdsRef.current = new Set();
    return;
  }

  let isFirstSnapshot = true;

  const q = query(
    collection(db, "users", user.uid, "notifications"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: norm(d.id), ...d.data() }));

      // update notifications state immediately
      setNotifications(list);

      if (isFirstSnapshot) {
        // populate prev set and skip toasts on initial load
        prevNotifIdsRef.current = new Set(list.map((n) => norm(n.id)));
        isFirstSnapshot = false;
        return;
      }

      // find new & unread notifications not created by current user
      const prevSet = prevNotifIdsRef.current;
      const newUnread = list.filter(
        (n) => !prevSet.has(norm(n.id)) && n.read !== true && n.actor !== user.uid
      );

      // update prev set for future diffs
      prevNotifIdsRef.current = new Set(list.map((n) => norm(n.id)));

      if (newUnread.length > 0) {
        const newest = newUnread[0]; // most recent new unread

        // fetch actor profile if not cached; use an async IIFE so onSnapshot isn't async
        (async () => {
          let actorPhoto = "";
          let actorName = "";

          try {
            const cached = actorProfileCacheRef.current.get(newest.actor);
            if (cached) {
              actorPhoto = cached.photoURL || "";
              actorName = cached.displayName || "";
            } else {
              // try to read users/{actor} doc
              const snap = await getDoc(doc(db, "users", newest.actor));
              if (snap.exists()) {
                const d = snap.data() || {};
                actorPhoto = d.photoURL || "";
                actorName = d.displayName || "";
                actorProfileCacheRef.current.set(newest.actor, { photoURL: actorPhoto, displayName: actorName });
              }
            }
          } catch (err) {
            // swallow fetch errors and show fallback UI
            console.warn("Could not fetch actor profile for desktop toast", err);
          }

          // show desktop toast with actor photo (or fallback)
          setDesktopNotif({
            id: newest.id,
            title: (newest.type || "Activity").replace(/_/g, " "),
            text: newest.text,
            actorPhoto,
            actorName,
          });

          // 3s auto-dismiss
          if (desktopTimerRef.current) clearTimeout(desktopTimerRef.current);
          desktopTimerRef.current = setTimeout(() => setDesktopNotif(null), 3000);
        })();
      }
    },
    (err) => {
      console.error("notifications onSnapshot error (desktop):", err);
    }
  );

  return () => {
    if (desktopTimerRef.current) {
      clearTimeout(desktopTimerRef.current);
      desktopTimerRef.current = null;
    }
    unsub();
  };
}, [user]); // re-run on user change


  // clear desktop toast timer on unmount
  useEffect(() => {
    return () => {
      if (desktopTimerRef.current) clearTimeout(desktopTimerRef.current);
    };
  }, []);

  // close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (notifRefDom.current && !notifRefDom.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  async function markNotificationRead(n) {
    try {
      const ref = doc(db, 'users', user.uid, 'notifications', n.id);
      await updateDoc(ref, { read: true });
    } catch (err) {
      console.error('mark read error', err);
    }
  }

  // when user clicks a notification: mark read then navigate (deep-link)
  const handleOpenNotification = async (n) => {
    try {
      await markNotificationRead(n);
    } catch (err) {
      console.error('error marking read before navigate', err);
    }

    setNotifOpen(false);
    if (n.url) {
      navigate(n.url, { state: { from: location.pathname } });
    } else if (n.boardId) {
      navigate(`/board/${n.boardId}`, { state: { from: location.pathname } });
    }
  };

  async function login() {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      },
      { merge: true }
    );
  }

  const logout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // PROFILE DROPDOWN state & outside click
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    function handleProfileOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleProfileOutside);
    return () => document.removeEventListener('mousedown', handleProfileOutside);
  }, [profileMenuOpen]);

  // Don't render anything until we know auth state
  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: 'linear-gradient(135deg, #fceabb, #f8b500)' }}>
        <img src="/dragon.png" alt="App Logo" style={{ width: 100, height: 100, animation: 'bounce 1.5s ease-in-out infinite' }} />
        <p style={{ marginTop: 12, fontSize: '1.1rem', fontWeight: 500, color: '#333', fontFamily: "'Comic Neue', cursive" }}>Loading your magical adventure board...</p>
        <style>{`@keyframes bounce {0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}`}</style>
      </div>
    );
  }

  if (!user) return <LoginPage login={login} />;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fade-in" style={{ margin: 0, padding: 0, boxSizing: 'border-box' }}>
      {/* header area --- use isBoardPage computed above */}
      {!isBoardPage && (
        <div style={{ backgroundColor: '#1b999fff', padding: '12px 0', display: 'flex', alignItems: 'center', gap: '12px', position: 'fixed', left: 0, right: 0, top: 0, height: '45px', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
          <button onClick={() => setSidebarVisible(true)} style={{ color: '#222', fontSize: '24px', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '-12px' }}>☰</button>
          
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', flexGrow: 1 }}>
            <h2 style={{ margin: 0, fontFamily: "'Pacifico', ", fontSize: '1.8rem', color: '#151616ff' }}>PixPick</h2>
          </Link>

          {/* Notifications bell */}
          <div ref={notifRefDom} style={{ position: 'relative', marginRight: 8 }}>
            <button
              aria-label="Notifications"
              onClick={() => setNotifOpen((s) => !s)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, position: 'relative', outline: 'none' }}
            >
              <img src={bellicon} alt="Notifications" style={{ width: 20, height: 20, filter: notifOpen ? 'brightness(0.8)' : 'none', transition: 'filter 0.2s ease, transform 0.2s ease', transform: notifOpen ? 'scale(1.1)' : 'scale(1)' }} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, background: '#ff4d4f', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, padding: '0 5px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transformOrigin: 'center', animation: desktopNotif ? 'notif-badge 700ms ease' : undefined }}>{unreadCount}</span>
              )}
            </button>

            {/* polished notifications dropdown */}
            {notifOpen && ( 
              <>
                {/* inline keyframes + custom scrollbar so no external CSS file needed */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes dropdown-fade-slide { from { opacity: 0; transform: translateY(-6px) scale(.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
                  @keyframes accent-pulse { 0% { transform: scaleY(1); opacity: 1 } 40% { transform: scaleY(1.25); opacity: 1 } 100% { transform: scaleY(1); opacity: 1 } }
                  /* thin custom scrollbar */
                  .pp-notif-list::-webkit-scrollbar { width: 8px; }
                  .pp-notif-list::-webkit-scrollbar-track { background: transparent; }
                  .pp-notif-list::-webkit-scrollbar-thumb { background: rgba(10,10,12,0.12); border-radius: 8px; }
                ` }} />

                <div
                  role="menu"
                  aria-label="Notifications"
                  style={{
                    position: "absolute",
                    right: 0,
                    left: -230,
                    top: "36px",
                    width: 320,
                    maxWidth: "calc(100vw - 32px)",
                    background: "linear-gradient(135deg, rgba(190,223,224,1) 0%, rgba(217,238,241,0.9) 50%, rgba(255,255,255,0.98) 100%)",
                    borderRadius: 10,
                    boxShadow: "0 18px 40px rgba(6,12,20,0.18)",
                    zIndex: 200,
                    padding: 8,
                    transformOrigin: "top right",
                    animation: "dropdown-fade-slide 220ms cubic-bezier(.2,.9,.2,1)",
                  }}
                >
                  {/* header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <strong style={{ fontSize: 15, letterSpacing: "-0.2px", color: "#05333a" }}>Notifications</strong>
                      <span style={{ fontSize: 12, color: "#0b6b7a", background: "rgba(255,255,255,0.5)", padding: "4px 8px", borderRadius: 999 }}>{notifications.filter(n => !n.read).length} new</span>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {navigate("/notifications"); setNotifOpen(false);}}
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, color: "#074a52", fontWeight: 600, borderRadius: 8 }}
                        title="View all notifications"
                      >
                        View all
                      </button>
                    </div>
                  </div>

                  {/* list */}
                  <div className="pp-notif-list" style={{ maxHeight: 300, overflowY: "auto", padding: "6px" }}>
                    {notifications.length === 0 && (
                      <div style={{ padding: 12, color: "#4b5563", borderRadius: 8, textAlign: "center", background: "linear-gradient(180deg,#fff,#f6fbff)" }}>
                        No notifications
                      </div>
                    )}

                    {notifications.slice(0, 12).map((n) => {
                      // friendly relative time formatter
                    const timeStr = (n.createdAt && n.createdAt.seconds)
                      ? (() => {
                          const ms = n.createdAt.seconds * 1000;
                          const diffMinutes = Math.floor((Date.now() - ms) / 60000);

                          if (diffMinutes < 1) return "just now";
                          if (diffMinutes < 60) return `${diffMinutes}m`;

                          const diffHours = Math.floor(diffMinutes / 60);
                          if (diffHours < 24) return `${diffHours}h`;

                          const diffDays = Math.floor(diffHours / 24);
                          if (diffDays < 7) return `${diffDays}d`;

                          const diffWeeks = Math.floor(diffDays / 7);
                          if (diffWeeks < 4) return `${diffWeeks}w`;

                          const diffMonths = Math.floor(diffDays / 30);
                          if (diffMonths < 12) return `${diffMonths}mo`;

                          const diffYears = Math.floor(diffDays / 365);
                          return `${diffYears}y`;
                        })()
                      : "";

                      const isUnread = !n.read;

                      return (
                        <div
                          key={n.id}
                          role="menuitem"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") handleOpenNotification(n); }}
                          onClick={() => handleOpenNotification(n)}
                          style={{
                            display: "flex",
                            gap: 10,
                            padding: 10,
                            borderRadius: 8,
                            alignItems: "flex-start",
                            marginBottom: 6,
                            cursor: "pointer",
                            background: isUnread ? "linear-gradient(90deg, rgba(240,251,255,1), rgba(255,255,255,0.98))" : "transparent",
                            border: isUnread ? "1px solid rgba(11,107,122,0.06)" : "1px solid rgba(6,8,10,0.02)",
                            boxShadow: isUnread ? "0 8px 20px rgba(8,12,16,0.04)" : "none",
                            transition: "transform 140ms ease, box-shadow 140ms ease, background 140ms ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(8,12,16,0.06)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                        >
                          {/* left accent + avatar placeholder */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <div
                              aria-hidden
                              style={{
                                width: 8,
                                height: 52,
                                borderRadius: 6,
                                background: isUnread ? "linear-gradient(180deg,#1B99BF,#EE6C4D)" : "linear-gradient(180deg,#dfeff1,#ebf6f8)",
                                boxShadow: isUnread ? "0 8px 20px rgba(27,153,159,0.12)" : "none",
                                ...(isUnread ? { animation: "accent-pulse 900ms ease-in-out 1" } : {}),
                                flexShrink: 0
                              }}
                            />
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)", display: "none" }} />
                          </div>

                          {/* content */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#042b2f" }}>{(n.type || "Activity").replace(/_/g, " ")}</div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>{timeStr}</div>
                              </div>
                            </div>

                            <div style={{ marginTop: 6, fontSize: 13, color: "#0f1724" }}>
                              {n.text}
                            </div>
                          </div>

                          {/* actions */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenNotification(n); }}
                              style={{ border: "none", background: "transparent", color: "#075b63", cursor: "pointer", padding: "6px 8px", borderRadius: 8 }}
                            >
                              Open
                            </button>

                            {!n.read && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markNotificationRead(n); }}
                                style={{
                                  border: "none",
                                  background: "linear-gradient(90deg,#1B99BF,#2B5FA8)",
                                  color: "#fff",
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontWeight: 700,
                                  fontSize: 13
                                }}
                              >
                                Mark
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Profile avatar replaces the logout button */}
          <div ref={profileRef} style={{ position: 'relative', marginRight: '12px' }}>
            <button
              aria-label="Profile menu"
              onClick={() => setProfileMenuOpen((s) => !s)}
              style={{ background: 'transparent', border: 'none',outline: 'none', padding: 4, cursor: 'pointer', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img
                src={user.photoURL || '/default-avatar.png'}
                alt={user.displayName || 'Profile'}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.35)', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
              />
            </button>

            {profileMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '46px', width: 200, background: '#fff', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: 12, zIndex: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <img src={user.photoURL || '/default-avatar.png'} alt="" style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{user.displayName}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{user.email}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f1f1', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'center' }}>
                  {/* The Logout button uses the same styling as before */}
                  <button
                    onClick={logout}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ee6c4d',
                      color: '#333',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      transition: 'all 0.25s ease',
                      fontWeight: '500',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f77b7b';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9a2a2';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

{/* inline keyframes for toast animation + optional small style block */}
<style dangerouslySetInnerHTML={{
  __html: `
    @keyframes desktop-toast-in { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes desktop-toast-out { from { opacity: 1; } to { opacity: 0; transform: translateY(-6px) scale(.99); } }
  `
}} />

{/* Desktop ephemeral notification toast (top-right of header) */}
{desktopNotif && (
  <div
    aria-live="polite"
    style={{
      position: "fixed",
      top: 64,
      right: 20,
      zIndex: 300,
      pointerEvents: "auto",
      animation: "desktop-toast-in 300ms cubic-bezier(.2,.9,.2,1) forwards",
    }}
  >
    <div
      style={{
        backdropFilter: "blur(12px) saturate(1.05)",
        WebkitBackdropFilter: "blur(12px) saturate(1.05)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(250,252,253,0.56))",
        borderRadius: 14,
        padding: "12px 14px",
        boxShadow: "0 14px 44px rgba(6,12,20,0.18)",
        minWidth: 300,
        display: "flex",
        gap: 12,
        alignItems: "center",
        border: "1px solid rgba(255,255,255,0.32)",
      }}
    >
      {/* Avatar: use actorPhoto if present, else fallback initial tile */}
      {desktopNotif.actorPhoto ? (
        <img
          src={desktopNotif.actorPhoto}
          alt={desktopNotif.actorName || desktopNotif.title || "user"}
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            objectFit: "cover",
            display: "block",
            flexShrink: 0,
            boxShadow: "0 6px 18px rgba(6,12,16,0.08)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
          onError={(e) => {
            // fallback to initial tile if image fails to load
            e.currentTarget.style.display = "none";
            // show fallback initial by forcing update to include no actorPhoto
            setDesktopNotif((prev) => (prev ? { ...prev, actorPhoto: "" } : prev));
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "linear-gradient(135deg,#e6f7ff,#f3fbff)",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            color: "#1b6f86",
            fontSize: 18,
            flexShrink: 0,
            boxShadow: "0 6px 18px rgba(6,12,16,0.06)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        >
          {desktopNotif.actorName?.charAt(0) || desktopNotif.title?.charAt(0) || "A"}
        </div>
      )}

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: "#052b2f", fontSize: 15, lineHeight: 1 }}>
          {desktopNotif.title}
        </div>
        <div style={{ marginTop: 6, color: "rgba(6,12,16,0.78)", fontSize: 13, lineHeight: 1.35 }}>
          {desktopNotif.text}
        </div>
      </div>

      {/* actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => {
            const n = notifications.find((x) => x.id === desktopNotif.id);
            if (n) handleOpenNotification(n);
            setDesktopNotif(null);
            if (desktopTimerRef.current) { clearTimeout(desktopTimerRef.current); desktopTimerRef.current = null; }
          }}
          style={{
            border: "none",
            background: "linear-gradient(90deg,#1B99BF,#2B5FA8)",
            color: "#fff",
            padding: "8px 10px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            boxShadow: "0 8px 22px rgba(27,153,159,0.12)",
          }}
        >
          Open
        </button>

        <button
          onClick={() => {
            setDesktopNotif(null);
            if (desktopTimerRef.current) { clearTimeout(desktopTimerRef.current); desktopTimerRef.current = null; }
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "rgba(6,12,16,0.6)",
            cursor: "pointer",
            fontSize: 13,
            padding: "4px 6px",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
)}


      {/* Sidebar Modal Overlay */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: sidebarVisible ? 'rgba(0,0,0,0.3)' : 'transparent', pointerEvents: sidebarVisible ? 'auto' : 'none', transition: 'background-color 0.3s ease', zIndex: 100 }} onClick={() => setSidebarVisible(false)}>
        <div style={{ width: '250px', height: '100%', background: '#f5f5f5', padding: '0.2rem', boxSizing: 'border-box', boxShadow: '2px 0 6px rgba(0,0,0,0.2)', transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease', position: 'absolute', left: 0, top: 0, backgroundColor: '#e3f2fd', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Sidebar selected={selected} width={250} setSelected={(s) => { setSelected(s); setSidebarVisible(false); navigate('/'); }} setSidebarVisible={setSidebarVisible} user={user} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: isBoardPage? '0rem': '0.8rem', marginTop: isBoardPage ? '0px' : 'calc(60px + 12px)', transition: 'margin-top 0.3s ease' ,
        background:'linear-gradient(90deg,rgba(162, 161, 166, 1) 0%, rgba(201, 211, 212, 1) 55%, rgba(145, 162, 163, 1) 100%)'}}>
          {/* Note: render main routes using backgroundLocation OR the current location.
            That way, when backgroundLocation exists, the router will render the background
            (BoardList) while we render the modal below for the current location. */}
        <Routes location={backgroundLocation || location}>
          <Route path="/" element={
            <>
              {/* your home: board list */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <CreateBoardModal user={user} onCreate={() => {}} />
              </div>
              <BoardList user={user} selected={selected} setSelected={setSelected} boardsCache={boardsCache} setBoardsCache={setBoardsCache}/>
            </>
          } />

          {/* When visited directly (no background), this will render full-page */}
          <Route path="/board/:id" element={<BoardPage user={user} />} />
          <Route path="/notifications" element={<NotificationsPage user={user} />} />
          <Route path="/friends" element={<Friends user={user} />} />
        </Routes>

        {/* If there *is* a backgroundLocation, render the modal route on top */}
        {backgroundLocation && (
          <Routes>
            <Route path="/board/:id" element={
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,                // top:0; right:0; bottom:0; left:0;
                  zIndex: 1200,
                  background: 'rgba(0,0,0,0.36)', // dim the background
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  paddingTop: 0,
                }}
                onClick={(e) => {
                  // clicking the overlay (outside the modal box) should close modal
                  // but let clicks inside BoardPage propagate (BoardPage has its own layout)
                  if (e.target === e.currentTarget) navigate(-1);
                }}
              >
                <div
                  style={{
                    width: '100vw',
                    height: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    overflow: 'auto',
                    background: 'transparent', // keep BoardPage control its background so it matches full-screen look
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* BoardPage expects to be full-screen — render it directly */}
                  <BoardPage user={user} />
                </div>
              </div>
            }/>
          </Routes>
        )}
      </div>

      <style>{`
        @keyframes notif-badge { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
        @keyframes desktop-toast-in { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bell-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.08) rotate(-6deg); } 70% { transform: scale(1.02) rotate(4deg); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
