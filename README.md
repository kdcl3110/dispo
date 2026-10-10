# Dispo

Gestion des disponibilités du personnel HE2B, des locaux et des équipements sur un calendrier de 15 semaines maximum, avec export JSON.

Spécification complète : [SPEC.md](SPEC.md).

## Démarrer

```bash
cp .env.example .env        # puis compléter les valeurs
docker compose up -d        # PostgreSQL sur le port 5433
npm install
npx prisma migrate dev      # applique les migrations et génère le client
npx prisma db seed          # crée le compte admin (SEED_ADMIN_*)
npm run dev                 # http://localhost:3000
```

## Architecture

### Règle de base

Chaque domaine métier porte **le même nom dans toutes les couches** :
`calendar`, `availability`, `resource`, `import`, plus `auth` pour la connexion. Pour une fonctionnalité donnée, on sait où trouver sa page, son action et sa logique.

```
prisma/
  schema.prisma            Modèle de données (SPEC §5)
  migrations/              Générées par Prisma, ne pas éditer
  seed.ts                  Création du compte admin

src/
  auth.ts                  Config Auth.js : providers, JWT, callbacks
  proxy.ts                 Redirection rapide par rôle (Next 16 : ex-middleware)

  app/                     URLs uniquement : pages, layouts, routes
    layout.tsx
    page.tsx               Aiguillage selon le rôle
    login/page.tsx         Connexion du personnel (Google)
    login/admin/page.tsx   Connexion administrateur
    api/auth/[...nextauth]/route.ts
    admin/                 Zone ADMIN
      layout.tsx           Vérifie le rôle, affiche la barre latérale
      page.tsx             Redirige vers /admin/calendar
      calendar/            Configuration (dates, jours, horaires, pauses)
        holidays/          Jours fériés et publication
      resources/           Liste des ressources
        import/            Import XLS des locaux et équipements
      availability/        Grille d'une ressource (saisie admin)
      export/              Export JSON
    availability/          Zone USER : sa propre grille

  actions/                 Server Actions, un fichier par domaine
    auth.ts                Connexion Google / admin, déconnexion
    availability.ts        Signaler un créneau (personnel et admin)
    calendar.ts            Configuration, jours retirés, publication
    resource.ts            Ajouter / modifier un local ou un équipement
    import.ts

  lib/                     Logique serveur, sans UI
    prisma.ts              Instance Prisma unique
    availability.ts        Créneaux signalés : lire, enregistrer, effacer
    calendar.ts            Lecture / écriture du calendrier (unique)
    resource.ts            Ressources : lecture, création, modification
    session.ts             requireAdmin() / requireUser()
    slots.ts               Créneaux, jours et semaines du calendrier (SPEC §6)
    validation/            Règles de validation par domaine (SPEC §10)
      availability.ts      Créneau signalé (règles 1 à 6)
      calendar.ts          Configuration du calendrier (règles 7 à 11)
      resource.ts          Local ou équipement (type, nom)

  components/              UI réutilisable
    ui/                    Thème Ant Design et fournisseurs (layout racine)
    admin/                 Cadre de la zone admin : barre latérale, contenu
    calendar/              Étapes, formulaires de configuration et de jours fériés
    resource/              Tableau des ressources, fenêtre d'ajout / modification
    auth/                  Pages de connexion : bouton Google, formulaire admin, feuille d'exemple
    availability-grid/     La grille et sa légende, partagées USER / ADMIN

  types/
    next-auth.d.ts         Ajoute `role` à la session

  generated/prisma/        Client Prisma généré, ignoré par git
```

### Qui fait quoi

| Couche | Rôle | Interdit |
|---|---|---|
| `app/` | Routage : récupère les données, affiche | Logique métier |
| `actions/` | Vérifie les droits, valide, délègue à `lib/` | Rendu d'UI |
| `lib/` | Règles métier, accès base | React, formulaires |
| `components/` | Affichage | Accès base |

`proxy.ts` ne fait qu'une redirection optimiste. La vraie vérification des droits est faite dans `lib/session.ts`, appelée par chaque layout protégé et chaque action.

### Conventions

- Code (fichiers, variables, URLs) en anglais. Commentaires et textes affichés en français.
- Fichiers en `kebab-case`, un domaine par fichier.
- Import via l'alias `@/` (`@/lib/prisma`), jamais de chemins relatifs qui remontent dans `src/`.
- Tout nouvel emplacement non prévu ici est ajouté à cette carte **avant** d'y créer un fichier.
