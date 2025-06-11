// layout.tsx
import "./globals.css";
import { AuthProvider, useAuth } from "@/lib/auth"; // 👈 Import useAuth as well
import Link from 'next/link'; // 👈 Import Link from Next.js

export const metadata = {
  title: "Mshikaki App",
  description: "A colorful event and fundraising app",
};

// Define a simple Navbar component directly here
// We'll wrap this with AuthProvider to access user state
function GlobalNavbar() {
  const { user, loading, logout } = useAuth(); // Access auth state

  return (
    <nav className="bg-rose-700 p-4 text-white">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          Mshikaki Events
        </Link>
        <div>
          {/* Always show Explore Users link */}
          <Link href="/explore" className="ml-4 hover:underline">
            Explore Users
          </Link>

          {/* Conditional links based on authentication state */}
          {user && (
            <>
              <Link href={`/profile/${user.uid}`} className="ml-4 hover:underline">
                My Profile
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


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased select-none">
        <AuthProvider>
          {/* Render the GlobalNavbar here */}
          <GlobalNavbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}