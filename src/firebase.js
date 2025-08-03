// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDUU3QWCsI2yDgtI4mksCYggAYn4Xv3Gjg",
  authDomain: "pixpick-588e4.firebaseapp.com",
  projectId: "pixpick-588e4",
  storageBucket: "pixpick-588e4.firebasestorage.app",
  messagingSenderId: "110130856294",
  appId: "1:110130856294:web:ccf51d13bf50c38c1788a7"
};

// Init Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
