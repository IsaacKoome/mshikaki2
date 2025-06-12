// components/GlobalNavbar.tsx
"use client";

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function GlobalNavbar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="bg-rose-700 p-4 text-white shadow-md">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
        {/* Brand/Logo */}
        <Link href="/" className="text-3xl font-extrabold tracking-tight text-white hover:text-rose-100 transition-colors">
          Mshikaki Events
        </Link>

        {/* Navigation and Auth Actions */}
        <div className="flex flex-wrap justify-center sm:justify-end items-center gap-3">

          {/* Explore Users Button - Styled as a button */}
          <Link href="/explore" className="flex items-center bg-rose-600 hover:bg-rose-800 text-white font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200">
            <span role="img" aria-label="magnifying glass" className="mr-1">🔍</span>Explore Users
          </Link>

          {/* Conditional Auth Buttons/Links */}
          {loading ? (
            <div className="flex items-center gap-2 text-gray-300">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-gray-300 border-gray-500"></div>
              <span>Loading...</span>
            </div>
          ) : user ? (
            <>
              {/* My Profile Button - Styled as a button */}
              <Link href={`/profile/${user.uid}`} className="flex items-center bg-rose-600 hover:bg-rose-800 text-white font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200">
                <img
                  src={user.photoURL || "/default-avatar.png"}
                  alt="avatar"
                  className="w-6 h-6 rounded-full mr-2 object-cover border border-rose-300"
                />
                My Profile
              </Link>
              {/* Logout Button - Styled as a button */}
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200"
              >
                Logout
              </button>
            </>
          ) : (
            /* Login Button - correctly links to /login page */
            <Link href="/login" className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-200">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
