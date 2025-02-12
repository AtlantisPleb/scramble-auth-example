# Integrating with PseudOIDC

This guide shows how to integrate PseudOIDC with your application. PseudOIDC is a privacy-focused OIDC provider that gives you flexibility in how you handle user data.

## Quick Start

1. Get your OAuth credentials (we'll create these for you):
```
CLIENT_ID=client_tuK5lXqCJIAqkPrEOn6DTWAaxIzr1y1l
CLIENT_SECRET=secret_8Qm5lXqCJIAqkPrEOn6DTWAaxIzr2y1l
```

2. Configure OIDC endpoints:
```
AUTHORIZATION_URL=https://auth.scramblesolutions.com/oauth2/auth
TOKEN_URL=https://auth.scramblesolutions.com/oauth2/token
```

## Integration Options

You have two main options for handling user identity:

### Option 1: Store Email (Standard Setup)
```typescript
// Request both 'openid' and 'email' scopes
const scopes = ['openid', 'email']

// You'll receive:
{
  sub: 'user_8zHkwRfa...',  // Stable pseudonym for this user
  email: 'user@example.com'  // User's email address
}
```

### Option 2: Email-less (Maximum Privacy)
```typescript
// Request only 'openid' scope
const scopes = ['openid']

// You'll receive:
{
  sub: 'user_8zHkwRfa...'  // Stable pseudonym for this user
}
```

## Framework Examples

### Next.js (with NextAuth.js)

1. Install NextAuth:
```bash
npm install next-auth
```

2. Create auth configuration (`pages/api/auth/[...nextauth].ts`):
```typescript
import NextAuth from 'next-auth'
import { OAuthConfig } from 'next-auth/providers'

// PseudOIDC provider configuration
const PseudOIDCProvider: OAuthConfig<any> = {
  id: 'pseudoidc',
  name: 'PseudOIDC',
  type: 'oauth',
  wellKnown: 'https://auth.scramblesolutions.com/.well-known/openid-configuration',
  authorization: { params: { scope: 'openid email' } },
  clientId: process.env.PSEUDOIDC_CLIENT_ID,
  clientSecret: process.env.PSEUDOIDC_CLIENT_SECRET,
  idToken: true,
  profile(profile) {
    return {
      id: profile.sub,           // Use pseudonym as internal ID
      email: profile.email,      // Optional: store email if requested
      emailVerified: true,       // Email is verified by our service
    }
  },
}

export default NextAuth({
  providers: [PseudOIDCProvider],
  callbacks: {
    async session({ session, token }) {
      // Add pseudonym to session if needed
      session.pseudonym = token.sub
      return session
    },
  },
})
```

3. Use in your components:
```typescript
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Header() {
  const { data: session } = useSession()

  if (session) {
    return (
      <>
        {/* Option 1: With email */}
        Welcome {session.user.email}!

        {/* Option 2: Email-less */}
        User {session.pseudonym} logged in!

        <button onClick={() => signOut()}>Sign out</button>
      </>
    )
  }
  return (
    <button onClick={() => signIn('pseudoidc')}>Sign in</button>
  )
}
```

### React (with OIDC-Client)

1. Install dependencies:
```bash
npm install oidc-client-ts
```

2. Configure OIDC client:
```typescript
import { UserManager } from 'oidc-client-ts'

const oidcConfig = {
  authority: 'https://auth.scramblesolutions.com',
  client_id: process.env.PSEUDOIDC_CLIENT_ID,
  client_secret: process.env.PSEUDOIDC_CLIENT_SECRET,
  redirect_uri: 'http://localhost:3000/callback',
  response_type: 'code',
  scope: 'openid email',  // Remove email for maximum privacy
}

export const userManager = new UserManager(oidcConfig)
```

3. Create login component:
```typescript
import { useEffect, useState } from 'react'
import { userManager } from './oidc-config'

export function Login() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    userManager.getUser().then(setUser)
  }, [])

  const login = () => userManager.signinRedirect()
  const logout = () => userManager.signoutRedirect()

  if (user) {
    return (
      <div>
        {/* Option 1: With email */}
        <p>Welcome {user.profile.email}!</p>

        {/* Option 2: Email-less */}
        <p>User {user.profile.sub} logged in!</p>

        <button onClick={logout}>Logout</button>
      </div>
    )
  }

  return <button onClick={login}>Login</button>
}
```

### Express.js (with Passport)

1. Install dependencies:
```bash
npm install passport passport-openidconnect
```

2. Configure Passport:
```typescript
import passport from 'passport'
import { Strategy } from 'passport-openidconnect'

passport.use('pseudoidc', new Strategy({
  issuer: 'https://auth.scramblesolutions.com',
  authorizationURL: 'https://auth.scramblesolutions.com/oauth2/auth',
  tokenURL: 'https://auth.scramblesolutions.com/oauth2/token',
  clientID: process.env.PSEUDOIDC_CLIENT_ID,
  clientSecret: process.env.PSEUDOIDC_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/callback',
  scope: ['openid', 'email']  // Remove email for maximum privacy
}, (issuer, profile, done) => {
  return done(null, {
    id: profile.sub,           // Use pseudonym as internal ID
    email: profile.email       // Optional: store email if requested
  })
}))

// Session serialization
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))
```

3. Add auth routes:
```typescript
app.get('/auth/login', passport.authenticate('pseudoidc'))

app.get('/auth/callback',
  passport.authenticate('pseudoidc', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
)
```

## Database Schema Examples

### Option 1: With Email
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- Store the pseudonym (sub claim)
  email TEXT UNIQUE,            -- Store the email if needed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Option 2: Email-less
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,          -- Store only the pseudonym
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Common Patterns

### User Profile Storage
```typescript
// After successful authentication:
async function handleAuth(tokens) {
  const { sub, email } = tokens.claims

  // Option 1: Store email
  await db.query(
    'INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [sub, email]
  )

  // Option 2: Email-less
  await db.query(
    'INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING',
    [sub]
  )
}
```

### User Lookup
```typescript
// The pseudonym (sub) is stable per user per client
async function getUser(pseudonym) {
  const user = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [pseudonym]
  )
  return user
}
```

### Migration from Existing Auth
```typescript
// If you have existing users, you can:
// 1. Add PseudOIDC as additional login option
// 2. Link accounts when users use both
async function linkAccounts(existingUserId, pseudonym, email) {
  await db.query(
    'UPDATE users SET pseudoidc_id = $1 WHERE id = $2 AND email = $3',
    [pseudonym, existingUserId, email]
  )
}
```

## Best Practices

1. **Pseudonym Handling**
   - Store the pseudonym (`sub` claim) as the user identifier
   - It's stable for each user per client application
   - Different apps get different pseudonyms for same user

2. **Email Usage**
   - Only request email scope if you need it
   - Consider storing email separately from core user data
   - Allow users to delete their email while keeping account

3. **Security**
   - Store client secret securely
   - Use HTTPS for all endpoints
   - Validate tokens on backend
   - Don't share pseudonyms between applications

4. **Privacy**
   - Start with minimal scopes
   - Add claims only as needed
   - Allow users to control data sharing
   - Document what you store and why

## Getting Help

1. Check common issues in our FAQ
2. Join our Discord for developer support
3. Open an issue on GitHub
4. Contact support@scramblesolutions.com

## What's Next

Coming soon:
1. Additional claims (KYC status, age verification, etc.)
2. Admin dashboard for client management
3. Enhanced privacy controls
4. Analytics and monitoring tools
