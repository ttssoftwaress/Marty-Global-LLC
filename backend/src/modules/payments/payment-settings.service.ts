import type { BankAccount, BankAccountField, PaymentSettings } from '@prisma/client';

import { tronConfig, USDT_DECIMALS } from '../../config/tron.js';
import { prisma } from '../../lib/prisma.js';

/*
 * How we collect, read from the database instead of from the environment.
 *
 * Every value here used to be a variable in `config/env.ts`, which made rotating
 * the receiving wallet, adjusting the USD→USDT spread, or adding a bank account
 * a redeploy each. They are operational decisions — the same argument that moved
 * locations and carriers out of the seed script — so they are admin-managed data
 * now, edited at `/admin/settings` and read here.
 *
 * Two things deliberately stayed in env and must not be moved into this table:
 *
 *   · TRONGRID_API_KEY — a credential. Secrets never leave server env
 *     (AGENTS.md, Security & PII), and an admin form is not a secret store.
 *   · TRON_NETWORK — it pins which hardcoded USDT contract address a transfer is
 *     verified against. A form that could flip it would change which chain real
 *     invoices are credited from and orphan the sync cursor.
 *
 * This module owns the READ path: what the checkout offers, and what the poller
 * watches. Admin writes live in `modules/admin/payment-settings`, mirroring how
 * `admin/settings` owns the location and carrier writes.
 *
 * MONEY: the rate is an integer numerator over a fixed scale, never a float
 * (AGENTS.md, Money). Nothing in this file does arithmetic on an amount.
 */

// The settings row's fixed primary key. One row by construction — a settings
// table with a row count is a settings table someone eventually writes twice.
export const PAYMENT_SETTINGS_ID = 'singleton';

/*
 * The settings row, created on first read.
 *
 * An upsert rather than a seed: nothing seeds this table (same rule as locations
 * and carriers), and a fresh database must still be able to answer "what does
 * checkout offer" without an admin having visited the screen first. The Prisma
 * column defaults are the answer it gives — USDT on with no address, wire off —
 * which renders as "no payment method is configured yet" rather than as an
 * error.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  return prisma.paymentSettings.upsert({
    where: { id: PAYMENT_SETTINGS_ID },
    create: { id: PAYMENT_SETTINGS_ID },
    update: {},
  });
}

/*
 * What the USDT path needs to issue an intent or run a sweep, with the two
 * env-level facts folded in so no caller has to assemble the pair itself.
 *
 * `configured` is the poller's idle check: without a deposit address there is
 * nothing to watch, and with USDT switched off there is nothing to watch it for.
 */
export type UsdtConfig = {
  network: 'mainnet' | 'nile';
  contractAddress: string;
  decimals: number;
  enabled: boolean;
  depositAddress: string | null;
  /** USDT-per-USD numerator over 1_000_000 — an integer, never a float. */
  rateMinor: number;
  rateTtlMinutes: number;
  minConfirmations: number;
  pollIntervalSeconds: number;
  /*
   * Whether the chain sweep credits payments on its own. Off, USDT is settled by
   * hand like a wire — the poller idles and whoever holds `payments.settle`
   * confirms each transfer against a block explorer.
   */
  autoVerify: boolean;
  configured: boolean;
};

export function toUsdtConfig(settings: PaymentSettings): UsdtConfig {
  const depositAddress = settings.tronDepositAddress ?? null;

  return {
    network: tronConfig.network,
    contractAddress: tronConfig.usdtContract,
    decimals: USDT_DECIMALS,
    enabled: settings.usdtEnabled,
    depositAddress,
    rateMinor: settings.usdtUsdRateMinor,
    rateTtlMinutes: settings.usdtRateTtlMinutes,
    minConfirmations: settings.tronMinConfirmations,
    pollIntervalSeconds: settings.tronPollIntervalSeconds,
    autoVerify: settings.usdtAutoVerifyEnabled,
    // "Can we take a USDT payment at all" — which is about the address, not
    // about who confirms it. Auto-verification off still collects; it just
    // routes settlement through a person.
    configured: settings.usdtEnabled && Boolean(depositAddress),
  };
}

