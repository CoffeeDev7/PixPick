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
    <div style={{ marginTop: '60px',}}>
      {tabs.map(tab => (
        <div
          key={tab}
          style={{
            padding: '0.5rem',
            cursor: 'pointer',
            background: selected === tab ? '#ddd' : 'transparent',
            borderRadius: '6px',
            marginBottom: '0.5rem',
            marginTop: '0.5rem',
          }}
          onClick={() => handleTabClick(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
