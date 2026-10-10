// Cadre de la zone USER (personnel connecté via Google) : vérification du
// rôle + en-tête (maquette « Mes disponibilités »).

import { Button } from "antd";
import Link from "next/link";

import { logout } from "@/actions/auth";
import { getCalendar } from "@/lib/calendar";
import { requireUser } from "@/lib/session";

export default async function AvailabilityLayout({ children }: LayoutProps<"/availability">) {
  const user = await requireUser();
  const calendar = await getCalendar();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-7 gap-y-3 border-b border-rule px-6 py-3 md:px-10">
        <div className="flex items-baseline gap-4">
          <span className="font-condensed text-2xl leading-none font-semibold tracking-[-0.01em]">dispo</span>
          {calendar?.publishedAt && <span className="text-sm text-graphite">{calendar.name}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <Link href="/login/admin" className="text-sm">
            Administration
          </Link>
          <div className="flex flex-col items-end">
            <span className="text-sm leading-snug font-semibold">{user.name}</span>
            <span className="text-[13px] leading-snug text-graphite">{user.email}</span>
          </div>
          <form action={logout}>
            <Button htmlType="submit">Se déconnecter</Button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
