"use client";

// Cadre de la zone admin : barre latérale + contenu, en Layout d'Ant Design.
//
// Composant client obligatoire : dans un composant serveur, `Layout` n'est
// qu'une référence vers le client, et ses sous-composants (Layout.Content…)
// n'y existent pas. Le layout serveur (app/admin/layout.tsx) passe donc par ici.

import { Layout } from "antd";

import { AdminSidebar } from "./sidebar";

export function AdminShell({ username, children }: { username: string; children: React.ReactNode }) {
  return (
    // Hauteur de l'écran : la page entière ne défile jamais. La barre latérale
    // reste en place ; seule la zone de contenu défile quand une page est longue
    // (une grille, elle, défile dans son cadre).
    <Layout hasSider className="h-dvh overflow-hidden">
      <AdminSidebar username={username} />
      <Layout.Content className="flex min-h-0 min-w-0 flex-col overflow-y-auto">{children}</Layout.Content>
    </Layout>
  );
}
