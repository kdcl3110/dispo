import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client'

// Prisma 7 : le client ne lit plus DATABASE_URL lui-même, il passe par un
// adapter. L'URL est fournie ici, une seule fois pour toute l'appli.
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

// En dev, le rechargement à chaud réévalue ce module à chaque modification :
// sans ce cache sur globalThis, chaque rechargement ouvrirait un nouveau pool
// de connexions jusqu'à saturer PostgreSQL.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
