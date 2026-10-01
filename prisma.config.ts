import { existsSync } from 'node:fs'

import { defineConfig, env } from 'prisma/config'

// schema.prisma. C'est ici que Migrate va la chercher.
//
// En production (Vercel), les variables viennent de la plateforme et le fichier
// n'existe pas : d'où le test d'existence plutôt qu'un chargement inconditionnel.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
