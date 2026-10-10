// Téléchargement de l'export JSON (SPEC §9). Le fichier est construit à la
// demande : il reflète toujours l'état courant de la base.

import { buildExport, exportFileName } from "@/lib/export";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const admin = await requireAdmin();

  const calendarId = new URL(request.url).searchParams.get("calendar") ?? "";
  const document = await buildExport(calendarId, admin.name ?? "admin");
  if (!document) {
    return new Response("Ce calendrier n'existe pas.", { status: 404 });
  }

  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(document)}"`,
      "Cache-Control": "no-store",
    },
  });
}
