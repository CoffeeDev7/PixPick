import { useNavigate } from "react-router-dom";
import homeicon from "../assets/home.png"; // Adjust the path as needed
import sharedicon from "../assets/people_10498917.png"; // Adjust the path as needed
import allboardsicon from "../assets/cover_16398103.png"; // Adjust the path as needed
export default function Sidebar({ selected, setSelected, setSidebarVisible, user }) {
  const tabs = ["My Boards", "Shared with Me", "All Boards"];
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    setSelected(tab);
    navigate('/');
    setSidebarVisible(false);
  }

  const iconMap = {
  "My Boards": homeicon,
  "Shared with Me": sharedicon,
  "All Boards": allboardsicon,
};
  const iconStyle = {
    width: "20px",
    height: "20px",
    marginRight: "8px",
    verticalAlign: "middle",
  };
  

  return (
    <div>
      {/* SIDEBAR HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid #ccc",
        }}
      >
        <img
          src={user.photoURL}
          alt="Profile"
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
        <div>
          <div style={{ fontWeight: "bold" }}>{user.displayName}</div>
          <div style={{ fontSize: "0.8rem", color: "#555" }}>{user.email}</div>
        </div>
      </div>       {/* END OF SIDEBAR HEADER */}

      {tabs.map((tab) => (
        <div
          key={tab}
          style={{
            padding: "0.5rem",
            cursor: "pointer",
            background: selected === tab ? "#39548a" : "transparent",
            borderRadius: "6px",
            marginBottom: "0.5rem",
            marginTop: "0.5rem",
            fontSize: "1.1rem",
            fontWeight: selected === tab ? "bold" : "normal",
            color: selected === tab ? '#faf3f3a1' : '#000',
            // transition: 'background-color 0.3s ease, color 0.3s ease'
          }}
          onClick={() => handleTabClick(tab)}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
           <img src={iconMap[tab]} alt={`${tab} Icon`} style={iconStyle} /> {tab}
          </div>
        </div>
      ))}
    </div>
  );
}
