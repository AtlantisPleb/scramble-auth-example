import NextAuth from "next-auth"

// PseudOIDC provider configuration
const PseudOIDCProvider = {
  id: "pseudoidc",
  name: "PseudOIDC",
  type: "oidc",
  issuer: "https://auth.scramblesolutions.com",
  authorization: {
    params: {
      scope: "openid",
      prompt: "create",
      email: "test@example.com",
    }
  },
  checks: ["nonce"], // Required for OIDC validation
  clientId: process.env.PSEUDOIDC_CLIENT_ID,
  clientSecret: process.env.PSEUDOIDC_CLIENT_SECRET,
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [PseudOIDCProvider],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account?.id_token) {
        // Extract claims from the ID token
        const claims = JSON.parse(Buffer.from(account.id_token.split('.')[1], 'base64').toString())
        token.sub = claims.sub
        token.iss = claims.iss
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

// Add pseudonym to Session type
declare module "next-auth" {
  interface Session {
    pseudonym?: string
  }
}