// ======= Sidebar.jsx (updated to include Notifications) =======
import { useNavigate, Link } from 'react-router-dom';
import homeicon from '../assets/home.png';
import sharedicon from '../assets/people_10498917.png';
import allboardsicon from '../assets/cover_16398103.png';
import bellicon from '../assets/bell.png';

export default function Sidebar({ selected, setSelected, setSidebarVisible, user }) {
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
    'Notifications': bellicon,
  };
  const iconStyle = {
    width: '20px',
    height: '20px',
    marginRight: '8px',
    verticalAlign: 'middle',
  };

  return (
    <div>
      {/* SIDEBAR HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #ccc' }}>
        <img src={user.photoURL} alt="Profile" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <div style={{ fontWeight: 'bold' }}>{user.displayName}</div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>{user.email}</div>
        </div>
      </div>

      {tabs.map((tab) => (
        <div key={tab} onClick={() => handleTabClick(tab)} style={{ padding: '0.5rem', cursor: 'pointer', background: selected === tab ? '#39548a' : 'transparent', borderRadius: '6px', marginBottom: '0.5rem', marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: selected === tab ? 'bold' : 'normal', color: selected === tab ? '#faf3f3a1' : '#000' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={iconMap[tab]} alt={`${tab} Icon`} style={iconStyle} /> {tab}
          </div>
        </div>
      ))}

      {/* Notifications link */}
      <div onClick={() => { setSidebarVisible(false); navigate('/notifications'); }} style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: '6px', marginTop: '0.2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={bellicon} alt="Notifications" style={iconStyle} /> Notifications
      </div>
    </div>
  );
}
