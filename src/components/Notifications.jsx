// ======= Notifications.jsx (new component) =======
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function NotificationsPage({ user }) {
  const [notifications, setNotifications] = useState([]);

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
            <div key={n.id} style={{ padding: 12, borderRadius: 8, marginBottom: 8, background: n.read ? '#fff' : 'linear-gradient(90deg,#f0fbff,#ffffff)' }}>
              <div style={{ fontWeight: 700 }}>{n.type?.replace('_', ' ') || 'Activity'}</div>
              <div style={{ marginTop: 6 }}>{n.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
