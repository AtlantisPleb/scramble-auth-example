import NextAuth from "next-auth"
import "next-auth/jwt"

// PseudOIDC provider configuration
const PseudOIDCProvider = {
  id: "pseudoidc",
  name: "PseudOIDC",
  type: "oidc",
  issuer: "https://auth.scramblesolutions.com",
  authorization: {
    url: "https://auth.scramblesolutions.com/oauth2/auth",
    params: {
      scope: "openid",
      prompt: "create",
      email: "test@example.com",
    }
  },
  token: {
    url: "https://auth.scramblesolutions.com/oauth2/token",
  },
  userinfo: {
    url: "https://auth.scramblesolutions.com/oauth2/userinfo",
  },
  clientId: process.env.PSEUDOIDC_CLIENT_ID,
  clientSecret: process.env.PSEUDOIDC_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      email: profile.email,
      emailVerified: true,
    }
  }
}

import { createStorage } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"
import vercelKVDriver from "unstorage/drivers/vercel-kv"
import { UnstorageAdapter } from "@auth/unstorage-adapter"

const storage = createStorage({
  driver: process.env.VERCEL
    ? vercelKVDriver({
        url: process.env.AUTH_KV_REST_API_URL,
        token: process.env.AUTH_KV_REST_API_TOKEN,
        env: false,
      })
    : memoryDriver(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true, // Enable debug mode for testing
  theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  adapter: UnstorageAdapter(storage),
  providers: [PseudOIDCProvider],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl
      if (pathname === "/middleware-example") return !!auth
      return true
    },
    jwt({ token, trigger, session, account }) {
      if (trigger === "update") token.name = session.user.name
      if (account?.id_token) {
        // Extract claims from the ID token
        const claims = JSON.parse(Buffer.from(account.id_token.split('.')[1], 'base64').toString())
        token.sub = claims.sub
        token.iss = claims.iss
        token.nonce = claims.nonce
      }
      return token
    },
    async session({ session, token }) {
      // Add pseudonym to session if needed
      session.pseudonym = token.sub
      return session
    },
  }
})

declare module "next-auth" {
  interface Session {
    pseudonym?: string
  }
}