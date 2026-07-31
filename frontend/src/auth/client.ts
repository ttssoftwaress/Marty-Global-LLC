import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Better Auth client — points at the backend auth handler (VITE_AUTH_URL is the
// API origin; Better Auth appends its own /api/auth base path). The admin plugin
// mirrors the server so roles are typed. The user table carries no custom fields,
// so there is nothing to infer. Backend is the source of truth — keep these
// plugins in sync with backend/src/config/auth.ts.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL as string,
  plugins: [adminClient()],
});

export const { signUp, signIn, signOut, useSession } = authClient;
