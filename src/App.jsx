import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BoardList from './components/BoardList';
import CreateBoardModal from './components/CreateBoardModal';
import BoardPage from './components/BoardPage';
import { auth, provider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';


export default function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState("My Boards");
  const [sidebarVisible, setSidebarVisible] = useState(false);
   const location = useLocation();
  const isBoardPage = location.pathname.startsWith("/board/");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  async function login() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  }, { merge: true }); // merge:true so we don't overwrite if already exists
}
  //const login = () => signInWithPopup(auth, provider);
  const navigate = useNavigate();
  //also come out of board when logged out
  const logout = async () => {
  try {
    await signOut(auth);
    navigate("/");
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

  if (!user) return <LoginPage login={login}/>

 

  return (
    <div style={{ margin: 0, padding: 0, bordersizing: "border-box" }}>
      {/* TOP BLUE HEADER */}
      {!isBoardPage && (
        <div
          style={{
            backgroundColor: "#4facfe",
            padding: "12px 0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            height: "45px",
            zIndex: 10,
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)", // soft shadow
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
            <h2
              style={{
                margin: 0,
                fontFamily: "'Pacifico', cursive",
                fontSize: "1.8rem",
                color: "#151616ff",
              }}
            >
              PixPick
            </h2>
          </Link>

          <button
  onClick={logout}
  style={{
    padding: "8px 16px",
    backgroundColor: "#f9a2a2", // soft red-pink tone
    color: "#333",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    marginRight: "12px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    transition: "all 0.25s ease",
    fontWeight: "500",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = "#f77b7b"; // deeper pink-red
    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    e.currentTarget.style.transform = "translateY(-2px)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = "#f9a2a2";
    e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    e.currentTarget.style.transform = "translateY(0)";
  }}
>
  Logout
</button>

        </div>
      )}

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
      <div
        style={{
          padding: "0.6rem",
          marginTop: isBoardPage ? "0px" : "calc(60px + 12px)", // header height + extra space
          transition: "margin-top 0.3s ease",
        }}
      >
        <Routes>
          <Route
            path="/"
            element={
              <>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <h2 style={{ margin: 0, marginLeft: "12px" }}>{selected}</h2>
                  <CreateBoardModal user={user} onCreate={() => {}} />
                </div>
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
