import NextAuth from "next-auth"
import "next-auth/jwt"

import type { OAuthConfig } from "next-auth/providers/oauth"

// PseudOIDC provider configuration
const PseudOIDCProvider: OAuthConfig<any> = {
  id: "pseudoidc",
  name: "PseudOIDC",
  type: "oauth",
  issuer: "https://auth.scramblesolutions.com",
  authorization: {
    url: "https://auth.scramblesolutions.com/oauth2/auth",
    params: {
      scope: "openid",
      prompt: "create",  // Use signup flow
      email: "test@example.com",  // Hardcode for testing
    }
  },
  token: {
    url: "https://auth.scramblesolutions.com/oauth2/token",
    // Override the token request to match PseudoIDC's expectations
    async request({ provider, params, client }) {
      const response = await fetch(provider.token.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          ...params,
          client_id: client.client_id,
          client_secret: client.client_secret,
        }),
      })
      return await response.json()
    }
  },
  userinfo: {
    url: "https://auth.scramblesolutions.com/oauth2/userinfo"
  },
  clientId: process.env.PSEUDOIDC_CLIENT_ID,
  clientSecret: process.env.PSEUDOIDC_CLIENT_SECRET,
  idToken: true,
  checks: ["pkce", "state"],
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
    jwt({ token, trigger, session }) {
      if (trigger === "update") token.name = session.user.name
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