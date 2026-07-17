import { createBrowserRouter, Navigate } from 'react-router-dom';

import { CheckYourEmailPage } from '@/auth/CheckYourEmailPage';
import { LogInPage } from '@/auth/LogInPage';
import { ResetPasswordPage } from '@/auth/ResetPasswordPage';
import { SetNewPasswordPage } from '@/auth/SetNewPasswordPage';
import { SignUpPage } from '@/auth/SignUpPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LogInPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/reset-password/new',
    element: <SetNewPasswordPage />,
  },
  {
    path: '/check-your-email',
    element: <CheckYourEmailPage />,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
