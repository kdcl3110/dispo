// Téléchargement de l'export JSON (SPEC §9). Le fichier est construit à la
// demande : il reflète toujours l'état courant de la base.

import { buildExport, exportFileName } from "@/lib/export";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const admin = await requireAdmin();

  const document = await buildExport(admin.name ?? "admin");
  if (!document) {
    return new Response("Aucun calendrier à exporter.", { status: 404 });
  }

  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(document)}"`,
      "Cache-Control": "no-store",
    },
  });
}
