// /admin n'a pas de contenu propre : on commence par les calendriers.

import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/calendars");
}
