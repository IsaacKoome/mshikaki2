// components/GlobalNavbar.tsx
"use client"; // <<< ADD THIS LINE!

import Link from 'next/link';
import { useAuth } from '@/lib/auth'; // Import useAuth

export default function GlobalNavbar() {
  const { user, loading, logout } = useAuth(); // Now this hook call is valid

  return (
    <nav className="bg-rose-700 p-4 text-white">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          Mshikaki Events
        </Link>
        <div>
          <Link href="/explore" className="ml-4 hover:underline">
            Explore Users
          </Link>

          {user && (
            <>
              <Link href={`/profile/${user.uid}`} className="ml-4 hover:underline">
                MY PROFILE
              </Link>
              <button onClick={logout} className="ml-4 px-3 py-1 bg-red-500 rounded hover:bg-red-600">
                Logout
              </button>
            </>
          )}
          {!user && !loading && (
            <Link href="/login" className="ml-4 px-3 py-1 bg-green-500 rounded hover:bg-green-600">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}