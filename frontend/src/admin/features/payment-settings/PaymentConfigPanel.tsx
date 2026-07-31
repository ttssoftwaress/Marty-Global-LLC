import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

import { ApiError } from '@/services/api';
import { Field, FormSection, TextArea, TextInput } from '../../components/FormControls';
import {
  paymentSettingsPayload,
  rateMinorToDecimal,
  validateUsdtDraft,
  type UsdtSettingsDraft,
  type WireSettingsDraft,
} from '../../lib/payment-settings';
import type {
  PaymentSettings,
  PaymentSettingsErrors,
} from '../../types/payment-settings';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';
import { usePaymentSettings, useUpdatePaymentSettings } from './queries';

/*
 * How we collect — the screen that replaced five environment variables.
 *
 * Everything here used to live in `config/env.ts`, which made rotating the
 * receiving wallet, adjusting the USD→USDT spread, or tightening confirmations
 * after an incident a redeploy each. They are operational decisions, so they
 * belong to whoever runs the business.
 *
 * Two facts are shown and not editable, and the copy says why: the network pins
 * which USDT contract a transfer is verified against, and the TronGrid key is a
 * credential. Both stay in server env (AGENTS.md, Security & PII) — an admin
 * form is not a secret store, and a form that could flip the network would
 * change which chain real invoices are credited from.
 *
 * MONEY: the rate is an integer numerator over 1_000_000 on the wire. This form
 * edits it as a decimal because nobody wants to type 1010000, and the conversion
 * is integer string arithmetic in `lib/payment-settings` — no float ever touches
 * it (AGENTS.md, Money).
 */

function emptyUsdtDraft(): UsdtSettingsDraft {
  return {
    enabled: true,
    depositAddress: '',
    rate: '1',
    rateTtlMinutes: '30',
    minConfirmations: '19',
    pollIntervalSeconds: '30',
    autoVerifyEnabled: true,
  };
}

function draftFromSettings(settings: PaymentSettings): {
  usdt: UsdtSettingsDraft;
  wire: WireSettingsDraft;
} {
  return {
    usdt: {
      enabled: settings.usdt.enabled,
      depositAddress: settings.usdt.depositAddress ?? '',
      rate: rateMinorToDecimal(settings.usdt.rateMinor),
      rateTtlMinutes: String(settings.usdt.rateTtlMinutes),
      minConfirmations: String(settings.usdt.minConfirmations),
      pollIntervalSeconds: String(settings.usdt.pollIntervalSeconds),
      autoVerifyEnabled: settings.usdt.autoVerifyEnabled,
    },
    wire: {
      enabled: settings.wire.enabled,
      instructions: settings.wire.instructions ?? '',
    },
  };
}

const NETWORK_LABEL: Record<'mainnet' | 'nile', string> = {
  mainnet: 'TRON Mainnet',
  nile: 'TRON Nile Testnet',
};

