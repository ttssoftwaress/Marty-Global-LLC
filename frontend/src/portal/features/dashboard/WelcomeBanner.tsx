import type { AccountStatus } from '../../types/dashboard';

/*
 * Welcome banner — navy card at the top of the dashboard: greeting, an account
 * status chip, and a one-line summary of what needs attention.
 *
 * The summary sentence is composed from live counts rather than stored as copy,
 * so it stays truthful when a customer has nothing outstanding. Mobile stacks
 * the chip row above the sentence; desktop and tablet keep them on one line.
 */

const STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Active & compliant',
  action_required: 'Action required',
  suspended: 'Suspended',
};

const STATUS_CLASS: Record<AccountStatus, string> = {
  active: 'status-approved',
  action_required: 'status-review',
  suspended: 'status-missing',
};

type WelcomeBannerProps = {
  firstName: string;
  accountStatus: AccountStatus;
  unreadMail: number;
  pendingQuotes: number;
};

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function summarize(unreadMail: number, pendingQuotes: number) {
  const parts: string[] = [];
  if (unreadMail > 0) parts.push(plural(unreadMail, 'unread mail item'));
  if (pendingQuotes > 0) parts.push(plural(pendingQuotes, 'pending quote'));

  if (parts.length === 0) return '— nothing needs your attention right now.';
  return `— you have ${parts.join(' and ')}.`;
}

export function WelcomeBanner({
  firstName,
  accountStatus,
  unreadMail,
  pendingQuotes,
}: WelcomeBannerProps) {
  return (
    <section className="flex w-full flex-col gap-3 rounded-card bg-primary p-5 md:gap-3 md:p-6 lg:gap-2 lg:rounded-card lg:p-8">
      <h1 className="text-h5 font-semibold text-white lg:text-h4">
        Welcome back, {firstName}!
      </h1>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
        <div className="flex items-center gap-2 sm:gap-1.5">
          <p className="text-body text-white/80">Your account status is</p>
          <span
            className={`status-badge shrink-0 px-2.5 text-small font-semibold ${STATUS_CLASS[accountStatus]}`}
          >
            {STATUS_LABEL[accountStatus]}
          </span>
        </div>

        <p className="min-w-0 flex-1 text-body text-white/80">
          {summarize(unreadMail, pendingQuotes)}
        </p>
      </div>
    </section>
  );
}
