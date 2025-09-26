// Sidebar.jsx — accepts width, onSearch, onCreateClick
import { useNavigate } from 'react-router-dom';
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';
import bellicon from '../assets/bell.png';
import friendsicon from '../assets/add-friend.png'; // 👉 add a simple icon (or use any placeholder)
import {useLocation } from 'react-router-dom';

export default function Sidebar({
  selected,
  setSelected,
  setSidebarVisible,
  user,
  width,
}) {
  // These are the ones that show up in Sidebar
  const tabs = [ 'Home', 'Notifications', 'Friends'];
  const navigate = useNavigate();
  const location = useLocation();

  const handleTabClick = (tab) => {
    setSelected(tab);
    navigate('/');
    setSidebarVisible(false);
  };

  const iconMap = {
    'My Boards': homeicon,
    'Home': homeicon,
    'Shared with Me': sharedicon,
    Notifications: bellicon,
    Friends: friendsicon,
  };

  const ACCENT = '#1b999f';
  const ACCENT_DARK = '#16686e';
  const TEXT = '#1f2933';

  const initials = (name = '') =>
    (name.split(' ').map((s) => s[0]).slice(0, 2).join('') || 'U').toUpperCase();

  return (
    <div
      style={{
        padding: 16,
        width: width,
        boxSizing: 'border-box',
        height: '100%',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Profile card */}


      {/* Tabs */}
      <nav
        aria-label="Main"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {tabs.map((tab) => {
          const isActive = (location.pathname === '/' && (tab === "Home" || tab === "My Boards"))
               || (selected === tab);
          return (
            <div
              key={tab}
              role="button"
              tabIndex={0}
              onClick={() => handleTabClick(tab)}
              onKeyDown={(e) =>
                e.key === 'Enter' ? handleTabClick(tab) : null
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: isActive
                  ? `linear-gradient(90deg, ${ACCENT}15, ${ACCENT}08)`
                  : 'transparent',
                boxShadow: isActive
                  ? 'inset 0 0 0 1px rgba(27,153,159,0.06)'
                  : 'none',
                transition: 'all 160ms ease',
              }}
            >
              <img src={iconMap[tab]} alt="" style={{ width: 20, height: 20 }} />
              <div
                style={{
                  fontSize: 15,
                  color: isActive ? ACCENT_DARK : TEXT,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {tab}
              </div>
            </div>
          );
        })}
      </nav>
      {/* Divider */}
      <div
        style={{
          height: 1,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.03), rgba(0,0,0,0))',
          margin: '16px 0',
        }}
      />

    </div>
  );
}
