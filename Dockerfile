# Image de production de Dispo — voir README, « Déployer avec Docker ».
#
# Trois cibles :
#  - runner  (par défaut) : le serveur Next seul, sans code source ni outils ;
#  - migrate : outillage Prisma, applique les migrations (et lance le seed) ;
#  - build   : étape intermédiaire, partagée par les deux.
#
# Aucun secret n'entre dans l'image (.dockerignore) : DATABASE_URL,
# AUTH_SECRET, Google… sont fournis au démarrage du conteneur.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------- dépendances
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
# OpenSSL : requis par le moteur de migration de Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# Le schéma avant `npm ci` : le postinstall génère le client Prisma.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------- build
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

# ---------------------------------------------------------------- migrations
# Lancée avant l'application par docker-compose.prod.yml. Le seed (compte
# admin) se lance à la main : voir README.
# Image à part et légère : seulement Prisma, tsx et bcryptjs (pour le seed),
# aux versions exactes du package-lock.json, plus le schéma et les migrations.
FROM ${NODE_IMAGE} AS migrate
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package-lock.json ./
RUN npm init -y > /dev/null \
 && node -e "const p = require('./package-lock.json').packages; \
      console.log(['prisma', '@prisma/client', '@prisma/adapter-pg', 'bcryptjs', 'tsx'] \
        .map((n) => n + '@' + p['node_modules/' + n].version).join(' '))" \
    | xargs npm install --no-audit --no-fund \
 && npm cache clean --force
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src/lib/prisma.ts ./src/lib/prisma.ts
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------- production
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Hors Vercel, Auth.js refuse sinon toutes les connexions (UntrustedHost).
    AUTH_TRUST_HOST=true

# server.js et le strict nécessaire de node_modules, plus les fichiers statiques.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Utilisateur sans privilèges, fourni par l'image Node.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
