# Integrating with PseudOIDC

This guide shows how to integrate PseudOIDC with your application. PseudOIDC is a privacy-focused OIDC provider that gives you flexibility in how you handle user data.

## Quick Start

1. Install dependencies:
```bash
npm install next-auth
```

2. Get your OAuth credentials from Scramble:
```env
PSEUDOIDC_CLIENT_ID=client_xxx...
PSEUDOIDC_CLIENT_SECRET=secret_xxx...
```

3. Create `auth.ts` in your app root (see [working example](https://github.com/AtlantisPleb/scramble-auth-example/blob/main/auth.ts)):
```typescript
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
```

4. Use in your components:
```typescript
import { useSession, signIn, signOut } from "next-auth/react"

export default function Header() {
  const { data: session } = useSession()

  if (session) {
    return (
      <>
        User {session.pseudonym} logged in!
        <button onClick={() => signOut()}>Sign out</button>
      </>
    )
  }
  return (
    <button onClick={() => signIn("pseudoidc")}>Sign in</button>
  )
}
```

## Key Configuration Points

1. **Provider Type**: Use `type: "oidc"` (not "oauth") for proper OIDC handling
2. **Nonce Validation**: Include `checks: ["nonce"]` to enable proper OIDC nonce validation
3. **JWT Strategy**: Use `session: { strategy: "jwt" }` for token-based sessions
4. **Claims Handling**: Extract and store the pseudonym from ID token claims

## Session Data

After successful authentication, your session will contain:
```typescript
{
  "user": {},  // Empty by default
  "expires": "2025-03-20T02:01:46.154Z",
  "pseudonym": "user_MzUHnPBcwhQnIXbQPoiCZ7aUyxNyKbO2tlWTQGUw-Pk"
}
```

The `pseudonym` is a stable identifier for this user in your application.

## Best Practices

1. **Environment Variables**
   - Store client credentials in `.env`:
     ```env
     PSEUDOIDC_CLIENT_ID=client_xxx...
     PSEUDOIDC_CLIENT_SECRET=secret_xxx...
     ```
   - Never commit these values to version control

2. **Security**
   - Use HTTPS in production
   - Keep client secret secure
   - Don't share pseudonyms between applications

3. **Error Handling**
   - Add error pages for authentication failures
   - Handle session expiration gracefully

## Optional Features

1. **Debug Mode**
   ```typescript
   export const { handlers, auth, signIn, signOut } = NextAuth({
     debug: true,  // Enable detailed logs
     // ...
   })
   ```

2. **Custom Storage**
   ```typescript
   import { createStorage } from "unstorage"
   import { UnstorageAdapter } from "@auth/unstorage-adapter"
   
   const storage = createStorage({
     // Configure your storage backend
   })
   
   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: UnstorageAdapter(storage),
     // ...
   })
   ```

## Getting Help

1. Check [common issues](https://github.com/OpenAgentsInc/pseudoidc/issues)
2. Join our Discord for developer support
3. Contact support@scramblesolutions.com