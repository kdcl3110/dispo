"use client";

// Icônes d'Ant Design utilisables depuis une page serveur.
//
// @ant-design/icons n'est pas marqué « use client » et utilise un contexte
// React : importé directement dans une page serveur, il plante. Réexportées
// depuis ce fichier client, les icônes deviennent des références client
// qu'une page serveur peut placer comme n'importe quel composant.
// Les composants déjà « use client » peuvent importer @ant-design/icons directement.

export {
  ArrowLeftOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  ClockCircleOutlined,
  DesktopOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  FieldTimeOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
