import { Navigate } from 'react-router-dom';

import { deviceHasAccount } from '@/lib/device-account';

// The marketing "Get Started" CTAs all point here. A visitor who has created an
// account on this device is sent to log in; everyone else goes to sign up.
export function GetStartedRedirect() {
  return <Navigate to={deviceHasAccount() ? '/login' : '/signup'} replace />;
}
