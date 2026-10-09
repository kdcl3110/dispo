// Crée le compte admin (voie identifiant / mot de passe) — voir SPEC.md §3.
// Il n'y a pas d'inscription publique : ce script est la seule façon de créer
// un ADMIN. Rejouable : relancé, il réinitialise le mot de passe.

import bcrypt from 'bcryptjs'

import { prisma } from '../src/lib/prisma'

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error('SEED_ADMIN_USERNAME et SEED_ADMIN_PASSWORD doivent être définis.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Pas de Resource créée : un ADMIN n'a pas de fiche PERSON, c'est ce qui
  // l'empêche structurellement de saisir « ses » disponibilités (SPEC §4).
  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: 'ADMIN' },
    create: { username, passwordHash, role: 'ADMIN', name: username },
  })

  console.log(`Admin prêt : ${admin.username} (${admin.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
