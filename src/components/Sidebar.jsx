// Sidebar.jsx — accepts width, onSearch, onCreateClick
import { useNavigate } from 'react-router-dom';
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';
import allboardsicon from '../assets/cover_16398103.png';
import bellicon from '../assets/bell.png';

export default function Sidebar({
  selected,
  setSelected,
  setSidebarVisible,
  user,
  width, // default width (change easily from parent)
  onSearch, // optional callback: (query) => {}
  onCreateClick, // optional callback: () => {}
}) {
  const tabs = ['My Boards', 'Shared with Me', 'All Boards'];
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    setSelected(tab);
    navigate('/');
    setSidebarVisible(false);
  };

  const iconMap = {
    'My Boards': homeicon,
    'Shared with Me': sharedicon,
    'All Boards': allboardsicon,
    Notifications: bellicon,
  };

  const ACCENT = '#1b999f';
  const ACCENT_DARK = '#16686e';
  const BG = '#f6fbfc';
  const CARD_BG = '#ffffff';
  const TEXT = '#1f2933';

  const initials = (name = '') =>
    (name.split(' ').map((s) => s[0]).slice(0, 2).join('') || 'U').toUpperCase();

  return (
    <div style={{ padding: 16, width: width, boxSizing: 'border-box', height: '100%' }}>
      {/* Profile card */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 6, borderRadius: 16, background: CARD_BG, boxShadow: '0 6px 20px rgba(20,40,60,0.06)', marginBottom: 18 }}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || 'User'} style={{ width: 56, height: 56, borderRadius: 32, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 12, background: '#e6f7f6', color: ACCENT_DARK, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>
            {initials(user?.displayName)}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: TEXT, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName || 'Unnamed'}</div>
          <div style={{ fontSize: 13, color: '#56616a', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        </div>
      </div>

      {/* Search + create */}
      {/* <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
        <input
          aria-label="Search boards"
          placeholder="Search boards"
          onChange={(e) => {
            if (typeof onSearch === 'function') onSearch(e.target.value);
          }}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(20,40,60,0.06)', background: BG, outline: 'none', fontSize: 14, color: TEXT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        />
        <button
          title="Create"
          onClick={() => {
            if (typeof onCreateClick === 'function') {
              onCreateClick();
            } else {
              // fallback: navigate to root where the CreateBoardModal is present
              navigate('/');
            }
            setSidebarVisible(false);
          }}
          style={{ background: ACCENT, border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 80, cursor: 'pointer', boxShadow: '0 6px 18px rgba(27,153,159,0.18)' }}
        >
          +
        </button>
      </div> */}

      {/* Tabs */}
      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tabs.map((tab) => {
          const isActive = selected === tab;
          return (
            <div key={tab} role="button" tabIndex={0} aria-current={isActive ? 'page' : undefined} onClick={() => handleTabClick(tab)} onKeyDown={(e) => (e.key === 'Enter' ? handleTabClick(tab) : null)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: isActive ? `linear-gradient(90deg, ${ACCENT}15, ${ACCENT}08)` : 'transparent', boxShadow: isActive ? 'inset 0 0 0 1px rgba(27,153,159,0.06)' : 'none', transition: 'all 160ms ease' }}>
              <img src={iconMap[tab]} alt="" style={{ width: 20, height: 20 }} />
              <div style={{ fontSize: 15, color: isActive ? ACCENT_DARK : TEXT, fontWeight: isActive ? 700 : 500 }}>{tab}</div>
            </div>
          );
        })}
      </nav>

      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(0,0,0,0.03), rgba(0,0,0,0))', margin: '16px 0' }} />

      {/* Notifications link */}
      <div role="button" tabIndex={0} onClick={() => { setSidebarVisible(false); navigate('/notifications'); }} onKeyDown={(e) => (e.key === 'Enter' ? (setSidebarVisible(false), navigate('/notifications')) : null)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'background 160ms ease, transform 160ms ease' }}>
        <div style={{ position: 'relative' }}>
          <img src={bellicon} alt="Notifications" style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>Notifications</div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#8b98a1' }}>Recent</div>
      </div>

      <div style={{ marginTop: 22, fontSize: 13, color: '#73808a' }}>
        <div style={{ marginBottom: 8 }}>Workspace</div>
        <div style={{ fontSize: 12, color: '#97a3aa' }}>Manage boards, shares and notifications here.</div>
      </div>
    </div>
  );
}
