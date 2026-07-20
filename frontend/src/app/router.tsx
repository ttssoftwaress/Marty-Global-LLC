import { createBrowserRouter, Navigate } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    lazy: async () => {
      const { LogInPage } = await import('@/auth/LogInPage');
      return { Component: LogInPage };
    },
  },
  {
    path: '/signup',
    lazy: async () => {
      const { SignUpPage } = await import('@/auth/SignUpPage');
      return { Component: SignUpPage };
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
    element: <Navigate to="/login" replace />,
  },
]);
