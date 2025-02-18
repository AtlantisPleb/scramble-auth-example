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
  checks: ["nonce"],
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: true, // Enable debug mode for testing
  providers: [PseudOIDCProvider],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
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
      // Add pseudonym to session
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