// Sidebar.jsx — accepts width, onSearch, onCreateClick
import { useNavigate } from 'react-router-dom';
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';
import bellicon from '../assets/bell.png';
import friendsicon from '../assets/add-friend.png'; // 👉 add a simple icon (or use any placeholder)

export default function Sidebar({
  selected,
  setSelected,
  setSidebarVisible,
  user,
  width,
}) {
  const tabs = ['My Boards', 'Shared with Me'];
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    setSelected(tab);
    navigate('/');
    setSidebarVisible(false);
  };

  const iconMap = {
    'My Boards': homeicon,
    'Shared with Me': sharedicon,
    Notifications: bellicon,
    Friends: friendsicon,
  };

  const ACCENT = '#1b999f';
  const ACCENT_DARK = '#16686e';
  const BG = '#f6fbfc';
  const CARD_BG = 'rgba(255,255,255,0.75)';
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
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: 10,
          borderRadius: 16,
          background: CARD_BG,
          border: `1px solid rgba(27,153,159,0.2)`,
          boxShadow: '0 8px 24px rgba(20,40,60,0.08)',
          marginBottom: 20,
          transition: 'transform 200ms ease, box-shadow 200ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow =
            '0 12px 32px rgba(20,40,60,0.12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow =
            '0 8px 24px rgba(20,40,60,0.08)';
        }}
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              objectFit: 'cover',
              flexShrink: 0,
              border: `2px solid ${ACCENT}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT}10)`,
              color: ACCENT_DARK,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 18,
              border: `2px solid ${ACCENT}40`,
            }}
          >
            {initials(user?.displayName)}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: TEXT,
              fontSize: 15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.displayName || 'Unnamed'}
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#56616a',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav
        aria-label="Main"
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {tabs.map((tab) => {
          const isActive = selected === tab;
          return (
            <div
              key={tab}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'page' : undefined}
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

      <div
        style={{
          height: 1,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.03), rgba(0,0,0,0))',
          margin: '16px 0',
        }}
      />

      {/* Notifications link */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setSidebarVisible(false);
          navigate('/notifications');
        }}
        onKeyDown={(e) =>
          e.key === 'Enter'
            ? (setSidebarVisible(false), navigate('/notifications'))
            : null
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'background 160ms ease, transform 160ms ease',
        }}
      >
        <img src={bellicon} alt="Notifications" style={{ width: 22, height: 22 }} />
        <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>
          Notifications
        </div>
        
      </div>

      {/* Friends link */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setSidebarVisible(false);
          navigate('/friends');
        }}
        onKeyDown={(e) =>
          e.key === 'Enter'
            ? (setSidebarVisible(false), navigate('/friends'))
            : null
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          marginTop: 10,
          transition: 'background 160ms ease, transform 160ms ease',
        }}
      >
        <img src={friendsicon} alt="Friends" style={{ width: 22, height: 22 }} />
        <div style={{ fontSize: 15, color: TEXT, fontWeight: 600 }}>
          Friends
        </div>
      </div>
    </div>
  );
}
