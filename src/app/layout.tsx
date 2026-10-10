import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";

import { UiProviders } from "@/components/ui/providers";

// Une seule famille, IBM Plex (voir les maquettes) :
//  - Sans       : toute l'interface
//  - Condensed  : en-têtes et heures des grilles, comme un horaire imprimé
//  - Mono       : uniquement pour du code (aperçu JSON, format d'import)
// Police variable : toutes les graisses dans un seul fichier.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Dispo",
  description: "Disponibilités du personnel, des locaux et des équipements de la HE2B.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <UiProviders>{children}</UiProviders>
      </body>
    </html>
  );
}
