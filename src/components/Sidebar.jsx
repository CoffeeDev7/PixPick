import { useNavigate } from "react-router-dom";

export default function Sidebar({ selected, setSelected, setSidebarVisible }) {
  const tabs = ["My Boards", "Shared with Me", "All Boards"];
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    setSelected(tab);
    navigate('/');
    setSidebarVisible(false);
  }

  

  return (
    <div style={{ marginTop: '60px'}}>
      {tabs.map(tab => (
        <div
          key={tab}
          style={{
            padding: '0.5rem',
            cursor: 'pointer',
            background: selected === tab ? '#bbdefb' : 'transparent',
            borderRadius: '6px',
            marginBottom: '0.5rem',
            marginTop: '0.5rem',
            fontSize: '1.1rem',
            fontWeight: selected === tab ? 'bold' : 'normal',
            // color: selected === tab ? '#0d47a1' : '#000',
            // transition: 'background-color 0.3s ease, color 0.3s ease'
          }}
          onClick={() => handleTabClick(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
