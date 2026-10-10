// Configuration Auth.js — voir SPEC.md §3.
//
// La méthode de connexion détermine le rôle :
//  - identifiant + mot de passe (Credentials) → ADMIN
//  - compte Google                            → USER
//
// Session en JWT : imposé par le provider Credentials. Pas d'adapter Prisma,
// les comptes sont lus et créés à la main.

import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

// Domaines acceptés pour la connexion Google, comparés à l'identique :
// « he2b.be » autorisé n'ouvre PAS « etu.he2b.be » (les étudiants).
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

function isAllowedEmail(email: string) {
  const domain = email.split("@").pop()?.toLowerCase();
  return domain !== undefined && allowedDomains.includes(domain);
}

// Force brute sur la connexion admin : après 5 mauvais mots de passe, le
// compte est verrouillé 15 minutes. Compté en base, et non en mémoire : sur
// Vercel, plusieurs instances tournent en parallèle.
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Refus dû au verrouillage. `code` est relu par l'action de connexion pour
// afficher un message distinct de « mot de passe incorrect ».
class AccountLocked extends CredentialsSignin {
  code = "locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },

  // Notre page remplace celle d'Auth.js, y compris pour les erreurs : un refus
  // Google arrive sur /login?error=AccessDenied.
  pages: { signIn: "/login", error: "/login" },

  providers: [
    Credentials({
      credentials: {
        username: { label: "Identifiant" },
        password: { label: "Mot de passe", type: "password" },
      },

      async authorize(credentials) {
        const username =
          typeof credentials.username === "string"
            ? credentials.username.trim()
            : "";
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });

        // Seuls les comptes ADMIN ont un mot de passe : un compte Google ne
        // peut pas passer par cette voie, même si son username était rempli.
        if (!user || user.role !== "ADMIN" || !user.passwordHash) return null;

        // Verrouillé : refusé sans même comparer, un bon mot de passe ne
        // doit pas pouvoir être confirmé pendant le blocage.
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new AccountLocked();

        if (!(await bcrypt.compare(password, user.passwordHash))) {
          // Incrément atomique : des essais simultanés comptent tous.
          const { failedLogins } = await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: { increment: 1 } },
          });
          if (failedLogins >= MAX_FAILED_LOGINS) {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
            });
            throw new AccountLocked();
          }
          return null;
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
        }
        return { id: user.id, name: user.name, role: user.role };
      },
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    // Contrôle d'accès Google + création du compte à la première connexion.
    // Refuser ici (return false) bloque la connexion avant toute session.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email?.toLowerCase();
      if (!email || !profile?.email_verified || !isAllowedEmail(email)) {
        return false;
      }

      const name = profile.name ?? email;

      // Le User et sa Resource PERSON sont créés ensemble (écriture imbriquée,
      // donc atomique) : un utilisateur Google n'existe jamais sans sa fiche.
      // Resource.name est une copie de User.name : c'est le seul endroit où
      // le nom d'une personne change, on y met donc à jour les deux.
      await prisma.user.upsert({
        where: { email },
        update: { name, resource: { update: { name } } },
        create: {
          email,
          name,
          role: "USER",
          resource: { create: { type: "PERSON", name } },
        },
      });

      return true;
    },

    // `user` n'est fourni qu'à la connexion : on recopie alors id et rôle dans
    // le token, qui les transporte ensuite d'une requête à l'autre.
    async jwt({ token, user, account }) {
      // Pour Google, `user.id` est l'identifiant Google, pas le nôtre : on
      // relit le compte créé par signIn.
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUniqueOrThrow({
          where: { email: token.email.toLowerCase() },
        });
        token.id = dbUser.id;
        token.role = dbUser.role;
      } else if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
