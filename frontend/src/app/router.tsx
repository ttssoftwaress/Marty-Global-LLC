import { createBrowserRouter } from 'react-router-dom';

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
    path: '*',
    lazy: async () => {
      const { HomePage } = await import('@/marketing/pages/HomePage');
      return { Component: HomePage };
    },
  },
]);
