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
npm test                    # tests des règles métier (Vitest)
```

## Déployer avec Docker

Sur n'importe quel serveur avec Docker : base PostgreSQL, migrations et application, en un seul fichier ([docker-compose.prod.yml](docker-compose.prod.yml)).

1. Copier le dépôt sur le serveur, puis créer un `.env` à côté de `docker-compose.prod.yml` :

   ```bash
   POSTGRES_PASSWORD=...           # openssl rand -hex 24 (pas de caractères spéciaux : il entre dans une URL)
   AUTH_SECRET=...                 # openssl rand -base64 33, propre à ce serveur
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ALLOWED_EMAIL_DOMAINS=he2b.be
   SEED_ADMIN_USERNAME=dispo
   SEED_ADMIN_PASSWORD=...         # 12 caractères minimum
   APP_PORT=3000                   # port publié sur le serveur (3000 par défaut)
   ```

   `DATABASE_URL` est inutile : le compose la construit. `AUTH_TRUST_HOST` est déjà réglé dans l'image.

2. Lancer, puis créer le compte admin (une seule fois) :

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml run --rm migrate npx prisma db seed
   ```

   Au démarrage, le service `migrate` applique les migrations ; l'application n'attend que sa réussite.

3. Mettre l'application derrière un reverse proxy HTTPS (Caddy, nginx, Traefik…) : Google n'accepte que des adresses `https://` (hors `localhost`). Dans la console Google, ajouter `https://<adresse>/api/auth/callback/google`.

Mise à jour : `git pull` puis la même commande `up -d --build` (les nouvelles migrations passent automatiquement).

Sauvegarde de la base :
`docker compose -f docker-compose.prod.yml exec db pg_dump -U dispo dispo > dispo-$(date +%F).sql`

> `docker run --env-file .env` garde les guillemets des valeurs (`"…"`) : pour lancer l'image sans compose, écrire le `.env` sans guillemets.

## Architecture

### Règle de base

Chaque domaine métier porte **le même nom dans toutes les couches** :
`calendar`, `availability`, `resource`, `import`, plus `auth` pour la connexion. Pour une fonctionnalité donnée, on sait où trouver sa page, son action et sa logique.

```
Dockerfile                 Image de production (cibles runner et migrate)
docker-compose.yml         Développement : PostgreSQL seul
docker-compose.prod.yml    Production : base, migrations, application

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
      page.tsx             Redirige vers /admin/calendars
      calendars/           Liste des calendriers, création, suppression
        [id]/              Un calendrier : résumé, horaires, congés, publication
      resources/           Ressources : liste, ajout, import Excel (même page)
      availability/        Grille d'une ressource (saisie admin)
      export/              Export JSON : résumé et aperçu
        download/route.ts  Téléchargement du fichier
    availability/          Zone USER : ses calendriers publiés (un seul → sa grille)
      [id]/                La grille d'un calendrier

  actions/                 Server Actions, un fichier par domaine
    auth.ts                Connexion Google / admin, déconnexion
    availability.ts        Signaler un créneau (personnel et admin)
    calendar.ts            Configuration, jours retirés, publication
    resource.ts            Ajouter / modifier un local ou un équipement
    import.ts              Import Excel des locaux et équipements

  lib/                     Logique serveur, sans UI
    prisma.ts              Instance Prisma unique
    availability.ts        Créneaux signalés : lire, enregistrer, effacer
    calendar.ts            Lecture / écriture des calendriers
    export.ts              Construction de l'export JSON (SPEC §9)
    import.ts              Lecture du fichier Excel, création des ressources
    resource.ts            Ressources : lecture, création, modification
    session.ts             requireAdmin() / requireUser()
    slots.ts               Créneaux, jours et semaines du calendrier (SPEC §6)
    validation/            Règles de validation par domaine (SPEC §10)
      availability.ts      Créneau signalé (règles 1 à 6)
      calendar.ts          Configuration du calendrier (règles 7 à 11)
      resource.ts          Local ou équipement (type, nom)

  components/              UI réutilisable
    ui/                    Thème Ant Design, fournisseurs, en-tête d'écran, icônes, menu utilisateur, squelettes
    admin/                 Cadre de la zone admin, choix de la ressource
    calendar/              Calendriers : liste, résumé, panneaux de modification, bilan des créneaux touchés, aperçu des mois
    resource/              Tableau des ressources, fenêtres d'ajout et d'import
    auth/                  Pages de connexion : bouton Google, formulaire admin, feuille d'exemple
    availability-grid/     La grille et sa légende, partagées USER / ADMIN

  test/                    Outillage des tests (pas de tests ici)
    server-only-stub.ts    Remplace `server-only` hors de Next

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

- Chaque groupe d'écrans a son `loading.tsx` (squelette à la forme de l'écran, pièces dans `components/ui/skeletons.tsx`).

- Code (fichiers, variables, URLs) en anglais. Commentaires et textes affichés en français.
- Fichiers en `kebab-case`, un domaine par fichier.
- Import via l'alias `@/` (`@/lib/prisma`), jamais de chemins relatifs qui remontent dans `src/`.
- Tests à côté du fichier testé : `slots.ts` → `slots.test.ts`. Ils couvrent les fonctions pures de `lib/` ; Prisma y est remplacé par un faux (`vi.mock`), aucun test ne touche la base.
- Tout nouvel emplacement non prévu ici est ajouté à cette carte **avant** d'y créer un fichier.
