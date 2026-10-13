import type { NextConfig } from "next";

// En-têtes de sécurité, sur toutes les réponses. HTTPS strict (HSTS) est
// ajouté par Vercel.
//
// Pas de Content-Security-Policy complète : Ant Design injecte ses styles en
// ligne, une politique stricte demanderait un nonce sur chaque page. On ne
// garde que les directives sans effet sur l'interface.
const securityHeaders = [
  // Le site ne s'affiche dans aucune iframe : un autre site ne peut pas faire
  // cliquer « Supprimer » ou « Publier » à l'insu de l'admin (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" }, // même règle, anciens navigateurs
  // Le navigateur respecte le type annoncé (un JSON reste un JSON).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les liens sortants n'emportent que le domaine, jamais l'URL complète.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Fonctions du navigateur dont l'application n'a pas besoin.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Image Docker : .next/standalone contient un server.js et le strict
  // nécessaire de node_modules (voir Dockerfile). Sans effet sur Vercel.
  output: "standalone",
  poweredByHeader: false, // ne pas annoncer « Next.js » aux curieux
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
