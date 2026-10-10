"use client";

// Fournisseurs d'interface, posés une fois dans le layout racine :
//  - AntdRegistry : rend les styles d'Ant Design côté serveur (pas de flash
//    de page sans style au chargement) ;
//  - ConfigProvider : notre thème et le français de Belgique ;
//  - App : donne accès aux messages et confirmations (App.useApp()).

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import frBE from "antd/locale/fr_BE";
import dayjs from "dayjs";
import "dayjs/locale/fr";

import { theme } from "./theme";

// Calendriers et sélecteurs de date d'Ant Design en français, semaine du lundi.
dayjs.locale("fr");

export function UiProviders({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      {/* wave désactivé : pas d'onde décorative au clic sur les boutons. */}
      <ConfigProvider theme={theme} locale={frBE} wave={{ disabled: true }}>
        {/* component={false} : pas de <div> en plus, nos mises en page flex restent intactes. */}
        <App component={false}>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
