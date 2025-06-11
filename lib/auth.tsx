// lib/auth.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
// Changed signInWithRedirect back to signInWithPopup
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth"; // <<< CHANGED HERE
// Keep Firestore imports
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase"; // Make sure db is imported from firebase.ts

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          console.log("Creating new user profile in Firestore for UID:", firebaseUser.uid);
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || "New User",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "/default-avatar.png",
            bio: "",
            createdAt: Timestamp.now(),
            eventCount: 0,
          });
        }
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Changed back to signInWithPopup
    await signInWithPopup(auth, provider); // <<< CHANGED HERE
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}