// Thème Ant Design aux couleurs des maquettes (direction « grille horaire
// papier »). Les mêmes valeurs existent en CSS dans src/app/globals.css pour
// ce qui n'est pas un composant Ant (la grille des disponibilités, la mise en
// page) : toute modification se fait aux deux endroits.

import type { ThemeConfig } from "antd";

const ink = "#1d2433";
const graphite = "#5a6070";
const rule = "#dde2ea";
const field = "#c9cfd9";
const pen = "#2340a8";
const penTint = "#eef2fb";
const desk = "#f1f4f9";
const unavailable = "#c62d35";

export const theme: ThemeConfig = {
  // Pas d'ombres décoratives, filets fins : la page est une feuille de papier.
  token: {
    colorPrimary: pen,
    colorInfo: pen,
    colorLink: pen,
    // Les confirmations restent dans le bleu de l'encre : le vert est réservé
    // au statut « disponible » de la grille, il ne doit rien signifier d'autre.
    colorSuccess: pen,
    colorError: unavailable,
    colorWarning: "#b7791f",

    colorText: ink,
    colorTextSecondary: graphite,
    colorTextTertiary: graphite,
    colorBorder: field,
    colorBorderSecondary: rule,
    colorSplit: rule,
    colorBgLayout: "#ffffff",
    colorBgContainer: "#ffffff",
    colorFillAlter: desk,

    fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
    fontFamilyCode: "var(--font-plex-mono), monospace",
    fontSize: 14,

    borderRadius: 6,
    borderRadiusLG: 10,
    borderRadiusSM: 4,
    controlHeight: 40,
    controlHeightLG: 48,

    boxShadow: "none",
    boxShadowSecondary: "0 24px 60px -20px rgba(29, 36, 51, 0.45)", // fenêtres et menus flottants
  },

  components: {
    Button: {
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Layout: {
      bodyBg: "#ffffff",
      headerBg: "#ffffff",
      siderBg: "#ffffff",
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: penTint,
      itemSelectedColor: pen,
      itemHoverBg: desk,
      itemBorderRadius: 6,
      itemHeight: 38,
      groupTitleColor: graphite,
      activeBarBorderWidth: 0,
    },
    Table: {
      headerBg: "#ffffff",
      headerColor: graphite,
      headerSplitColor: "transparent",
      borderColor: rule,
      rowHoverBg: "#f6f8fb",
    },
    Modal: {
      titleFontSize: 22,
    },
    Segmented: {
      itemSelectedBg: penTint,
      itemSelectedColor: pen,
    },
  },
};
