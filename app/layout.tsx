import "./globals.css";
import { AuthProvider } from "@/lib/auth"; // 👈 Import the provider

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
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
