import NextAuth from "next-auth"
import "next-auth/jwt"

// PseudOIDC provider configuration
const PseudOIDCProvider = {
  id: "pseudoidc",
  name: "PseudOIDC",
  type: "oauth",
  authorization: {
    url: "https://auth.scramblesolutions.com/oauth2/auth",
    params: {
      scope: "openid",
      prompt: "create",
      email: "test@example.com",
      response_type: "code",
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
  // Custom token request
  async getToken(params) {
    const response = await fetch("https://auth.scramblesolutions.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirect_uri,
        client_id: process.env.PSEUDOIDC_CLIENT_ID!,
        client_secret: process.env.PSEUDOIDC_CLIENT_SECRET!,
        code_verifier: params.code_verifier,
      }).toString(),
    })

    console.log("Token response status:", response.status)
    const text = await response.text()
    console.log("Token response body:", text)

    if (!response.ok) {
      throw new Error(`Token request failed: ${text}`)
    }

    const tokens = JSON.parse(text)
    return {
      tokens,
      profile: {
        sub: tokens.sub || "unknown",
        email: tokens.email,
      },
    }
  },
  // Custom user profile request
  async getUserProfile(tokens) {
    const response = await fetch("https://auth.scramblesolutions.com/oauth2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    console.log("Profile response status:", response.status)
    const data = await response.json()
    console.log("Profile response data:", data)

    return {
      id: data.sub,
      email: data.email,
      emailVerified: true,
    }
  },
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