export function PaymentConfigPanel({ canWrite }: { canWrite: boolean }) {
  const settings = usePaymentSettings();
  const save = useUpdatePaymentSettings();

  const [usdt, setUsdt] = useState<UsdtSettingsDraft>(emptyUsdtDraft);
  const [wire, setWire] = useState<WireSettingsDraft>({
    enabled: false,
    instructions: '',
  });
  const [errors, setErrors] = useState<PaymentSettingsErrors>({});
  const [saved, setSaved] = useState(false);

  // Seeded from the server rather than held as the source of truth, so a save
  // elsewhere (or a refetch) is what the form reflects.
  useEffect(() => {
    if (!settings.data) return;
    const next = draftFromSettings(settings.data);
    setUsdt(next.usdt);
    setWire(next.wire);
    setErrors({});
  }, [settings.data]);

  const patchUsdt = (next: Partial<UsdtSettingsDraft>) => {
    setSaved(false);
    setUsdt((prev) => ({ ...prev, ...next }));
  };

  const patchWire = (next: Partial<WireSettingsDraft>) => {
    setSaved(false);
    setWire((prev) => ({ ...prev, ...next }));
  };

  const submit = () => {
    const found = validateUsdtDraft(usdt);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    save.mutate(paymentSettingsPayload(usdt, wire), {
      onSuccess: () => setSaved(true),
    });
  };

  const saveError = save.isError
    ? save.error instanceof ApiError
      ? save.error.message
      : 'Something went wrong saving these settings. Please try again.'
    : null;

  if (settings.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 w-full animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>
    );
  }

  if (settings.isError || !settings.data) {
    return (
      <p role="alert" className="text-body text-error">
        Could not load your payment settings. Reload the page to try again.
      </p>
    );
  }

  const { usdt: server } = settings.data;

  // The state worth warning about: crypto is on, but there is nowhere to send
  // it. The checkout renders that method as disabled and nobody would know why.
  const usdtIncomplete = usdt.enabled && !usdt.depositAddress.trim();
  // Its wire equivalent, resolved server-side against the same rule the checkout
  // applies rather than counted here.
  const wireIncomplete = wire.enabled && settings.data.payableAccounts === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5">
        <FormSection
          title="Crypto — USDT (TRC-20)"
          description="Where customers send USDT, what it converts at, and whether the chain sweep credits it on its own."
        >
          <div className="flex flex-col gap-4">
            <SwitchRow
              checked={usdt.enabled}
              onChange={(next) => patchUsdt({ enabled: next })}
              disabled={!canWrite}
              label="Accept USDT"
              on="On — offered at checkout"
              off="Off — hidden from checkout entirely"
            />

            <Field
              label="Deposit address"
              htmlFor="usdt-address"
              error={errors.tronDepositAddress}
              hint="The public receiving address, base58 (“T” + 33 characters). We only ever watch it — no key for it exists anywhere in this system. Leave blank to stop taking crypto without switching the method off."
            >
              <TextInput
                id="usdt-address"
                value={usdt.depositAddress}
                onChange={(event) => patchUsdt({ depositAddress: event.target.value })}
                placeholder="T…"
                disabled={!canWrite}
                error={errors.tronDepositAddress}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>

            {usdtIncomplete ? (
              <Callout tone="warning" icon={AlertTriangle}>
                USDT is switched on but has no deposit address, so the option
                shows at checkout as temporarily unavailable. Add an address, or
                switch the method off.
              </Callout>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="USD → USDT rate"
                htmlFor="usdt-rate"
                error={errors.usdtUsdRateMinor}
                hint="1 is parity. 1.01 asks for 1% more — that is how a spread is expressed."
                required
              >
                <TextInput
                  id="usdt-rate"
                  value={usdt.rate}
                  onChange={(event) => patchUsdt({ rate: event.target.value })}
                  placeholder="1"
                  inputMode="decimal"
                  disabled={!canWrite}
                  error={errors.usdtUsdRateMinor}
                />
              </Field>

              <Field
                label="Quote valid for (minutes)"
                htmlFor="usdt-ttl"
                error={errors.usdtRateTtlMinutes}
                hint="How long a quoted amount and its locked rate stay good. A transfer arriving later is held for review, never credited at a stale price."
                required
              >
                <TextInput
                  id="usdt-ttl"
                  value={usdt.rateTtlMinutes}
                  onChange={(event) => patchUsdt({ rateTtlMinutes: event.target.value })}
                  inputMode="numeric"
                  disabled={!canWrite}
                  error={errors.usdtRateTtlMinutes}
                />
              </Field>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Automatic verification"
          description="The background sweep that reads the chain and credits confirmed transfers."
        >
          <div className="flex flex-col gap-4">
            <SwitchRow
              checked={usdt.autoVerifyEnabled}
              onChange={(next) => patchUsdt({ autoVerifyEnabled: next })}
              disabled={!canWrite}
              label="Verify USDT payments automatically"
              on="On — confirmed transfers are credited without anyone touching them"
              off="Off — your team confirms each transfer by hand, like a bank transfer"
            />

            {!usdt.autoVerifyEnabled ? (
              <Callout tone="warning" icon={ShieldAlert}>
                Nothing is crediting crypto payments right now. They will sit in
                the settlement queue on Quotes &amp; payments until someone with
                the “Confirm wire payments received” permission verifies the
                transaction and marks each one received. Switching this back on
                picks up anything still waiting — confirmation depth is
                recalculated from the block, so nothing is lost.
              </Callout>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Confirmations before crediting"
                htmlFor="usdt-confirmations"
                error={errors.tronMinConfirmations}
                hint="TRON blocks are ~3s and irreversible after about 19, so 19 is the safe floor. A payment already open keeps the depth it was quoted."
                required
              >
                <TextInput
                  id="usdt-confirmations"
                  value={usdt.minConfirmations}
                  onChange={(event) =>
                    patchUsdt({ minConfirmations: event.target.value })
                  }
                  inputMode="numeric"
                  disabled={!canWrite || !usdt.autoVerifyEnabled}
                  error={errors.tronMinConfirmations}
                />
              </Field>

              <Field
                label="Check the chain every (seconds)"
                htmlFor="usdt-interval"
                error={errors.tronPollIntervalSeconds}
                hint="Takes effect immediately. Below about 10 seconds TronGrid rate-limits us, which costs more transfers than it finds."
                required
              >
                <TextInput
                  id="usdt-interval"
                  value={usdt.pollIntervalSeconds}
                  onChange={(event) =>
                    patchUsdt({ pollIntervalSeconds: event.target.value })
                  }
                  inputMode="numeric"
                  disabled={!canWrite || !usdt.autoVerifyEnabled}
                  error={errors.tronPollIntervalSeconds}
                />
              </Field>
            </div>

            {/*
              Set on the server and shown here rather than hidden: an admin
              staring at a testnet address wondering why nothing arrives should
              be able to see which chain this deployment is pointed at.
            */}
            <dl className="flex flex-col gap-2 rounded-card border border-gray-200 bg-gray-50 p-3.5">
              <ReadOnlyRow label="Network" value={NETWORK_LABEL[server.network]} />
              <ReadOnlyRow label="USDT contract" value={server.contractAddress} mono />
              <ReadOnlyRow
                label="TronGrid API key"
                value={server.apiKeyConfigured ? 'Configured' : 'Not configured'}
              />
              <p className="text-caption leading-5 text-gray-500">
                These three are set on the server and cannot be changed here. The
                network decides which USDT contract a transfer is checked
                against — getting it wrong would credit invoices for a look-alike
                token — and the API key is a credential, so it never leaves the
                server.
              </p>
            </dl>
          </div>
        </FormSection>

        <FormSection
          title="Bank transfer"
          description="Whether customers may wire, and what to tell them before they do."
        >
          <div className="flex flex-col gap-4">
            <SwitchRow
              checked={wire.enabled}
              onChange={(next) => patchWire({ enabled: next })}
              disabled={!canWrite}
              label="Accept bank transfers"
              on="On — offered at checkout"
              off="Off — hidden from checkout entirely"
            />

            {wireIncomplete ? (
              <Callout tone="warning" icon={AlertTriangle}>
                Bank transfer is switched on but no account is payable, so the
                option shows at checkout as temporarily unavailable. Add an
                account with at least one detail on the Bank accounts tab.
              </Callout>
            ) : null}

            <Callout tone="info" icon={Info}>
              Nothing reads your bank feed, so a wire is never credited
              automatically. Each one waits in the settlement queue on Quotes
              &amp; payments until someone with the “Confirm wire payments
              received” permission marks it received.
            </Callout>

            <Field
              label="What to tell customers"
              htmlFor="wire-instructions"
              hint="Optional. Shown above the bank details at checkout — clearing times, what to reference, who to contact."
            >
              <TextArea
                id="wire-instructions"
                rows={3}
                value={wire.instructions}
                onChange={(event) => patchWire({ instructions: event.target.value })}
                placeholder="Transfers usually clear within 1–3 working days. Quote your invoice reference so we can match your payment."
                disabled={!canWrite}
              />
            </Field>
          </div>
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
              className="flex flex-1 items-center gap-2 text-body text-success"
            >
              <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Saved. New payments use these settings; anything already open keeps
              what it was quoted.
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={save.isPending}
            className="h-input shrink-0 rounded-control bg-primary px-5 text-body font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {save.isPending ? 'Saving…' : 'Save payment settings'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/*
 * A switch with the sentence that says what its two positions actually do. The
 * label alone is never enough here — "Accept USDT" off and "Verify
 * automatically" off are very different kinds of off.
 */
function SwitchRow({
  checked,
  onChange,
  disabled,
  label,
  on,
  off,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  label: string;
  on: string;
  off: string;
}) {
  return (
    <div className="flex items-center gap-3 text-body text-text">
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
      />
      <span>{checked ? on : off}</span>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
      <dt className="shrink-0 text-caption font-medium uppercase tracking-[0.4px] text-gray-500 md:w-36">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-all text-body text-text ${mono ? 'font-mono text-[0.8125rem]' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Callout({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'warning' | 'info';
  icon: typeof Info;
  children: React.ReactNode;
}) {
  const styles =
    tone === 'warning'
      ? 'border-[var(--color-status-review-text)]/25 bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]'
      : 'border-gray-200 bg-gray-50 text-text-secondary';

  return (
    <p className={`flex items-start gap-2 rounded-card border p-3.5 text-body leading-6 ${styles}`}>
      <Icon className="mt-1 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
