// app/login/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth"; // Import useAuth
import { useRouter } from "next/navigation"; // Import useRouter

export default function LoginPage() {
  const { user, loading, loginWithGoogle } = useAuth(); // Get user, loading, loginWithGoogle
  const router = useRouter();

  // Redirect if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/'); // Redirect to homepage or profile page if already logged in
    }
  }, [user, loading, router]); // Re-run when user or loading state changes

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 text-gray-700">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-blue-500 border-gray-200 mr-3"></div>
        <p>Loading user status...</p>
      </div>
    );
  }

  // If not logged in, show the login button
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-rose-700 mb-8">Welcome to Mshikaki Events!</h1>
      <p className="text-lg text-gray-700 mb-6 text-center">Sign in to discover and create events.</p>

      <button
        onClick={loginWithGoogle} // This calls the actual sign-in function
        className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl shadow-lg transition-all duration-200 text-lg"
      >
        <img src="/google-logo.png" alt="Google" className="w-6 h-6 mr-3" /> {/* Ensure google-logo.png is in your public folder */}
        Sign In with Google
      </button>

      <p className="text-sm text-gray-500 mt-6 text-center max-w-sm">
        By signing in, you agree to our terms of service and privacy policy.
      </p>
    </div>
  );
}
