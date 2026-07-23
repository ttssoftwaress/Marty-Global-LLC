import { createBrowserRouter, Outlet } from 'react-router-dom';

// Portal sections the sidebar links to that have no screen yet. Paths are
// relative to `/app` and mirror PORTAL_NAV_ITEMS in
// portal/components/sidebar/nav-items.ts — keep the two in sync.
const PORTAL_PLACEHOLDER_ROUTES = [
  { path: 'orders', title: 'My orders' },
  { path: 'order', title: 'Order new service' },
  { path: 'documents', title: 'Documents' },
  { path: 'mailroom', title: 'Virtual mail rooms' },
  { path: 'messages', title: 'Messages' },
  { path: 'billing', title: 'Billing & payments' },
  { path: 'settings', title: 'Account settings' },
  { path: 'support', title: 'Support' },
];

export const router = createBrowserRouter([
  {
    path: '/',
    lazy: async () => {
      const { HomePage } = await import('@/marketing/pages/HomePage');
      return { Component: HomePage };
    },
  },
  {
    path: '/services',
    lazy: async () => {
      const { ServicesPage } = await import('@/marketing/pages/ServicesPage');
      return { Component: ServicesPage };
    },
  },
  {
    path: '/how-it-works',
    lazy: async () => {
      const { HowItWorksPage } = await import('@/marketing/pages/HowItWorksPage');
      return { Component: HowItWorksPage };
    },
  },
  {
    path: '/about',
    lazy: async () => {
      const { AboutPage } = await import('@/marketing/pages/AboutPage');
      return { Component: AboutPage };
    },
  },
  {
    path: '/contact',
    lazy: async () => {
      const { ContactPage } = await import('@/marketing/pages/ContactPage');
      return { Component: ContactPage };
    },
  },
  {
    // Marketing "Get Started" CTAs land here; it redirects to /login or /signup
    // based on whether an account was created on this device. An already
    // logged-in visitor is sent to their default landing instead.
    path: '/get-started',
    lazy: async () => {
      const { GetStartedRedirect } = await import('@/auth/GetStartedRedirect');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <GetStartedRedirect />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
  {
    // Auth screens are for logged-out visitors only; a live session (e.g. the
    // persistent "Remember Me" cookie) redirects away from here.
    path: '/login',
    lazy: async () => {
      const { LogInPage } = await import('@/auth/LogInPage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <LogInPage />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
  {
    path: '/signup',
    lazy: async () => {
      const { SignUpPage } = await import('@/auth/SignUpPage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <SignUpPage />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
  {
    path: '/reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import('@/auth/ResetPasswordPage');
      return { Component: ResetPasswordPage };
    },
  },
  {
    path: '/reset-password/new',
    lazy: async () => {
      const { SetNewPasswordPage } = await import('@/auth/SetNewPasswordPage');
      return { Component: SetNewPasswordPage };
    },
  },
  {
    path: '/check-your-email',
    lazy: async () => {
      const { CheckYourEmailPage } = await import('@/auth/CheckYourEmailPage');
      return { Component: CheckYourEmailPage };
    },
  },
  {
    // Customer portal — the whole `/app` group sits behind the session guard,
    // which sends anyone without one to /login. The dashboard is the index
    // screen, so a successful login lands on `/app`.
    path: '/app',
    lazy: async () => {
      const { RequireAuth } = await import('@/auth/RequireAuth');
      return {
        Component: () => (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
      };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { DashboardPage } = await import('@/portal/pages/DashboardPage');
          return { Component: DashboardPage };
        },
      },
      // The sidebar links to every portal section; their screens are not built
      // yet, so each renders the shell with a placeholder instead of falling
      // through to the catch-all and dropping the user back on marketing.
      ...PORTAL_PLACEHOLDER_ROUTES.map(({ path, title }) => ({
        path,
        lazy: async () => {
          const { PortalPlaceholderPage } = await import(
            '@/portal/pages/PortalPlaceholderPage'
          );
          return { Component: () => <PortalPlaceholderPage title={title} /> };
        },
      })),
    ],
  },
  {
    // Admin portal — the whole `/admin` group sits behind the role guard, which
    // sends a visitor with no session to /login and a signed-in customer back to
    // their own portal. Staff and admin both get in; admin-only screens narrow
    // it further as they land (AGENTS.md "Auth").
    path: '/admin',
    lazy: async () => {
      const { RequireRole } = await import('@/auth/RequireRole');
      const { STAFF_ROLES } = await import('@/constants/roles');
      return {
        Component: () => (
          <RequireRole allowed={STAFF_ROLES}>
            <Outlet />
          </RequireRole>
        ),
      };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { AdminPlaceholderPage } = await import('@/admin/pages/AdminPlaceholderPage');
          return { Component: () => <AdminPlaceholderPage title="Admin" /> };
        },
      },
    ],
  },
  {
    path: '*',
    lazy: async () => {
      const { HomePage } = await import('@/marketing/pages/HomePage');
      return { Component: HomePage };
    },
  },
]);
