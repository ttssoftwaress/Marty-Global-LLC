import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import { ConfirmationCard } from '../features/order-new-service';
import { usePortalShell } from '../hooks/usePortalShell';
import type { OrderConfirmation } from '../types/order-new-service';

/*
 * Order a new service — Step 3: Application submitted.
 *
 * The success screen shown after Step 2's submit. One responsive tree covers
 * all three Figma links; Tailwind swaps the outer framing that differs:
 *   - mobile:  the card sits near the top of the workspace, no breadcrumb.
 *   - tablet:  a "My orders / Application submitted" breadcrumb above the card,
 *              which is pushed down and centered horizontally.
 *   - desktop: no breadcrumb; the card is centered in the workspace.
 * The card itself (ConfirmationCard) owns its internal responsive behavior.
 *
 * The confirmation payload (reference, submitted date, services, email) comes
 * from the create-application endpoint and is carried here via router state,
 * the same way Step 1 hands its selection to Step 2. Nothing is hardcoded.
 *
 * A direct visit with no confirmation — a refresh or deep link — has nothing to
 * show, so it redirects to the orders list rather than an empty screen.
 */

const ORDERS_ROUTE = '/app/orders';

type OrderConfirmationLocationState = {
  confirmation?: OrderConfirmation;
};

export function OrderConfirmationPage() {
  const { user, onLogout } = usePortalShell();
  const navigate = useNavigate();
  const location = useLocation();

  const confirmation = useMemo(() => {
    const state = location.state as OrderConfirmationLocationState | null;
    return state?.confirmation ?? null;
  }, [location.state]);

  useEffect(() => {
    if (!confirmation) navigate(ORDERS_ROUTE, { replace: true });
  }, [confirmation, navigate]);

  if (!confirmation) return null;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="flex min-h-full w-full flex-col p-4 md:p-6 lg:p-content">
        {/* Breadcrumb — tablet only (md); desktop and mobile links show none. */}
        <p className="hidden text-caption font-medium uppercase tracking-[0.6px] text-gray-500 md:block lg:hidden">
          My orders / Application submitted
        </p>

        {/* The card is centered horizontally at every width. `flex-1` +
            justify-center pulls it toward the vertical middle on desktop; on
            tablet the top padding above it comes from the breadcrumb gap, on
            mobile it rides near the top. */}
        <div className="flex flex-1 flex-col items-center justify-center pt-8 md:justify-start md:pt-20 lg:justify-center lg:pt-0">
          <ConfirmationCard confirmation={confirmation} />
        </div>
      </div>
    </PortalLayout>
  );
}
