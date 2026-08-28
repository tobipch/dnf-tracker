import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "3BLD Attempt Tracker",
  description: "Scramble, Timer und DNF-Analyse für 3BLD in einer App.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  // Zum Homescreen hinzugefügt läuft die App ohne Browser-Leiste – auf dem
  // Handy ist das der Unterschied zwischen "Webseite" und "Timer-App".
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "3BLD" },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