export async function getUsdtConfig(): Promise<UsdtConfig> {
  return toUsdtConfig(await getPaymentSettings());
}

// --- Bank accounts -------------------------------------------------------

export type BankAccountWithFields = BankAccount & { fields: BankAccountField[] };

/*
 * One labelled line on the checkout card, exactly as the admin entered it.
 *
 * This is the shape the whole wire feature turns on. Banking details are not the
 * same shape in two countries — a US account has a routing number and no IBAN, a
 * UK one has a sort code, a SEPA one has neither — so a table of `iban` /
 * `swift` / `sortCode` columns would make every new market a migration. The
 * admin owns both halves of every row, and the card renders what they entered.
 */
export type WireInstructionField = {
  label: string;
  value: string;
  copyable: boolean;
  emphasis: boolean;
};

export type WireAccountView = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  currency: string;
  fields: WireInstructionField[];
};

const FIELD_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

export function toWireAccountView(account: BankAccountWithFields): WireAccountView {
  return {
    id: account.id,
    code: account.code,
    label: account.label,
    description: account.description,
    currency: account.currency,
    fields: account.fields.map((field) => ({
      label: field.label,
      value: field.value,
      copyable: field.copyable,
      emphasis: field.emphasis,
    })),
  };
}

/*
 * The accounts a customer may actually be shown.
 *
 * An account with no fields is filtered out rather than rendered: it is a
 * half-finished row in the admin screen, and offering "wire to this account"
 * with nothing under the heading is the worst possible version of this card.
 */
export async function listPayableBankAccounts(): Promise<BankAccountWithFields[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { deletedAt: null, active: true },
    include: { fields: { orderBy: FIELD_ORDER } },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  return accounts.filter((account) => account.fields.length > 0);
}

/*
 * One payable account by id, or null. Used when a customer names the account
 * they want to wire to — the id comes off the client, so it is re-resolved
 * against the same "active, has fields" rule the list applies rather than
 * trusted.
 */
export async function findPayableBankAccount(
  id: string,
): Promise<BankAccountWithFields | null> {
  const account = await prisma.bankAccount.findFirst({
    where: { id, deletedAt: null, active: true },
    include: { fields: { orderBy: FIELD_ORDER } },
  });

  return account && account.fields.length > 0 ? account : null;
}

/*
 * The instruction card frozen at intent time, stored on the Payment row.
 *
 * The live account is editable — that is the point of the admin screen — so a
 * customer looking at "send to IBAN X" must keep seeing X after someone corrects
 * a typo in the label. Reconciliation would otherwise be an argument about which
 * details were on screen at the time.
 */
export type WireInstructionsSnapshot = {
  accountLabel: string;
  description: string | null;
  currency: string;
  fields: WireInstructionField[];
};

export function snapshotWireInstructions(
  account: BankAccountWithFields,
): WireInstructionsSnapshot {
  const view = toWireAccountView(account);

  return {
    accountLabel: view.label,
    description: view.description,
    currency: view.currency,
    fields: view.fields,
  };
}

/*
 * Read a snapshot back off a Payment row.
 *
 * `Json` is `unknown` as far as the type system is concerned, and this one was
 * written by an older deploy's version of the shape above, so every field is
 * checked rather than cast. A row that cannot be read returns null and the
 * screen falls back to naming the account — never a crash on a payment page.
 */
export function readWireInstructions(value: unknown): WireInstructionsSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const fields = Array.isArray(raw.fields) ? raw.fields : [];

  const parsed: WireInstructionField[] = [];

  for (const entry of fields) {
    if (!entry || typeof entry !== 'object') continue;
    const field = entry as Record<string, unknown>;
    if (typeof field.label !== 'string' || typeof field.value !== 'string') continue;

    parsed.push({
      label: field.label,
      value: field.value,
      copyable: field.copyable !== false,
      emphasis: field.emphasis === true,
    });
  }

  if (parsed.length === 0) return null;

  return {
    accountLabel: typeof raw.accountLabel === 'string' ? raw.accountLabel : '',
    description: typeof raw.description === 'string' ? raw.description : null,
    currency: typeof raw.currency === 'string' ? raw.currency : 'USD',
    fields: parsed,
  };
}
