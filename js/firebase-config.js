// ============================================
// Firebase Configuration — Angel's Reading Corner
// ============================================
// IMPORTANT: Replace the config below with your own Firebase project credentials.
// Steps:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use existing)
// 3. Add a Web App
// 4. Copy the firebaseConfig object
// 5. Enable Authentication → Google Sign-In
// 6. Create Firestore Database (start in test mode)
// 7. Enable Storage

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqYoNvtkS5w_-sxF6Lfhng9H2f41WbftI",
  authDomain: "angel-s-world.firebaseapp.com",
  projectId: "angel-s-world",
  storageBucket: "angel-s-world.firebasestorage.app",
  messagingSenderId: "445569743853",
  appId: "1:445569743853:web:2c4974e2794525321cc5e4",
  measurementId: "G-WY99J9WZHM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);
export { app, db, auth, storage, analytics };
