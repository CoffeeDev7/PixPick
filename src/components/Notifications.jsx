// Notifications.jsx — full page view for notifications (deep-link handling + mark read)
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  async function markAllRead() {
    try {
      await Promise.all(notifications.filter(n => !n.read).map(n => updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true })));
    } catch (err) {
      console.error('markAllRead error', err);
    }
  }

  async function openNotification(n) {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    } catch (err) {
      console.error('mark read error', err);
    }

    if (n.url) navigate(n.url);
    else if (n.boardId) navigate(`/board/${n.boardId}`);
    else return;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Notifications</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={markAllRead} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#2b5fa8', color: '#fff', cursor: 'pointer' }}>Mark all read</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {notifications.length === 0 ? (
          <div style={{ color: '#666' }}>No notifications</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} style={{ padding: 12, borderRadius: 8, marginBottom: 8, background: n.read ? '#fff' : 'linear-gradient(90deg,#f0fbff,#ffffff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openNotification(n)}>
                <div style={{ fontWeight: 700 }}>{n.type?.replace('_', ' ') || 'Activity'}</div>
                <div style={{ marginTop: 6 }}>{n.text}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{(n.createdAt && n.createdAt.seconds) ? (() => { const ms = n.createdAt.seconds * 1000; const diff = Math.round((Date.now() - ms) / 60000); return diff < 60 ? `${diff}m` : `${Math.round(diff / 60)}h`; })() : ''}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!n.read && <button onClick={() => openNotification(n)} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#2b5fa8', color: '#fff', cursor: 'pointer' }}>Open</button>}
                <button onClick={async () => { try { await updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }); } catch (err) { console.error(err); } }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #eee', background: 'transparent', cursor: 'pointer' }}>{n.read ? 'Read' : 'Mark'}</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
