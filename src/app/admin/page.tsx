// /admin n'a pas de contenu propre : on commence par la configuration.

import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/calendar");
}
