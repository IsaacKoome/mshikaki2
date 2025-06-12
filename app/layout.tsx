// layout.tsx
import "./globals.css";
import { AuthProvider } from "@/lib/auth"; // Only AuthProvider needed here
import GlobalNavbar from "@/components/GlobalNavbar"; // <<< IMPORT THE NEW CLIENT COMPONENT

export const metadata = {
  title: "Mshikaki App",
  description: "A colorful event and fundraising app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased select-none">
        <AuthProvider>
          {/* GlobalNavbar is now a Client Component, so it can be rendered here */}
          <GlobalNavbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}