import { AlertTriangle, Check, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { OrderPayment, PaymentState } from '../../types/orders';
import { DetailFieldList } from './DetailFieldList';
import { SectionCard } from './SectionCard';

/*
 * Payment status — the payment fields (method, date, transaction id) under a
 * title-row chip that reflects whether the order is paid. The chip reuses the
 * shared status-badge tokens so it reads the same as every other status pill
 * in the portal.
 */

const PAYMENT_CHIP: Record<
  PaymentState,
  { label: string; icon: LucideIcon; className: string }
> = {
  paid: { label: 'Paid', icon: Check, className: 'status-approved' },
  pending: { label: 'Pending', icon: Clock, className: 'status-review' },
  failed: { label: 'Failed', icon: AlertTriangle, className: 'status-missing' },
};

function PaymentChip({ state }: { state: PaymentState }) {
  const { label, icon: Icon, className } = PAYMENT_CHIP[state];
  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

export function PaymentStatusCard({ payment }: { payment: OrderPayment }) {
  return (
    <SectionCard
      title="Payment status"
      titleAccessory={<PaymentChip state={payment.state} />}
      className="gap-4"
    >
      <div className="mt-1">
        <DetailFieldList fields={payment.fields} />
      </div>
    </SectionCard>
  );
}
