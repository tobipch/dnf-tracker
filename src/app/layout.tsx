import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "3BLD DNF Tracker",
  description: "Tracke und analysiere die Gründe für deine 3BLD DNFs.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  // Vom Homescreen gestartet läuft die App ohne Safari-Leisten.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "3BLD" },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  // Damit die Seite hinter Notch und Home-Indicator reicht und wir die
  // Safe-Area-Insets selbst setzen können.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="safe-x mx-auto max-w-5xl pb-10 pt-4 sm:pt-6">{children}</main>
      </body>
    </html>
  );
}
