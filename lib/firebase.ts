// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDamYso9BljQEDOCZdpb46h36lVoGCE2PY",
  authDomain: "mshikaki-events.firebaseapp.com",
  projectId: "mshikaki-events",
  storageBucket: "mshikaki-events.firebasestorage.app",
  messagingSenderId: "736346355846",
  appId: "1:736346355846:web:01ae5e6c3318a5b7913907"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
export const auth = getAuth(app); // ✅ Make sure this line is present