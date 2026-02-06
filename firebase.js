// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 PASTE YOUR FIREBASE CONFIG BELOW
const firebaseConfig = {
  apiKey: "AIzaSyBvRfsdCyYXjmzNE15Rjy57fHI-j-yndvs",
  authDomain: "dudu-valentine.firebaseapp.com",
  projectId: "dudu-valentine",
  storageBucket: "dudu-valentine.firebasestorage.app",
  messagingSenderId: "593234344111",
  appId: "1:593234344111:web:dca0591f16d05e569bfc5a"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export database
export { db };
