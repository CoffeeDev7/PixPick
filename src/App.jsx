// App.jsx — updated: animated desktop toast for new notifications + deep-link handling + bell pulse animation
import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BoardList from './components/BoardList';
import CreateBoardModal from './components/CreateBoardModal';
import BoardPage from './components/BoardPage';
import NotificationsPage from './components/Notifications';
import { auth, provider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState, useRef } from 'react';
import LoginPage from './components/LoginPage';
import { doc, setDoc, collection, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import bellicon from './assets/bell_552745.png';

export default function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState('My Boards');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isBoardPage = location.pathname.startsWith('/board/');
  const [authLoading, setAuthLoading] = useState(true);

  // notifications state (for top header)
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRefDom = useRef(null);

  // track previous notification IDs to detect new ones
  const prevNotifIdsRef = useRef(new Set());

  // desktop toast state (tiny ephemeral notification animation)
  const [desktopNotif, setDesktopNotif] = useState(null); // {id, title, text}
  const desktopTimerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false); // auth check is done
    });
    return () => unsubscribe();
  }, []);

  // realtime notifications listener for current user (simple, client-side)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      prevNotifIdsRef.current = new Set();
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // detect newly added notifications (ids not in prev set)
        const prevSet = prevNotifIdsRef.current;
        const newDocs = list.filter((n) => !prevSet.has(n.id));

        if (newDocs.length > 0) {
          // update prev set first for future diffs
          prevNotifIdsRef.current = new Set(list.map((n) => n.id));

          // show desktop toast for the most recent new notif that isn't from the current user
          const newest = newDocs[0];
          if (newest && newest.actor !== user.uid) {
            // ephemeral desktop toast
            setDesktopNotif({ id: newest.id, title: newest.type?.replace('_', ' ') || 'Activity', text: newest.text });
            // clear any previous timer
            if (desktopTimerRef.current) clearTimeout(desktopTimerRef.current);
            desktopTimerRef.current = setTimeout(() => setDesktopNotif(null), 5000);
          }
        } else if (prevSet.size === 0 && list.length > 0) {
          // initial load — populate prev set
          prevNotifIdsRef.current = new Set(list.map((n) => n.id));
        }

        setNotifications(list);
      },
      (err) => {
        console.error('notifications onSnapshot error', err);
      }
    );

    return () => unsub();
  }, [user]);

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
      {/* TOP Deep Teal HEADER */}
      {!isBoardPage && (
        <div style={{ backgroundColor: '#1b999fff', padding: '12px 0', display: 'flex', alignItems: 'center', gap: '12px', position: 'fixed', left: 0, right: 0, top: 0, height: '45px', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
          <button onClick={() => setSidebarVisible(true)} style={{ fontSize: '24px', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '-12px' }}>☰</button>

          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', flexGrow: 1 }}>
            <h2 style={{ margin: 0, fontFamily: "'Pacifico', cursive", fontSize: '1.8rem', color: '#151616ff' }}>PixPick</h2>
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

            {/* dropdown */}
            {notifOpen && (
              <div style={{ position: 'absolute', right: 0, top: '36px', left: '-190px', width: 320, maxWidth: 'calc(100vw - 32px)', background: '#bedfe0ff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.52)', zIndex: 200, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px' }}>
                  <strong>Notifications</strong>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => navigate('/notifications')} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>View all</button>
                  </div>
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 && <div style={{ padding: 10, color: '#666' }}>No notifications</div>}
                  {notifications.slice(0, 12).map((n) => (
                    <div key={n.id} style={{ display: 'flex', gap: 10, padding: 8, borderRadius: 6, alignItems: 'flex-start', background: n.read ? 'transparent' : 'linear-gradient(90deg,#f0fbff,#ffffff)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eee', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{n.type?.replace('_', ' ') || 'Activity'}</div>
                        <div style={{ fontSize: 13, color: '#333' }}>{n.text}</div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{(n.createdAt && n.createdAt.seconds) ? (() => { const ms = n.createdAt.seconds * 1000; const diff = Math.round((Date.now() - ms) / 60000); return diff < 60 ? `${diff}m` : `${Math.round(diff / 60)}h`; })() : ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button onClick={() => handleOpenNotification(n)} style={{ border: 'none', background: 'transparent', color: '#666', cursor: 'pointer' }}>Open</button>
                        {!n.read && <button onClick={() => markNotificationRead(n)} style={{ border: 'none', background: '#2b5fa8', color: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>Mark</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile avatar replaces the logout button */}
          <div ref={profileRef} style={{ position: 'relative', marginRight: '12px' }}>
            <button
              aria-label="Profile menu"
              onClick={() => setProfileMenuOpen((s) => !s)}
              style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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

      {/* Desktop ephemeral notification toast (bottom-right of header) */}
      {desktopNotif && (
        <div style={{ position: 'fixed', top: 56, right: 16, zIndex: 300, animation: 'desktop-toast-in 320ms ease' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', minWidth: 260, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#eef7ff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{desktopNotif.title?.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{desktopNotif.title}</div>
              <div style={{ color: '#444', marginTop: 4, fontSize: 13 }}>{desktopNotif.text}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => { /* open notification */ const n = notifications.find(x => x.id === desktopNotif.id); if (n) handleOpenNotification(n); setDesktopNotif(null); }} style={{ border: 'none', background: '#2b5fa8', color: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>Open</button>
              <button onClick={() => setDesktopNotif(null)} style={{ border: 'none', background: 'transparent', color: '#666', cursor: 'pointer' }}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Modal Overlay */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: sidebarVisible ? 'rgba(0,0,0,0.3)' : 'transparent', pointerEvents: sidebarVisible ? 'auto' : 'none', transition: 'background-color 0.3s ease', zIndex: 100 }} onClick={() => setSidebarVisible(false)}>
        <div style={{ width: '290px', height: '100%', background: '#f5f5f5', padding: '0.2rem', boxSizing: 'border-box', boxShadow: '2px 0 6px rgba(0,0,0,0.2)', transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease', position: 'absolute', left: 0, top: 0, backgroundColor: '#e3f2fd', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Sidebar selected={selected} width={280} setSelected={(s) => { setSelected(s); setSidebarVisible(false); navigate('/'); }} setSidebarVisible={setSidebarVisible} user={user} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '0.6rem', marginTop: isBoardPage ? '0px' : 'calc(60px + 12px)', transition: 'margin-top 0.3s ease' }}>
        <Routes>
          <Route path="/" element={
            <>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 style={{ margin: 0, marginLeft: '12px' }}>{selected}</h2>
                <CreateBoardModal user={user} onCreate={() => {}} />
              </div>
              <BoardList user={user} selected={selected} />
            </>
          } />
          <Route path="/board/:id" element={<BoardPage user={user} />} />
          <Route path="/notifications" element={<NotificationsPage user={user} />} />
        </Routes>
      </div>

      <style>{`
        @keyframes notif-badge { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
        @keyframes desktop-toast-in { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes bell-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.08) rotate(-6deg); } 70% { transform: scale(1.02) rotate(4deg); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
