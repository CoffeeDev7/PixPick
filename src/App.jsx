import { useEffect, useState } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import Sidebar from "./components/Sidebar";
import CreateBoardModal from "./components/CreateBoardModal";

function App() {
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState("My Boards");

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  if (!user) {
    return (
      <div style={{ padding: "2rem" }}>
        <button onClick={login}>Login with Google</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar selected={selected} setSelected={setSelected} />
      <div style={{ flexGrow: 1, padding: "2rem" }}>
        <p>👋 Welcome, {user.displayName}</p>
        {console.log("User:", user)}
        <button onClick={logout}>Logout</button>

        <h2>{selected}</h2>
        <CreateBoardModal user={user} onCreate={() => {}} />

        {/* Later we'll render BoardList here based on selected */}
      </div>
    </div>
  );
}

export default App;
