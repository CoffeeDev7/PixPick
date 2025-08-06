import { Link, Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BoardList from './components/BoardList';
import CreateBoardModal from './components/CreateBoardModal';
import BoardPage from './components/BoardPage';
import { auth, provider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';


export default function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState("My Boards");
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  if (!user) return <LoginPage login={login}/>

  return (
    <div style={{ margin: 0, padding: 0, bordersizing: "border-box" }}>
      {/* TOP GRAY HEADER */}
      <div
        style={{
          backgroundColor: "#42a5f5",
          padding: "12px 0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          height: "60px",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setSidebarVisible(true)}
          style={{
            fontSize: "24px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            marginLeft: "-12px",
          }}
        >
          ☰
        </button>

        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "inherit",
            flexGrow: 1,
          }}
        >
          <h2 style={{ margin: 0 }}>PixPick</h2>
        </Link>

        <button
          onClick={logout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f9a2a2ff", // light grey
            color: "#333",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            marginRight: "12px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#d5d5d5")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#e0e0e0")
          }
        >
          Logout
        </button>
      </div>

      {/* Sidebar Modal Overlay */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: sidebarVisible ? "rgba(0,0,0,0.3)" : "transparent",
          pointerEvents: sidebarVisible ? "auto" : "none",
          transition: "background-color 0.3s ease",
          zIndex: 100,
        }}
        onClick={() => setSidebarVisible(false)}
      >
        <div
          
          style={{
            width: "260px", // THIS IS THE WIDTH OF THE SIDEBAR
            height: "100%",
            background: "#f5f5f5",
            padding: "1rem",
            boxSizing: "border-box",
            boxShadow: "2px 0 6px rgba(0,0,0,0.2)",
            transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
            position: "absolute",
            left: 0,
            top: 0,
            backgroundColor: "#e3f2fd",
            overflow: "hidden", // ✅ hide inner overflow
            whiteSpace: "nowrap", // ✅ prevent line breaking
          }}
        >
          <Sidebar
            selected={selected}
            setSelected={setSelected}
            setSidebarVisible={setSidebarVisible}
            user={user}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: "2rem", marginTop: "60px" }}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                {/* <h3>
                  Welcome, {user.displayName}, to PixPick{" "}
                  <strong>{user.uid}</strong>
                </h3>
                <h4>{user.email}</h4> */}
                <h2>{selected}</h2>
                <CreateBoardModal user={user} onCreate={() => {}} />
                <BoardList user={user} selected={selected} />
              </>
            }
          />
          <Route path="/board/:id" element={<BoardPage user={user} />} />
        </Routes>
      </div>
    </div>
  );
}
