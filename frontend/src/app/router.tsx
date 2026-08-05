import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom';

import { RouteErrorFallback } from './RouteErrorFallback';

// Portal sections the sidebar links to that have no screen yet. Paths are
// relative to `/app` and mirror PORTAL_NAV_ITEMS in
// portal/components/sidebar/nav-items.ts — keep the two in sync.
//
// Empty: the add-room wizard placeholder was removed — a mail room is bought
// like any other service, so "Add new room" now routes into the order flow
// (`/app/order`) instead of a wizard of its own. Kept rather than deleted
// because the next section to be scaffolded needs somewhere to land, and the
// mapping below already handles it.
const PORTAL_PLACEHOLDER_ROUTES: { path: string; title: string }[] = [];

// Admin sections the sidebar links to that have no screen yet. Paths are
// relative to `/admin` and mirror ADMIN_NAV_ITEMS in
// admin/components/sidebar/nav-items.ts — keep the two in sync.
//
// Empty: every admin section now has a real screen. Kept rather than deleted
// because the next section to be scaffolded needs somewhere to land, and the
// mapping below already handles it.
const ADMIN_PLACEHOLDER_ROUTES: { path: string; title: string }[] = [];

const routes: RouteObject[] = [
  {
    /*
     * The public marketing pages, grouped under a pathless parent so the
     * live-chat bubble mounts once for the whole site. Per-page it would drop
     * its socket and close its panel on every navigation — mid-conversation.
     * Navbar and Footer stay per-page, as they were.
     *
     * The whole group is logged-out-only. Marketing exists to sell to a visitor
     * who has no account yet; a signed-in customer landing on it gets a page of
     * "Get Started" CTAs for something they already bought, so a live session is
     * sent to that role's portal instead. The legal documents are deliberately
     * NOT in here — see the group below.
     */
    lazy: async () => {
      const { PublicChrome } = await import('@/marketing/components/shared/PublicChrome');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <PublicChrome />
          </RedirectIfAuthenticated>
        ),
      };
    },
    children: [
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
        // The per-service detail pages, one per `/services/<slug>` the Services
        // grid links to. Registered Agent has no card of its own — it is sold
        // with formation and linked from the note under the grid.
        path: '/services/formation',
        lazy: async () => {
          const { ServiceFormationPage } = await import(
            '@/marketing/pages/ServiceFormationPage'
          );
          return { Component: ServiceFormationPage };
        },
      },
      {
        path: '/services/mailroom',
        lazy: async () => {
          const { ServiceMailRoomPage } = await import(
            '@/marketing/pages/ServiceMailRoomPage'
          );
          return { Component: ServiceMailRoomPage };
        },
      },
      {
        path: '/services/ecommerce',
        lazy: async () => {
          const { ServiceEcommercePage } = await import(
            '@/marketing/pages/ServiceEcommercePage'
          );
          return { Component: ServiceEcommercePage };
        },
      },
      {
        path: '/services/banking',
        lazy: async () => {
          const { ServiceBankingPage } = await import(
            '@/marketing/pages/ServiceBankingPage'
          );
          return { Component: ServiceBankingPage };
        },
      },
      {
        path: '/services/website',
        lazy: async () => {
          const { ServiceWebsitePage } = await import(
            '@/marketing/pages/ServiceWebsitePage'
          );
          return { Component: ServiceWebsitePage };
        },
      },
      {
        // Remote Desktop is not one of the four grid cards either — the grid is
        // the company-setup services. The footer links here.
        path: '/services/remote-desktop',
        lazy: async () => {
          const { ServiceRemoteDesktopPage } = await import(
            '@/marketing/pages/ServiceRemoteDesktopPage'
          );
          return { Component: ServiceRemoteDesktopPage };
        },
      },
      {
        // Registered Agent has no card on the Services grid — it is sold with
        // formation and named in the note under the grid, which links here.
        path: '/services/registered-agent',
        lazy: async () => {
          const { ServiceRegisteredAgentPage } = await import(
            '@/marketing/pages/ServiceRegisteredAgentPage'
          );
          return { Component: ServiceRegisteredAgentPage };
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
        // The full question library. The short FaqSection accordions on home,
        // services, and how-it-works close with a link here; each topic group
        // is an anchor, so `/faq#billing` deep-links from anywhere.
        path: '/faq',
        lazy: async () => {
          const { FaqPage } = await import('@/marketing/pages/FaqPage');
          return { Component: FaqPage };
        },
      },
    ],
  },
  {
    /*
     * The three legal documents, in their own group because they are the one
     * part of the public site a signed-in customer must still be able to open.
     * They are open to EVERYONE — a visitor has to be able to read the terms
     * before deciding to sign up, and a customer has to be able to read the
     * terms they are already bound by and change their cookie consent after it.
     * Redirecting them to /app here would mean the only way to reach the privacy
     * policy is to log out.
     *
     * Same PublicChrome parent as marketing, so they keep the shared hash-scroll
     * and page transition; the chrome hides the guest chat bubble for a
     * signed-in reader, whose conversations live in the portal instead.
     */
    lazy: async () => {
      const { PublicChrome } = await import('@/marketing/components/shared/PublicChrome');
      return { Component: PublicChrome };
    },
    children: [
      {
        // The three legal documents the footer links from every public page.
        path: '/legal/privacy',
        lazy: async () => {
          const { PrivacyPolicyPage } = await import(
            '@/marketing/pages/PrivacyPolicyPage'
          );
          return { Component: PrivacyPolicyPage };
        },
      },
      {
        path: '/legal/terms',
        lazy: async () => {
          const { TermsOfServicePage } = await import(
            '@/marketing/pages/TermsOfServicePage'
          );
          return { Component: TermsOfServicePage };
        },
      },
      {
        // Labelled "Cookie Settings" in the footer: the page leads with the
        // working consent controls, then documents each category.
        path: '/legal/cookies',
        lazy: async () => {
          const { CookiePolicyPage } = await import(
            '@/marketing/pages/CookiePolicyPage'
          );
          return { Component: CookiePolicyPage };
        },
      },
    ],
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
    /*
     * The one auth screen NOT behind RedirectIfAuthenticated. It carries a
     * one-time token in `?token=`, and someone who forgot their password on one
     * device commonly opens the emailed link on another that still holds a
     * "Remember Me" session. Redirecting them to /app would burn the reset with
     * no explanation, so this step always renders and consumes its token.
     */
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
        /*
         * Documents — every file the customer has, in one library: what we filed
         * for them, what they attached to an application, and their scanned
         * mail. The backend gathers these from the three sources that already
         * own files rather than from a documents table, so each row links back
         * to the order, record, or mail item it belongs to.
         */
        path: 'documents',
        lazy: async () => {
          const { DocumentsPage } = await import('@/portal/pages/DocumentsPage');
          return { Component: DocumentsPage };
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
        // Checkout — where a quote becomes a payment. "Pay now" on the billing
        // screen routes here with the quote id. The screen reads the quote from
        // `GET /v1/payments/quotes/:quoteId`, creates the intent through
        // `POST /v1/payments/intents`, then polls `GET /v1/payments/:paymentId`
        // while the backend's TronGrid poller settles the transfer.
        path: 'billing/pay/:quoteId',
        lazy: async () => {
          const { CheckoutPage } = await import('@/portal/pages/CheckoutPage');
          return { Component: CheckoutPage };
        },
      },
      {
        // Support — the customer's conversations with the team (the portal face
        // of the live-chat / support module). Conversations are the only thing
        // here, so they get no page of their own: this IS that screen. The
        // list-only and open-thread views share one route; the conversation id
        // in the URL selects the thread and drives the mobile master/detail.
        path: 'support',
        lazy: async () => {
          const { SupportPage } = await import('@/portal/pages/SupportPage');
          return { Component: SupportPage };
        },
      },
      {
        // A single conversation open — the same Support screen with that thread
        // selected, so the view deep-links and Back returns to the list (the
        // mobile thread header carries the back control).
        path: 'support/:conversationId',
        lazy: async () => {
          const { SupportPage } = await import('@/portal/pages/SupportPage');
          return { Component: SupportPage };
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
      {
        /*
         * One delivered record — a formed company, a registration. Mounted
         * ahead of `services/:slug` so the literal `record` segment is not
         * swallowed by it.
         *
         * A record sits outside its service's path because it is reached from
         * several places (the list, a notification, an order) and does not need
         * to know which page the customer came through — its breadcrumb links
         * back to the service.
         */
        path: 'services/record/:resultId',
        lazy: async () => {
          const { ServiceRecordDetailPage } = await import(
            '@/portal/pages/ServiceRecordDetailPage'
          );
          return { Component: ServiceRecordDetailPage };
        },
      },
      {
        /*
         * A service's delivered records — "My companies", "My registrations".
         *
         * ONE route serves every service: the heading, the table's columns, and
         * the noun all arrive with the data, so a new service with a result
         * schema gets a working page the moment its first record is delivered.
         * That is the whole point of the dynamic surface — no route per service,
         * no deploy.
         */
        path: 'services/:slug',
        lazy: async () => {
          const { ServiceRecordsPage } = await import(
            '@/portal/pages/ServiceRecordsPage'
          );
          return { Component: ServiceRecordsPage };
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
        // Admin dashboard — the staff home screen: KPI figures, the
        // orders-by-status breakdown, the activity feed, and the needs-attention
        // queue, all scoped to the selected period. Data loads from
        // `GET /v1/admin/dashboard/summary` once that endpoint lands.
        index: true,
        lazy: async () => {
          const { AdminDashboardPage } = await import(
            '@/admin/pages/AdminDashboardPage'
          );
          return { Component: AdminDashboardPage };
        },
      },
      {
        // Orders queue — the staff screen for working every customer order:
        // status tabs with counts, search and the service / region / date
        // filters, then the queue itself (a table at `md` and up, cards on
        // mobile). Data loads from `GET /v1/admin/orders` and
        // `GET /v1/admin/orders/summary` once those endpoints land.
        path: 'orders',
        lazy: async () => {
          const { AdminOrdersQueuePage } = await import(
            '@/admin/pages/AdminOrdersQueuePage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="orders" title="Orders queue">
                <AdminOrdersQueuePage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // A single order, staff-side — the screen where an order is actually
        // worked: the customer's answers, the documents, the activity feed with
        // its reply composer, and the status / assignee controls. Every admin
        // list links here, because this is the route the backend returns as an
        // order's `to`. Data loads from `GET /v1/admin/orders/:orderId`; the two
        // writes are `PATCH /v1/admin/orders/:orderId` and
        // `POST /v1/admin/orders/:orderId/activity`.
        path: 'orders/:orderId',
        lazy: async () => {
          const { AdminOrderDetailPage } = await import(
            '@/admin/pages/AdminOrderDetailPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="orders" title="Orders queue">
                <AdminOrderDetailPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        /*
         * Service requests — the follow-ups customers raise against a delivered
         * record. Its own `requests` area rather than part of `orders`, because
         * it is a different job: an order is worked once and filed, while a
         * request is small after-sales work against something already
         * delivered. Data loads from `GET /v1/admin/requests`.
         */
        path: 'requests',
        lazy: async () => {
          const { AdminRequestsPage } = await import(
            '@/admin/pages/AdminRequestsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="requests" title="Service requests">
                <AdminRequestsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        /*
         * The marketing contact form's queue. Its own `leads` area rather than
         * `support`, because a lead isn't a conversation — there is no reply
         * thread, only the record and whether someone has followed up. Data
         * loads from `GET /v1/admin/leads`; the only write is
         * `PATCH /v1/admin/leads/:id/handled`.
         */
        path: 'leads',
        lazy: async () => {
          const { AdminLeadsPage } = await import('@/admin/pages/AdminLeadsPage');
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="leads" title="Leads">
                <AdminLeadsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        /*
         * One request — its intake answers, its workflow controls, the record it
         * concerns (editable in place), and the order's conversation. Reads
         * `GET /v1/admin/requests/:requestId`; writes are
         * `PATCH /v1/admin/requests/:requestId` and
         * `PUT /v1/admin/requests/:requestId/result`.
         */
        path: 'requests/:requestId',
        lazy: async () => {
          const { AdminRequestDetailPage } = await import(
            '@/admin/pages/AdminRequestDetailPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="requests" title="Service requests">
                <AdminRequestDetailPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // My conversations — the order threads assigned to this staff member,
        // distinct from the shared support inbox. Gated on `orders` rather than
        // `support`, matching the backend route: answering a customer about
        // their filing is part of working the order. Data loads from
        // `GET /v1/admin/conversations`.
        path: 'conversations',
        lazy: async () => {
          const { AdminConversationsPage } = await import(
            '@/admin/pages/AdminConversationsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="orders" title="My conversations">
                <AdminConversationsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Notifications — the staff member's own full feed with filter tabs for
        // the work queues (orders, payments, support, mail room), date grouping,
        // and cursor pagination. The top bar's bell panel links here with "View
        // all notifications". Not permission-gated: it is the member's own
        // inbox, which is why the backend route isn't narrowed either.
        path: 'notifications',
        lazy: async () => {
          const { AdminNotificationsPage } = await import(
            '@/admin/pages/AdminNotificationsPage'
          );
          return { Component: AdminNotificationsPage };
        },
      },
      {
        // Customers list — every customer account, with segment tabs, region
        // and search filters, then the list itself (a table at `md` and up,
        // cards on mobile). Data loads from `GET /v1/admin/customers` and
        // `GET /v1/admin/customers/summary` once those endpoints land.
        path: 'customers',
        lazy: async () => {
          const { AdminCustomersPage } = await import(
            '@/admin/pages/AdminCustomersPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="customers" title="Customers">
                <AdminCustomersPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // A single customer's record — identity, the four KPI figures, and the
        // section tabs (only Orders has a built panel so far; `?tab=` selects it
        // so a section deep-links). Reached from the customers list' "View
        // profile" action. Data loads from
        // `GET /v1/admin/customers/:customerId` and
        // `GET /v1/admin/customers/:customerId/orders` once those endpoints land.
        path: 'customers/:customerId',
        lazy: async () => {
          const { AdminCustomerDetailPage } = await import(
            '@/admin/pages/AdminCustomerDetailPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="customers" title="Customers">
                <AdminCustomerDetailPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Quotes & payments — revenue KPIs, the revenue-over-time chart, the
        // billing ledger (a table at `md` and up, cards on mobile) with its
        // status filter tabs, and the unattributed-transfer queue. Data loads
        // from `GET /v1/admin/payments/summary`, `/payments/revenue`,
        // `/payments/ledger`, and `/payments/unmatched`.
        path: 'payments',
        lazy: async () => {
          const { AdminQuotesPaymentsPage } = await import(
            '@/admin/pages/AdminQuotesPaymentsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="payments" title="Quotes & payments">
                <AdminQuotesPaymentsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Support inbox — the staff screen for every customer conversation: the
        // filterable thread list and the open thread's messages, internal notes,
        // and composer (the admin face of the live-chat / support module). The
        // list-only and open-thread views share one screen; `?filter=` selects
        // the cohort. Data loads from `GET /v1/admin/support/conversations` once
        // those endpoints land.
        path: 'support',
        lazy: async () => {
          const { AdminSupportInboxPage } = await import(
            '@/admin/pages/AdminSupportInboxPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="support" title="Support inbox">
                <AdminSupportInboxPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // A single conversation open — the same Support inbox screen with that
        // thread selected, so the view deep-links and Back returns to the list
        // (the mobile thread header carries the back control).
        path: 'support/:conversationId',
        lazy: async () => {
          const { AdminSupportInboxPage } = await import(
            '@/admin/pages/AdminSupportInboxPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="support" title="Support inbox">
                <AdminSupportInboxPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Reports & analytics — the performance screen: headline KPIs with
        // sparklines, revenue over time, the orders-by-service and
        // orders-by-region donuts, the conversion funnel, and customer growth.
        // One period pill strip scopes the whole page. Data loads from
        // `GET /v1/admin/reports/summary`, `/reports/revenue`,
        // `/reports/breakdown/:dimension`, `/reports/funnel`, and
        // `/reports/growth` once those endpoints land.
        path: 'reports',
        lazy: async () => {
          const { AdminReportsAnalyticsPage } = await import(
            '@/admin/pages/AdminReportsAnalyticsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="reports" title="Reports & analytics">
                <AdminReportsAnalyticsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Service catalog & pricing — the staff screen for what each service
        // includes, where it's offered, and how it's priced: the catalog table
        // (cards on mobile) plus the add/manage form, which also authors the
        // per-service application questions the portal's order flow renders.
        // Data loads from `GET /v1/admin/catalog/services`,
        // `/catalog/services/:id`, and `/catalog/regions`, and writes through
        // `POST`/`PATCH /v1/admin/catalog/services` once those endpoints land.
        path: 'catalog',
        lazy: async () => {
          const { AdminServiceCatalogPage } = await import(
            '@/admin/pages/AdminServiceCatalogPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="catalog" title="Service catalog">
                <AdminServiceCatalogPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Form fields — the field registry every service form is built from.
        // An admin registers a question once here (label, answer type, and its
        // per-type settings), and the service form builder then picks from this
        // list rather than re-authoring the question, which is what keeps the
        // answer keys a closed set. Data loads from `GET /v1/admin/fields` and
        // writes through `POST`/`PATCH /v1/admin/fields`.
        path: 'fields',
        lazy: async () => {
          const { AdminFormFieldsPage } = await import(
            '@/admin/pages/AdminFormFieldsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="catalog" title="Form fields">
                <AdminFormFieldsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // One service in full — its description, what's included, the regions
        // it's offered in, its pricing templates, and the request form (the
        // steps and fields a customer fills in to order it, which the portal's
        // order flow renders). Reached from the catalog list' "Manage" action.
        // Data loads from `GET /v1/admin/catalog/services/:id` and
        // `/catalog/regions`, and writes through
        // `PATCH /v1/admin/catalog/services/:id` once those endpoints land.
        path: 'catalog/:serviceId',
        lazy: async () => {
          const { AdminServiceCatalogDetailPage } = await import(
            '@/admin/pages/AdminServiceCatalogDetailPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="catalog" title="Service catalog">
                <AdminServiceCatalogDetailPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Team & staff — the internal team, their roles, and their access: the
        // three KPI figures, the search / role / status filters, then the list
        // itself (a table at `md` and up, cards on mobile). Data loads from
        // `GET /v1/admin/team` and `GET /v1/admin/team/summary` once those
        // endpoints land.
        path: 'team',
        lazy: async () => {
          const { AdminTeamStaffPage } = await import(
            '@/admin/pages/AdminTeamStaffPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="team" title="Team & staff">
                <AdminTeamStaffPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // Virtual mail ops — filing scanned mail into mail room inboxes: the
        // three KPI figures, the section tabs, then the room picker (name, then
        // address — a name is not unique), the scan form, and the
        // recently-uploaded feed (a right rail on desktop, a card beneath the
        // form on the narrower links). Data loads from
        // `GET /v1/admin/mailroom/summary`, `/mailroom/rooms/names`,
        // `/mailroom/rooms`, and `/mailroom/scans`, with
        // `POST /v1/admin/mailroom/scans` filing a scan.
        path: 'mailroom',
        lazy: async () => {
          const { AdminVirtualMailOpsPage } = await import(
            '@/admin/pages/AdminVirtualMailOpsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="mailroom" title="Virtual mail ops">
                <AdminVirtualMailOpsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        // One team member's account in full — their details, whether the account
        // is enabled, the role they hold, and their per-area admin access.
        // Reached from the team list's "Edit" action. Data loads from
        // `GET /v1/admin/team/:memberId` and writes through
        // `PATCH /v1/admin/team/:memberId` once those endpoints land.
        path: 'team/:memberId/edit',
        lazy: async () => {
          const { AdminTeamMemberEditPage } = await import(
            '@/admin/pages/AdminTeamMemberEditPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="team" title="Team & staff">
                <AdminTeamMemberEditPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        /*
         * Admin settings — the reference data every other section picks from:
         * the locations services are offered in, and the carriers the mail room
         * ships with. Neither is seeded any more, so this screen is where both
         * lists come from. Reads `GET /v1/admin/settings/locations` and
         * `/carriers`; writes are admin-only on the backend.
         */
        path: 'settings',
        lazy: async () => {
          const { AdminSettingsPage } = await import(
            '@/admin/pages/AdminSettingsPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="settings" title="Admin settings">
                <AdminSettingsPage />
              </RequirePermission>
            ),
          };
        },
      },
      {
        /*
         * Audit log — the read-only trail of who did what, across every section
         * above. Reads `GET /v1/admin/audit` and `/audit/summary`; there is no
         * write endpoint behind this screen and there must never be one, since
         * a trail a screen can edit is not evidence.
         *
         * Its own `audit` area rather than admin-only, so reviewing the trail
         * can be delegated without also handing over the power to change what
         * it records. Not a default on any role except super-admin and
         * operations manager.
         */
        path: 'audit',
        lazy: async () => {
          const { AdminAuditLogPage } = await import(
            '@/admin/pages/AdminAuditLogPage'
          );
          const { RequirePermission } = await import(
            '@/admin/components/RequirePermission'
          );
          return {
            Component: () => (
              <RequirePermission area="audit" title="Audit log">
                <AdminAuditLogPage />
              </RequirePermission>
            ),
          };
        },
      },
      // The admin sidebar links to every admin section; their screens are not
      // built yet, so each renders a placeholder instead of falling through to
      // the catch-all and dropping the user back on marketing.
      ...ADMIN_PLACEHOLDER_ROUTES.map(({ path, title }) => ({
        path,
        lazy: async () => {
          const { AdminPlaceholderPage } = await import(
            '@/admin/pages/AdminPlaceholderPage'
          );
          return { Component: () => <AdminPlaceholderPage title={title} /> };
        },
      })),
    ],
  },
  {
    // Anything unmatched falls back to the marketing home page, so it carries
    // the same logged-out-only rule: a signed-in visitor who mistypes a portal
    // URL lands back in their own portal rather than on the sales site.
    path: '*',
    lazy: async () => {
      const { HomePage } = await import('@/marketing/pages/HomePage');
      const { RedirectIfAuthenticated } = await import('@/auth/RedirectIfAuthenticated');
      return {
        Component: () => (
          <RedirectIfAuthenticated>
            <HomePage />
          </RedirectIfAuthenticated>
        ),
      };
    },
  },
];

/*
 * Every route hangs off one pathless parent, purely to give the whole tree a
 * single errorElement. Without it React Router renders its own developer
 * default for a route that fails to load — which is what a customer saw after a
 * deploy replaced the chunk their tab was still asking for.
 */
export const router = createBrowserRouter([
  { errorElement: <RouteErrorFallback />, children: routes },
]);
