// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence, // fallback only
} from "firebase/firestore";

/**
 * Client Firebase config — safe to be public (browser SDK)
 */
const firebaseConfig = {
  apiKey: "AIzaSyDUU3QWCsI2yDgtI4mksCYggAYn4Xv3Gjg",
  authDomain: "pixpick-588e4.firebaseapp.com",
  projectId: "pixpick-588e4",
  storageBucket: "pixpick-588e4.firebasestorage.app",
  messagingSenderId: "110130856294",
  appId: "1:110130856294:web:ccf51d13bf50c38c1788a7",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Auth exports
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Create a single db binding and export it once
let db;

if (typeof window === "undefined") {
  // SSR / non-browser environment — just create Firestore without persistence
  db = getFirestore(app);
} else {
  try {
    // Preferred (newer API): persistent local cache with multi-tab support
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: 50 * 1024 * 1024, // 50MB
      }),
    });
    // optional dev log
    // console.log("Firestore initialized with persistentLocalCache.");
  } catch (err) {
    // Fallback path: initialize plain Firestore and attempt enableIndexedDbPersistence (older API)
    console.warn(
      "persistentLocalCache init failed, falling back to getFirestore(). Attempting enableIndexedDbPersistence() —",
      err?.message || err
    );
    db = getFirestore(app);

    try {
      // enableIndexedDbPersistence may not exist in some builds — best-effort
      enableIndexedDbPersistence(db).catch((pErr) => {
        if (pErr?.code === "failed-precondition") {
          console.warn("enableIndexedDbPersistence failed: multiple tabs open.");
        } else if (pErr?.code === "unimplemented") {
          console.warn("enableIndexedDbPersistence not supported by this browser.");
        } else {
          console.warn("enableIndexedDbPersistence error:", pErr);
        }
      });
    } catch (e) {
      console.warn("enableIndexedDbPersistence() not available in this SDK build.", e);
    }
  }
}

// single named export for db (no redeclaration)
export { db };
