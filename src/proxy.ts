// Redirection rapide par rôle, avant le rendu de la page (Next 16 : ex-middleware).
//
// Ce n'est PAS la barrière de sécurité : un oubli dans le matcher suffirait à
// la contourner. La vraie vérification est dans src/lib/session.ts, appelée
// par chaque layout protégé et chaque Server Action. Ce fichier évite
// seulement de lancer le rendu d'une page qui sera refusée de toute façon.
//
// Mêmes règles que session.ts : pas connecté → /login, mauvais rôle → /.

import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Zone protégée → rôle exigé.
const zones = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/availability", role: "USER" },
] as const;

// `auth(...)` enveloppe le proxy : la session est déjà décodée dans `req.auth`.
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  // Segment exact : « /admin » et « /admin/… », mais pas « /administration ».
  const zone = zones.find(
    (z) => pathname === z.prefix || pathname.startsWith(`${z.prefix}/`),
  );
  if (!zone) return;

  const user = req.auth?.user;
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl));
  if (user.role !== zone.role) return NextResponse.redirect(new URL("/", req.nextUrl));
});

// Le proxy ne s'exécute que sur les zones protégées : ni les pages publiques,
// ni les fichiers statiques, ni /api/auth ne passent par ici.
export const config = {
  matcher: ["/admin/:path*", "/availability/:path*"],
};
