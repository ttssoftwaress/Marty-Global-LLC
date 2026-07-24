import { createBrowserRouter, Outlet } from 'react-router-dom';

// Portal sections the sidebar links to that have no screen yet. Paths are
// relative to `/app` and mirror PORTAL_NAV_ITEMS in
// portal/components/sidebar/nav-items.ts — keep the two in sync.
const PORTAL_PLACEHOLDER_ROUTES = [
  { path: 'documents', title: 'Documents' },
  { path: 'support', title: 'Support' },
  // Billing sub-flows the billing screen links to whose screens (the branded
  // Stripe checkout / add-card) are not built yet — placeholders keep the links
  // inside the portal instead of falling through to marketing.
  { path: 'billing/pay/:quoteId', title: 'Checkout' },
  { path: 'billing/methods/new', title: 'Add payment method' },
  // Mail-room sub-flows the mail-room screens link to (the add-room wizard)
  // whose screens are not built yet — placeholders keep the links inside the
  // portal instead of falling through to marketing.
  { path: 'mailroom/new', title: 'Add new room' },
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
    // The password-reset screens are part of the logged-out auth flow, so — like
    // /login and /signup — a live session is redirected away to /app.
    path: '/reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import('@/auth/ResetPasswordPage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <ResetPasswordPage />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
  {
    path: '/reset-password/new',
    lazy: async () => {
      const { SetNewPasswordPage } = await import('@/auth/SetNewPasswordPage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <SetNewPasswordPage />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
  {
    path: '/check-your-email',
    lazy: async () => {
      const { CheckYourEmailPage } = await import('@/auth/CheckYourEmailPage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <CheckYourEmailPage />
          </RedirectIfAuthenticated>
        ),
      };
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
      {
        path: 'orders',
        lazy: async () => {
          const { OrdersPage } = await import('@/portal/pages/OrdersPage');
          return { Component: OrdersPage };
        },
      },
      {
        // Single order detail — the "View order" action on the list routes here.
        path: 'orders/:orderId',
        lazy: async () => {
          const { OrderDetailPage } = await import('@/portal/pages/OrderDetailPage');
          return { Component: OrderDetailPage };
        },
      },
      {
        // Order a new service — Step 1 (Select services). The catalog is
        // admin-defined and loads from the backend once that endpoint lands.
        path: 'order',
        lazy: async () => {
          const { OrderNewServicePage } = await import(
            '@/portal/pages/OrderNewServicePage'
          );
          return { Component: OrderNewServicePage };
        },
      },
      {
        // Order a new service — Step 2 (Application details). Reaches here from
        // Step 1's Continue, carrying the selected service ids in router state;
        // a direct visit with no selection redirects back to Step 1.
        path: 'order/details',
        lazy: async () => {
          const { OrderApplicationDetailsPage } = await import(
            '@/portal/pages/OrderApplicationDetailsPage'
          );
          return { Component: OrderApplicationDetailsPage };
        },
      },
      {
        // Order a new service — Step 3 (Application submitted). Reaches here from
        // Step 2's Submit, carrying the confirmation payload in router state; a
        // direct visit with no confirmation redirects to the orders list.
        path: 'order/submitted',
        lazy: async () => {
          const { OrderConfirmationPage } = await import(
            '@/portal/pages/OrderConfirmationPage'
          );
          return { Component: OrderConfirmationPage };
        },
      },
      {
        // Account settings — the Profile-info frame (other sections show a
        // "coming soon" panel in the same shell). `?section=` selects the active
        // section and drives the mobile master/detail drill-in.
        path: 'settings',
        lazy: async () => {
          const { AccountSettingsPage } = await import(
            '@/portal/pages/AccountSettingsPage'
          );
          return { Component: AccountSettingsPage };
        },
      },
      {
        // Notifications — the customer's full feed with filter tabs, date
        // grouping, and cursor pagination (the top bar's "View all
        // notifications" links here). Data loads from the backend once the
        // `notifications` endpoints land.
        path: 'notifications',
        lazy: async () => {
          const { NotificationsPage } = await import(
            '@/portal/pages/NotificationsPage'
          );
          return { Component: NotificationsPage };
        },
      },
      {
        // Billing & payments — quotes awaiting payment, payment history, and
        // saved cards. Data loads from the backend once those endpoints land.
        path: 'billing',
        lazy: async () => {
          const { BillingPage } = await import('@/portal/pages/BillingPage');
          return { Component: BillingPage };
        },
      },
      {
        // Messages — the customer's conversations with the team (the portal face
        // of the live-chat / support module). The list-only and open-thread views
        // share one screen; the conversation id in the URL selects the thread and
        // drives the mobile master/detail. Data loads from the backend later.
        path: 'messages',
        lazy: async () => {
          const { MessagesPage } = await import('@/portal/pages/MessagesPage');
          return { Component: MessagesPage };
        },
      },
      {
        // A single conversation open — the same Messages screen with that thread
        // selected, so the view deep-links and Back returns to the list (the
        // mobile thread header carries the back control).
        path: 'messages/:conversationId',
        lazy: async () => {
          const { MessagesPage } = await import('@/portal/pages/MessagesPage');
          return { Component: MessagesPage };
        },
      },
      {
        // Virtual mail rooms — KPI figures and the grid of the customer's rooms.
        // Data loads from the backend once that endpoint lands.
        path: 'mailroom',
        lazy: async () => {
          const { MailRoomPage } = await import('@/portal/pages/MailRoomPage');
          return { Component: MailRoomPage };
        },
      },
      {
        // A single mail room's inbox — the scanned-mail list with its KPI
        // figures, view switch, and filters. Data loads from the backend once
        // those endpoints land.
        path: 'mailroom/:roomId',
        lazy: async () => {
          const { MailRoomInboxPage } = await import(
            '@/portal/pages/MailRoomInboxPage'
          );
          return { Component: MailRoomInboxPage };
        },
      },
      {
        // A mail item opened from the inbox — the same inbox screen with the
        // item slide-over on top, so the view deep-links and Back/Esc return
        // to the list.
        path: 'mailroom/:roomId/:itemId',
        lazy: async () => {
          const { MailRoomInboxPage } = await import(
            '@/portal/pages/MailRoomInboxPage'
          );
          return { Component: MailRoomInboxPage };
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
