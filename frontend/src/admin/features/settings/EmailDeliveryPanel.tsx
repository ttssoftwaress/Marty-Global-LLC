import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, MailWarning } from 'lucide-react';

import { ApiError } from '@/services/api';
import {
  Callout,
  Field,
  FormSection,
  SwitchRow,
  TextInput,
} from '../../components/FormControls';
import type {
  AdminNotificationSettings,
  NotificationSettingsChange,
} from '../../types/settings';
import {
  useAdminNotificationSettings,
  useUpdateAdminNotificationSettings,
} from './queries';

/*
 * Outbound email, on or off — the Payments tab's automatic-verification switch,
 * for the other background integration.
 *
 * It exists for a concrete failure. Every email is a stored row plus a queued
 * job; when the transport refuses the send — a sending domain still in the SES
 * sandbox rejects every address it has not verified — the job burns five
 * attempts, the row goes FAILED, and the job sits in the failed queue for a
 * week. Anything watching for failed background jobs then alerts on work nobody
 * can fix until AWS grants production access, and the only way to stop it used
 * to be a code change.
 *
 * Two things the copy here has to be honest about, because both surprise people:
 *
 *   · While it is off, customers are told nothing by email. Not quotes, not
 *     filing updates, not password resets. The in-app feed still works.
 *   · Switching it back on does not resend the backlog. That is deliberate — a
 *     pause of any length would otherwise end in a burst of stale mail about
 *     orders the customer has long since seen.
 *
 * No Figma link — built to the same card, section, and switch language as the
 * Payments tab it mirrors, and logged as a deviation.
 */

function reasonPlaceholder() {
  return 'e.g. SES production access pending — sends rejected outside the sandbox';
}

export function EmailDeliveryPanel({ canWrite }: { canWrite: boolean }) {
  const settings = useAdminNotificationSettings();
  const save = useUpdateAdminNotificationSettings();

  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState('');
  const [changed, setChanged] = useState<NotificationSettingsChange | null>(null);
  const [saved, setSaved] = useState(false);

  // Seeded from the server rather than held as the source of truth, so a save
  // elsewhere (or a refetch) is what the form reflects.
  useEffect(() => {
    if (!settings.data) return;
    setEnabled(settings.data.email.enabled);
    setReason(settings.data.email.disabledReason ?? '');
  }, [settings.data]);

  const submit = () => {
    setSaved(false);
    setChanged(null);

    save.mutate(
      {
        emailEnabled: enabled,
        // Only meaningful while it is off; the backend clears it on the way back
        // on rather than leaving a stale note under a live switch.
        ...(enabled ? {} : { emailDisabledReason: reason.trim() }),
      },
      {
        onSuccess: (result) => {
          setChanged(result.changed);
          setSaved(true);
        },
      },
    );
  };

  const saveError = save.isError
    ? save.error instanceof ApiError
      ? save.error.message
      : 'Something went wrong saving this setting. Please try again.'
    : null;

  if (settings.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-40 w-full animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>
    );
  }

  if (settings.isError || !settings.data) {
    return (
      <p role="alert" className="text-body text-error">
        Could not load your email settings. Reload the page to try again.
      </p>
    );
  }

  const server: AdminNotificationSettings['email'] = settings.data.email;
  const dirty =
    enabled !== server.enabled ||
    (!enabled && reason.trim() !== (server.disabledReason ?? ''));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5">
        <FormSection
          title="Outbound email"
          description="Whether any email leaves this system — quotes, filing updates, password resets, support replies."
        >
          <div className="flex flex-col gap-4">
            <SwitchRow
              checked={enabled}
              onChange={(next) => {
                setSaved(false);
                setChanged(null);
                setEnabled(next);
              }}
              disabled={!canWrite}
              label="Send email to customers"
              on="On — notifications are delivered as they are raised"
              off="Off — nothing is sent, and nothing is queued to send later"
            />

            {!enabled ? (
              <Callout tone="warning" icon={MailWarning}>
                Nobody is being emailed anything right now — no quote, no filing
                update, no password reset. Customers still see everything in the
                app and in their notification feed. Each message that comes due
                is stored and marked as not sent, and switching this back on
                resumes new email only: the backlog is deliberately never sent,
                so a long pause cannot end in a burst of stale mail.
              </Callout>
            ) : null}

            {!enabled ? (
              <Field
                label="Why it is off"
                htmlFor="email-disabled-reason"
                hint="Optional, and only your team sees it. Whoever finds this switch off in three weeks needs to know whether it was deliberate."
              >
                <TextInput
                  id="email-disabled-reason"
                  value={reason}
                  onChange={(event) => {
                    setSaved(false);
                    setReason(event.target.value);
                  }}
                  placeholder={reasonPlaceholder()}
                  maxLength={200}
                  disabled={!canWrite}
                />
              </Field>
            ) : null}

            {/*
              The other reason mail can be silent, and a different problem: no
              credentials means the transport logs the envelope and sends
              nothing, which looks identical from the outside. Said here so
              nobody flips this switch chasing a silence it did not cause.
            */}
            {!server.transportConfigured ? (
              <Callout tone="warning" icon={AlertTriangle}>
                No email credentials are configured on the server, so nothing
                would send even with this switched on. That is a deployment
                setting, not something this screen can change.
              </Callout>
            ) : (
              <Callout tone="info" icon={Info}>
                Email is sent as <strong>{server.fromAddress}</strong>. If your
                provider still has that identity in a sandbox it will reject
                every address it has not verified — that is exactly what this
                switch is for while you wait for production access.
              </Callout>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Delivery ledger"
          description="Every email is stored before it is sent, so this is the whole picture — not a sample."
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <LedgerStat
              label="Waiting to send"
              value={server.ledger.pending}
              caption="Queued and not yet delivered."
            />
            <LedgerStat
              label="Failed"
              value={server.ledger.failed}
              caption="Tried and rejected by the provider."
              tone={server.ledger.failed > 0 ? 'warning' : 'normal'}
            />
            <LedgerStat
              label="Not sent"
              value={server.ledger.suppressed}
              caption="Came due while sending was off."
            />
          </dl>
        </FormSection>
      </div>

      {canWrite ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end md:gap-4">
          {saveError ? (
            <p role="alert" className="flex-1 text-body text-error">
              {saveError}
            </p>
          ) : saved ? (
            <p
              role="status"
              className="flex flex-1 items-start gap-2 text-body text-success"
            >
              <CheckCircle2
                className="mt-1 size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span>
                Saved.{' '}
                {changed
                  ? `${changed.suppressed} email${changed.suppressed === 1 ? '' : 's'} waiting to send ${changed.suppressed === 1 ? 'was' : 'were'} stood down, and ${changed.jobsDropped} queued job${changed.jobsDropped === 1 ? '' : 's'} cleared.`
                  : 'New notifications follow this setting from now on.'}
              </span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={save.isPending || !dirty}
            className="h-input shrink-0 rounded-control bg-primary px-5 text-body font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {save.isPending ? 'Saving…' : 'Save email settings'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LedgerStat({
  label,
  value,
  caption,
  tone = 'normal',
}: {
  label: string;
  value: number;
  caption: string;
  tone?: 'normal' | 'warning';
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-gray-200 bg-gray-50 p-3.5">
      <dt className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
        {label}
      </dt>
      <dd
        className={`text-h5 font-semibold ${
          tone === 'warning' && value > 0
            ? 'text-[var(--color-status-review-text)]'
            : 'text-text'
        }`}
      >
        {value.toLocaleString()}
      </dd>
      <p className="text-caption text-gray-500">{caption}</p>
    </div>
  );
}
