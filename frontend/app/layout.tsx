import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices dans le dépôt : le build ne dépend pas de Google Fonts.
const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/IBMPlexSans-400.woff2", weight: "400" },
    { path: "./fonts/IBMPlexSans-500.woff2", weight: "500" },
    { path: "./fonts/IBMPlexSans-600.woff2", weight: "600" },
    { path: "./fonts/IBMPlexSans-700.woff2", weight: "700" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500" },
  ],
});

export const metadata: Metadata = {
  title: "LanGestLoc — Gestion locative",
  description: "Gestion locative de locaux commerciaux",
};

// Sans « cover », iOS ne donne pas la hauteur de la barre d'accueil (safe-area).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
