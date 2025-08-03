import { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { Routes, Route, useNavigate } from 'react-router-dom';

import Sidebar from "./components/Sidebar";
import CreateBoardModal from "./components/CreateBoardModal";
import BoardList from "./components/BoardList";
import BoardPage from "./components/BoardPage";

function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState("My Boards");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  if (!user) return <div style={{ padding: '2rem' }}><button onClick={login}>Login with Google</button></div>;


  return (
    <div style={{ display: "flex" }}>
      <Sidebar selected={selected} setSelected={setSelected} />
      <div style={{ flexGrow: 1, padding: "2rem" }}>
        <Routes>
          <Route path="/" element={
            <>
              <p>👋 Welcome, {user.displayName}, {user.email}</p>
              <p>user id: <strong>{user.uid}</strong></p>
              {console.log("User:", user, "User ID:", user.uid)}
              <button onClick={logout}>Logout</button>

              <h2>{selected}</h2>
              <CreateBoardModal user={user} onCreate={() => {}} />
              <BoardList user={user} selected={selected} />
              {/* Render the board list based on the selected tab */}
              {/* This will show "My Boards", "Shared with Me", or "All Boards" */}

              {/* Later we'll render BoardList here based on selected */}
            </>}/>
          <Route path="/board/:id" element={<BoardPage user={user} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
