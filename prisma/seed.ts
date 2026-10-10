// Crée le compte admin (voie identifiant / mot de passe) — voir SPEC.md §3.
// Il n'y a pas d'inscription publique : ce script est la seule façon de créer
// un ADMIN. Rejouable : relancé, il réinitialise le mot de passe.

import bcrypt from 'bcryptjs'

import { prisma } from '../src/lib/prisma'

const MIN_PASSWORD_LENGTH = 12
const FORBIDDEN_WORDS = ['changeme', 'password', 'motdepasse', 'admin', '123456', 'azerty', 'qwerty']

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error('SEED_ADMIN_USERNAME et SEED_ADMIN_PASSWORD doivent être définis.')
  }

  // Ce compte ouvre toute l'administration : pas de mot de passe court ni
  // de valeur d'exemple, même en local (le .env local finit souvent en prod).
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  }
  const lower = password.toLowerCase()
  if (FORBIDDEN_WORDS.some((word) => lower.includes(word)) || lower.includes(username.toLowerCase())) {
    throw new Error("SEED_ADMIN_PASSWORD est trop facile à deviner : évitez « changeme », « password », « admin » et l'identifiant.")
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
