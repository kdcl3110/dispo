# Fiche technique — Application de gestion des disponibilités

Document de spécification destiné à démarrer le développement (à donner à Claude Code).

---

## 1. Objectif

Application web permettant de renseigner les disponibilités **d'une personne, d'un local ou d'un équipement** sur une période donnée, et d'exporter l'ensemble au format **JSON**.

L'administrateur définit une grille de créneaux (configuration + pauses + jours fériés), la **publie**, puis chaque créneau peut être marqué **disponible**, **si nécessaire** ou **indisponible**.

**Tout est disponible par défaut.** L'utilisateur ne déclare que ses exceptions ; toute exception impose un commentaire justificatif.

---

## 2. Stack technique

- **Next.js** (App Router) — utiliser les **Server Actions** pour les lectures/écritures (pas d'API REST séparée).
- **Auth.js (NextAuth)** — authentification, deux providers (voir §3).
- **Prisma + PostgreSQL** — persistance.
- **SheetJS (`xlsx`)** — lecture des fichiers d'import Excel.
- Déploiement cible : Vercel + base Neon/Supabase (non bloquant pour le dev).

---

## 3. Authentification & rôles

**La méthode de connexion détermine le rôle. Les deux rôles sont strictement séparés.**

| Méthode de connexion | Provider Auth.js | Rôle attribué |
|---|---|---|
| Identifiant + mot de passe | Credentials | `ADMIN` |
| Compte Google | Google | `USER` |

Règles :

- **Session en stratégie JWT** (`session: { strategy: "jwt" }`) — obligatoire car le provider Credentials l'impose ; toute l'appli est donc en JWT.
- Les **mots de passe admin sont hachés** (bcrypt ou argon2), jamais en clair. Les comptes admin sont créés via un **script de seed** (pas d'inscription publique).
- La connexion Google est **restreinte au domaine** `@he2b.be` (contrôle dans le callback `signIn` d'Auth.js). Tout autre domaine est refusé, **`@etu.he2b.be` compris** : l'application n'est pas ouverte aux étudiants.
- **Pas d'adapter Prisma** (`@auth/prisma-adapter`). En stratégie JWT il ne servirait qu'à lier les comptes Google, au prix de trois tables (`Account`, `Session`, `VerificationToken`) inutilisées. La création de l'utilisateur et de sa `Resource` se fait à la main dans le callback `signIn`.
- Un utilisateur Google est **auto-créé** en base à sa première connexion, avec sa fiche `Resource` de type `PERSON` associée.
- Le rôle n'est jamais saisi ni modifiable par l'utilisateur : il découle du provider.

---

## 4. Rôles & permissions

| Action | USER | ADMIN |
|---|---|---|
| Configurer le calendrier (dates, jours, horaires, pauses) | ✗ | ✓ |
| Déclarer les jours fériés et **publier** le calendrier | ✗ | ✓ |
| Importer locaux & équipements (XLS) | ✗ | ✓ |
| Gérer les ressources | ✗ | ✓ |
| Déclarer **ses propres** exceptions de disponibilité | ✓ | ✗ |
| Déclarer les exceptions de **n'importe quelle** ressource (local, équipement, autre user) | ✗ | ✓ |
| Exporter le JSON global | ✗ | ✓ |

L'`ADMIN` ne peut pas renseigner « ses propres » disponibilités parce qu'il n'a **pas de `Resource` de type `PERSON`** : seuls les comptes Google en obtiennent une, à leur première connexion. La contrainte est structurelle, pas seulement applicative — ne pas la casser en donnant une `Resource` à un admin.

Protection des routes via **middleware** Next.js (zone `USER` vs zone `ADMIN`).

---

## 5. Modèle de données (Prisma)

**Important :** les créneaux (slots) **ne sont PAS persistés**. Ils sont dérivés à la volée de la configuration du calendrier (voir §6). Il n'existe donc pas de table `Slot`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum ResourceType {
  PERSON
  LOCAL
  EQUIPMENT
}

enum AvailabilityStatus {
  AVAILABLE      // jamais persisté — voir §7
  UNAVAILABLE
  IF_NEEDED
}

model User {
  id           String   @id @default(cuid())
  role         Role     @default(USER)   // découle du provider de connexion

  // Voie Google (utilisateur)
  email        String?  @unique
  image        String?

  // Voie identifiant / mot de passe (admin)
  username     String?  @unique
  passwordHash String?

  name         String?
  createdAt    DateTime @default(now())

  resource             Resource?                       // sa fiche "personne"
  editedAvailabilities Availability[] @relation("EditedBy")
}

model Calendar {
  id           String   @id @default(cuid())

  // Configuration saisie par l'admin — SOURCE DE VÉRITÉ UNIQUE de la grille
  name         String
  startDate    DateTime @db.Date
  endDate      DateTime @db.Date         // 15 semaines maximum — voir §6
  weekDays     String[]                  // ["monday", "tuesday", ...]
  dayStart     String                    // "08:00"
  dayEnd       String                    // "18:00"
  slotDuration Int                       // en minutes

  publishedAt  DateTime?                 // null = brouillon, invisible des USER
  createdAt    DateTime @default(now())

  breaks         Break[]
  holidays       Holiday[]
  availabilities Availability[]
}

model Break {
  id         String   @id @default(cuid())

  calendarId String
  calendar   Calendar @relation(fields: [calendarId], references: [id], onDelete: Cascade)

  name       String                      // "Pause déjeuner"
  start      String                      // "12:00"
  end        String                      // "14:00"

  @@unique([calendarId, start])
}

model Holiday {
  id         String   @id @default(cuid())

  calendarId String
  calendar   Calendar @relation(fields: [calendarId], references: [id], onDelete: Cascade)

  date       DateTime @db.Date
  label      String?                     // "Congé d'automne", "Armistice"

  @@unique([calendarId, date])
}

model Resource {
  id      String       @id @default(cuid())
  type    ResourceType
  name    String

  ownerId String?      @unique           // rempli uniquement pour une PERSON
  owner   User?        @relation(fields: [ownerId], references: [id])

  availabilities Availability[]

  @@unique([type, name])                 // upsert à l'import XLS, évite les doublons
}

model Availability {
  id         String             @id @default(cuid())

  calendarId String
  calendar   Calendar           @relation(fields: [calendarId], references: [id], onDelete: Cascade)

  resourceId String
  resource   Resource           @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  date       DateTime           @db.Date // le jour concerné
  start      String             // "09:00" — la tranche horaire (interprétée via slotDuration)

  status     AvailabilityStatus          // UNAVAILABLE ou IF_NEEDED uniquement
  comment    String                      // toujours renseigné : une ligne = une exception justifiée

  updatedById String
  updatedBy   User              @relation("EditedBy", fields: [updatedById], references: [id])
  updatedAt   DateTime          @updatedAt

  @@unique([resourceId, date, start])    // un seul statut par ressource × jour × tranche
}
```

Notes de conception :

- On stocke la tranche par son **`start`** (colonne stable), pas par un `slotId`. Le `slotId` n'existe que dans la couche d'export (§9).
- Le champ `calendarId` sur `Availability` rattache la réponse à la config qui lui donne son sens (`start` seul est ambigu sans `slotDuration`).
- **`Availability` ne contient que des exceptions.** Un créneau sans ligne est disponible. Repasser un créneau à « disponible » **supprime** la ligne ; on n'écrit jamais `status = AVAILABLE`. La valeur reste dans l'enum parce que l'API et le JSON d'export l'emploient (`defaultStatus`), pas parce qu'elle est stockée.
- Les pauses et les jours fériés vivent sur le `Calendar`, pas sur `Availability` : ils retirent des créneaux de la grille au lieu de porter un statut.

---

## 6. Configuration du calendrier & génération des créneaux

### Format de configuration (entrée admin)

```json
{
  "name": "Quadrimestre 1 · 2026-2027",
  "startDate": "2026-09-14",
  "endDate": "2026-12-25",
  "weekDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "dayStart": "08:00",
  "dayEnd": "18:00",
  "slotDuration": 120,
  "breaks": [
    { "name": "Pause déjeuner", "start": "12:00", "end": "14:00" }
  ],
  "holidays": [
    { "date": "2026-10-26", "label": "Congé d'automne" },
    { "date": "2026-11-11", "label": "Armistice" }
  ]
}
```

### Génération des créneaux (dérivée, non persistée)

Pour chaque jour retenu — un jour de `weekDays`, compris entre `startDate` et `endDate`, **et absent de `holidays`** — la plage `dayStart`→`dayEnd` est découpée en tranches de `slotDuration` minutes, **les pauses étant retirées**.

Une pause ne produit aucun créneau : elle coupe la journée en segments, chacun découpé indépendamment. La numérotation `s1, s2, …` court sur toute la journée, pauses sautées.

Fonction de référence, réutilisable à l'affichage **et** à l'export :

```js
function toMin(h) {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function toHHMM(min) {
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Découpe la journée en segments séparés par les pauses.
function daySegments({ dayStart, dayEnd, breaks = [] }) {
  const sorted = [...breaks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const segments = [];
  let cursor = toMin(dayStart);
  for (const b of sorted) {
    segments.push([cursor, toMin(b.start)]);
    cursor = toMin(b.end);
  }
  segments.push([cursor, toMin(dayEnd)]);
  return segments;
}

// Produit [{ id: "s1", start: "08:00", end: "10:00" }, ...]
// Les id sont déterministes (ordre croissant, pauses exclues).
function generateSlots({ dayStart, dayEnd, slotDuration, breaks = [] }) {
  const slots = [];
  let i = 1;
  for (const [from, to] of daySegments({ dayStart, dayEnd, breaks })) {
    for (let t = from; t + slotDuration <= to; t += slotDuration) {
      slots.push({ id: `s${i++}`, start: toHHMM(t), end: toHHMM(t + slotDuration) });
    }
  }
  return slots;
}
```

### Règles de validation clés

**1 — Chaque segment entre deux pauses doit être un multiple entier de `slotDuration`**, sinon le dernier créneau du segment serait tronqué. Ce n'est plus la journée entière qui est vérifiée, mais chaque segment.

```js
function validateGrid({ dayStart, dayEnd, slotDuration, breaks = [] }) {
  const sorted = [...breaks].sort((a, b) => toMin(a.start) - toMin(b.start));
  let cursor = toMin(dayStart);

  for (const b of sorted) {
    const from = toMin(b.start);
    const to = toMin(b.end);
    if (from < cursor || to <= from || to > toMin(dayEnd)) {
      throw new Error(`Pause ${b.start} – ${b.end} : hors journée ou chevauchante.`);
    }
    cursor = to;
  }

  for (const [from, to] of daySegments({ dayStart, dayEnd, breaks })) {
    const len = to - from;
    if (len <= 0 || len % slotDuration !== 0) {
      throw new Error(
        `Le segment ${toHHMM(from)} – ${toHHMM(to)} (${len} min) doit être un multiple de la durée d'un créneau (${slotDuration} min).`
      );
    }
  }
}
```

**2 — Le calendrier ne peut pas dépasser 15 semaines calendaires**, comptées depuis le lundi de la semaine de `startDate`.

```js
const MS_JOUR = 86400000;

function validateSpan(startDate, endDate) {
  const lundi = new Date(startDate);
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7)); // lundi = 0
  const jours = Math.floor((endDate - lundi) / MS_JOUR) + 1;
  const semaines = Math.ceil(jours / 7);
  if (semaines > 15) {
    throw new Error(`La période couvre ${semaines} semaines ; le maximum est 15.`);
  }
}
```

---

## 7. Statuts de disponibilité

| Statut | Sens | Commentaire | Stocké |
|---|---|---|---|
| `available` | Le créneau convient. **Valeur par défaut.** | interdit | non |
| `if_needed` | De préférence pas ce créneau, mais possible si nécessaire. | **obligatoire** | oui |
| `unavailable` | Le créneau ne convient pas. | **obligatoire** | oui |

- **Tout est disponible par défaut.** Un créneau sans ligne en base vaut `available`. Il n'existe pas d'état « pas de réponse » : l'utilisateur n'a rien à remplir pour être disponible, il ne déclare que ses **exceptions**.
- Les deux statuts d'exception exigent un `comment` non vide (après `trim`). Seul `available` s'en passe — et il n'est jamais écrit.
- Repasser un créneau à `available` **supprime** la ligne correspondante.
- Un créneau tombant sur un jour listé dans `holidays`, ou dans une pause, n'existe pas : aucune ligne ne peut y être écrite.

---

## 8. Import Excel des locaux & équipements

L'admin dépose un fichier `.xls` / `.xlsx` → lecture avec SheetJS → validation → création par **upsert** → compte-rendu (créés / mis à jour / ignorés).

Format attendu (première feuille, ligne d'en-tête) :

| type | name |
|---|---|
| local | Salle B12 |
| local | Auditoire 500 |
| equipment | Projecteur 01 |

Lecture :

```js
import * as XLSX from "xlsx";

const workbook = XLSX.read(fileBuffer);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet); // [{ type, name }, ...]
```

Règles :

- Normaliser les en-têtes et les valeurs (`trim`, minuscules pour `type`).
- Refuser un `type` autre que `local` / `equipment`, ou un `name` vide.
- Ignorer les lignes vides.
- **Upsert sur `(type, name)`** → import rejouable sans doublons.
- L'import concerne **uniquement** locaux et équipements. Les personnes sont auto-créées au login Google.

---

## 9. Export JSON (sortie complète)

L'export (admin uniquement) rassemble la config du calendrier, la grille **calculée** à partir de la config, et toutes les ressources avec leurs **exceptions**. Les créneaux disponibles n'y figurent pas : c'est le rôle de `defaultStatus`.

```json
{
  "meta": {
    "exportedAt": "2026-09-17T14:32:00+02:00",
    "exportedBy": "admin.hicham"
  },
  "calendar": {
    "name": "Quadrimestre 1 · 2026-2027",
    "startDate": "2026-09-14",
    "endDate": "2026-12-25",
    "weekDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "dayStart": "08:00",
    "dayEnd": "18:00",
    "slotDuration": 120,
    "breaks": [
      { "name": "Pause déjeuner", "start": "12:00", "end": "14:00" }
    ],
    "holidays": [
      { "date": "2026-10-26", "label": "Congé d'automne" },
      { "date": "2026-11-11", "label": "Armistice" }
    ],
    "defaultStatus": "available"
  },
  "slots": [
    { "id": "s1", "start": "08:00", "end": "10:00" },
    { "id": "s2", "start": "10:00", "end": "12:00" },
    { "id": "s3", "start": "14:00", "end": "16:00" },
    { "id": "s4", "start": "16:00", "end": "18:00" }
  ],
  "resources": [
    {
      "id": "res_u42",
      "type": "person",
      "name": "Claire Mertens",
      "owner": "claire.mertens@he2b.be",
      "exceptions": [
        { "date": "2026-09-14", "slotId": "s1", "status": "unavailable", "comment": "Réunion de département" },
        { "date": "2026-10-05", "slotId": "s4", "status": "if_needed", "comment": "Trajet long, à éviter si possible" }
      ]
    },
    {
      "id": "res_loc7",
      "type": "local",
      "name": "Salle B12",
      "owner": null,
      "exceptions": [
        { "date": "2026-09-14", "slotId": "s1", "status": "unavailable", "comment": "Maintenance du projecteur" }
      ]
    }
  ]
}
```

- `slots` est **calculé** via `generateSlots(config)` au moment de l'export (pas lu en base), pauses déduites.
- Le mapping `start` (stocké) → `slotId` (exporté) se fait au moment de l'export, à partir de la grille générée. Les id sont déterministes et stables.
- `owner` = e-mail pour une `person`, `null` pour local / équipement.
- La clé est `exceptions`, pas `availabilities` : **seules les lignes en base y figurent**. Tout couple (date, slotId) absent vaut `defaultStatus`, donc `available`.
- `comment` est toujours une chaîne non vide — une exception sans justification n'existe pas.
- Les dates de `holidays` ne produisent aucun couple (date, slotId) : le consommateur doit les retirer de son propre calcul de la grille.

---

## 10. Validation côté serveur (récapitulatif)

Comme les slots ne sont plus une table (plus de clé étrangère qui garantit la cohérence), la **validation serveur** est le garde-fou central. À l'enregistrement d'une disponibilité :

1. `status ∈ { unavailable, if_needed }` ⇒ `comment` présent et non vide après `trim`.
2. `status = available` ⇒ on **supprime** la ligne au lieu de l'écrire.
3. `start` reçu ⇒ correspond à une tranche de la grille générée depuis la config, **hors pause**.
4. `date` reçue ⇒ comprise dans `[startDate, endDate]`, sur un jour listé dans `weekDays`, et **absente de `holidays`**.
5. Le calendrier est **publié** (`publishedAt != null`) — un `USER` ne peut rien écrire sur un brouillon.
6. Autorisation : un `USER` ne peut écrire que sur **sa propre** ressource ; un `ADMIN` sur n'importe laquelle, jamais sur la sienne (il n'en a pas).

À l'enregistrement de la config du calendrier :

7. Chaque segment entre pauses est un multiple de `slotDuration` (voir §6).
8. Les pauses sont ordonnées, disjointes et incluses dans `[dayStart, dayEnd]`.
9. La période couvre **15 semaines calendaires au maximum** (voir §6).
10. `startDate <= endDate`, `weekDays` non vide, `dayStart < dayEnd`.
11. Chaque date de `holidays` tombe dans `[startDate, endDate]`.

---

## 11. Variables d'environnement

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...                 # secret Auth.js
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ALLOWED_EMAIL_DOMAINS=he2b.be
```

---

## 12. Ordre de développement suggéré

Le socle d'abord (bloque le reste) :

1. Initialisation du projet Next.js + Prisma + config PostgreSQL.
2. Schéma Prisma (§5) + migration + script de seed (créer un admin).
3. Auth.js : provider Credentials (admin) + provider Google restreint aux domaines (user) + session JWT + middleware de protection des routes.

Puis en parallèle :

4. Admin — écran de configuration du calendrier : dates, jours, horaires, **pauses** (+ validations §6).
5. Admin — écran de déclaration des **jours fériés** puis **publication** (`publishedAt`).
6. Admin — import XLS des locaux & équipements (§8).
7. Admin — gestion des ressources.
8. User — grille complète des 15 semaines, tout disponible par défaut, clic pour déclarer une exception.
9. Server Action de saisie d'une exception (+ validation complète §10, suppression de ligne sur retour à `available`).
10. Admin — même grille pour n'importe quelle ressource.
11. Export JSON global (§9).

---

## Décisions figées (ne pas réinterpréter)

- Rôles strictement séparés ; le rôle découle du provider. Pas d'adapter Prisma.
- Connexion Google **réservée au personnel** (`@he2b.be`). Les étudiants n'ont pas accès à l'application.
- **Un seul** calendrier partagé, **15 semaines calendaires au maximum**.
- Le calendrier n'est visible des `USER` qu'une fois **publié**.
- Les slots sont **dérivés** de la config (pauses et jours fériés déduits), **jamais persistés**.
- **Tout est disponible par défaut.** `Availability` ne stocke que les exceptions ; `AVAILABLE` n'est jamais écrit et un retour à disponible supprime la ligne.
- Trois statuts : `available`, `if_needed`, `unavailable`. Commentaire obligatoire pour les deux derniers.
- Une exception est identifiée par `(resource, date, start)`.
- `slotId` n'existe que dans le JSON d'export, calculé de façon déterministe.
- Import XLS = locaux + équipements seulement.
