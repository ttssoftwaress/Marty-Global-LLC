import { tronConfig } from '../../../config/tron.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { scheduleUsdtPoll } from '../../../jobs/queues.js';
import { AppError } from '../../../lib/app-error.js';
import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import {
  getPaymentSettings,
  PAYMENT_SETTINGS_ID,
  type BankAccountWithFields,
} from '../../payments/payment-settings.service.js';
import { iso } from '../admin.views.js';
import type {
  CreateBankAccountInput,
  ReorderBankAccountsInput,
  UpdateBankAccountInput,
  UpdatePaymentSettingsInput,
} from './payment-settings.validation.js';

/*
 * Payment configuration, admin-owned. All Prisma writes for `PaymentSettings`,
 * `BankAccount`, and `BankAccountField` live here; the customer-side reads live
 * in `modules/payments/payment-settings.service.ts` — the same split
 * `admin/settings` and the rest of the app have over locations and carriers.
 *
 * This module exists because none of it used to be data. The receiving address,
 * the USD→USDT rate, the confirmation depth, and the poll interval were
 * environment variables, so rotating a wallet or adjusting a spread was a
 * redeploy — and there was no wire transfer at all, because "which bank do we
 * use" has no sensible representation as a `.env` line.
 *
 * Two rules shape the file:
 *
 *   1. NOTHING SECRET LANDS HERE. The TronGrid key and the network stay in
 *      server env (AGENTS.md, Security & PII). A settings form is not a secret
 *      store, and the network pins which USDT contract we verify against.
 *
 *   2. EVERY WRITE IS AUDITED, AND NEVER WITH ITS VALUES. Changing the deposit
 *      address decides where every future payment lands; changing an IBAN
 *      decides it for wires. The trail names which fields moved and who moved
 *      them — an account number does not go in an audit row.
 */

// --- Views ---------------------------------------------------------------

export type PaymentSettingsView = {
  usdt: {
    enabled: boolean;
    depositAddress: string | null;
    rateMinor: number;
    rateTtlMinutes: number;
    minConfirmations: number;
    pollIntervalSeconds: number;
    autoVerifyEnabled: boolean;
    /*
     * The two facts this screen may show but not change, sent so the form can
     * say what it is configured against instead of leaving an admin guessing
     * which chain their address is on. Both are deployment-level (env), and the
     * contract address is hardcoded per network precisely because an
     * attacker-supplied one would credit invoices for worthless look-alike
     * tokens.
     */
    network: 'mainnet' | 'nile';
    contractAddress: string;
    /*
     * Whether a TronGrid key is present — a boolean, never the key. Without one
     * the poller is rate-limited into missing transfers on mainnet, and this is
     * the only place anyone would notice before a customer did.
     */
    apiKeyConfigured: boolean;
  };
  wire: {
    enabled: boolean;
    instructions: string | null;
  };
  /*
   * How many accounts a customer could actually be shown — active, not archived,
   * and carrying at least one field. Resolved server-side so the screen does not
   * re-derive the rule the checkout applies and drift from it; it is what lets
   * the page warn "wire transfer is on but no account is payable" instead of
   * leaving an admin to hear it from a customer.
   */
  payableAccounts: number;
  updatedAt: string;
};

export type BankAccountFieldView = {
  label: string;
  value: string;
  copyable: boolean;
  emphasis: boolean;
};

export type BankAccountView = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  currency: string;
  active: boolean;
  sortOrder: number;
  fields: BankAccountFieldView[];
  // How many payments were issued against this account. What decides whether
  // deleting it removes the row or archives it (see `deleteBankAccount`).
  usage: { payments: number };
  updatedAt: string;
};

function settingsView(
  settings: Awaited<ReturnType<typeof getPaymentSettings>>,
  payableAccounts: number,
): PaymentSettingsView {
  return {
    usdt: {
      enabled: settings.usdtEnabled,
      depositAddress: settings.tronDepositAddress,
      rateMinor: settings.usdtUsdRateMinor,
      rateTtlMinutes: settings.usdtRateTtlMinutes,
      minConfirmations: settings.tronMinConfirmations,
      pollIntervalSeconds: settings.tronPollIntervalSeconds,
      autoVerifyEnabled: settings.usdtAutoVerifyEnabled,
      network: tronConfig.network,
      contractAddress: tronConfig.usdtContract,
      apiKeyConfigured: Boolean(tronConfig.apiKey),
    },
    wire: {
      enabled: settings.wireEnabled,
      instructions: settings.wireInstructions,
    },
    payableAccounts,
    updatedAt: iso(settings.updatedAt),
  };
}

function accountView(
  account: BankAccountWithFields,
  payments: number,
): BankAccountView {
  return {
    id: account.id,
    code: account.code,
    label: account.label,
    description: account.description,
    currency: account.currency,
    active: account.active,
    sortOrder: account.sortOrder,
    fields: account.fields.map((field) => ({
      label: field.label,
      value: field.value,
      copyable: field.copyable,
      emphasis: field.emphasis,
    })),
    usage: { payments },
    updatedAt: iso(account.updatedAt),
  };
}

// --- Settings ------------------------------------------------------------

export async function readSettings(): Promise<PaymentSettingsView> {
  const [settings, payableAccounts] = await Promise.all([
    getPaymentSettings(),
    countPayableAccounts(),
  ]);

  return settingsView(settings, payableAccounts);
}

/*
 * Update how we collect.
 *
 * Two things happen beyond the write itself, and both are the point of having
 * this be data rather than env:
 *
 *   · A changed poll interval re-registers the repeatable job immediately, so
 *     the new cadence is live on the next tick instead of at the next boot.
 *     BullMQ keys the scheduler by id, so this updates the existing one rather
 *     than stacking a second sweep (jobs/queues.ts).
 *   · A blank deposit address CLEARS it rather than being ignored. That is the
 *     documented way to stand USDT collection down without switching the method
 *     off entirely, and treating "" as "no change" would make it impossible.
 *
 * Payments already open are untouched by any of this: each row carries the
 * address, rate, and confirmation depth it was issued against, so a change is
 * only ever forward-looking (payments.service.ts).
 */
export async function updateSettings(
  actor: AuthContext,
  input: UpdatePaymentSettingsInput,
): Promise<PaymentSettingsView> {
  // Ensures the singleton exists before the update, so a first-ever write on a
  // fresh database does not 404 on a row nobody has created.
  const before = await getPaymentSettings();

  const settings = await prisma.paymentSettings.update({
    where: { id: PAYMENT_SETTINGS_ID },
    data: {
      ...(input.usdtEnabled === undefined ? {} : { usdtEnabled: input.usdtEnabled }),
      ...(input.tronDepositAddress === undefined
        ? {}
        : { tronDepositAddress: input.tronDepositAddress || null }),
      ...(input.usdtUsdRateMinor === undefined
        ? {}
        : { usdtUsdRateMinor: input.usdtUsdRateMinor }),
      ...(input.usdtRateTtlMinutes === undefined
        ? {}
        : { usdtRateTtlMinutes: input.usdtRateTtlMinutes }),
      ...(input.tronMinConfirmations === undefined
        ? {}
        : { tronMinConfirmations: input.tronMinConfirmations }),
      ...(input.tronPollIntervalSeconds === undefined
        ? {}
        : { tronPollIntervalSeconds: input.tronPollIntervalSeconds }),
      ...(input.usdtAutoVerifyEnabled === undefined
        ? {}
        : { usdtAutoVerifyEnabled: input.usdtAutoVerifyEnabled }),
      ...(input.wireEnabled === undefined ? {} : { wireEnabled: input.wireEnabled }),
      ...(input.wireInstructions === undefined
        ? {}
        : { wireInstructions: input.wireInstructions || null }),
    },
  });

  if (
    input.tronPollIntervalSeconds !== undefined &&
    input.tronPollIntervalSeconds !== before.tronPollIntervalSeconds
  ) {
    // Fire-and-forget: the setting is already saved, and a Redis hiccup here
    // must not fail the request — the next boot re-registers it either way.
    void scheduleUsdtPoll(settings.tronPollIntervalSeconds).catch(
      (err: unknown) => {
        logger.error({ err }, 'Failed to reschedule the USDT poll');
      },
    );
  }

  /*
   * Which fields moved, never their values. An audit row carrying a deposit
   * address would put a payment destination in a table half the org can read,
   * and the address is on the settings row anyway (AGENTS.md, Security & PII).
   *
   * The two switches are the exception: whether crypto is accepted and whether
   * it verifies itself are the entries a reviewer is actually looking for, and
   * neither is sensitive.
   */
  void record({
    actor,
    action: AuditAction.PAYMENT_SETTINGS_UPDATED,
    entityType: 'PaymentSettings',
    entityId: PAYMENT_SETTINGS_ID,
    metadata: {
      fields: Object.keys(input),
      ...(input.usdtEnabled === undefined ? {} : { usdtEnabled: input.usdtEnabled }),
      ...(input.usdtAutoVerifyEnabled === undefined
        ? {}
        : { usdtAutoVerifyEnabled: input.usdtAutoVerifyEnabled }),
      ...(input.wireEnabled === undefined ? {} : { wireEnabled: input.wireEnabled }),
    },
  });

  return settingsView(settings, await countPayableAccounts());
}

// --- Bank accounts -------------------------------------------------------

const FIELD_ORDER = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

const ACCOUNT_INCLUDE = { fields: { orderBy: FIELD_ORDER } } as const;

/*
 * Payments issued against each account. One grouped query rather than a count
 * per row: the list is a short admin-curated set, and the figure decides whether
 * Delete removes the row or archives it, so the screen must not have to guess.
 */
async function accountUsage(): Promise<Map<string, number>> {
  const grouped = await prisma.payment.groupBy({
    by: ['bankAccountId'],
    where: { bankAccountId: { not: null } },
    _count: { _all: true },
  });

  const usage = new Map<string, number>();
  for (const row of grouped) {
    if (row.bankAccountId) usage.set(row.bankAccountId, row._count._all);
  }

  return usage;
}

export async function listBankAccounts(): Promise<{ accounts: BankAccountView[] }> {
  const [rows, usage] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { deletedAt: null },
      include: ACCOUNT_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    accountUsage(),
  ]);

  return {
    accounts: rows.map((row) => accountView(row, usage.get(row.id) ?? 0)),
  };
}

async function readAccount(id: string): Promise<BankAccountWithFields> {
  const account = await prisma.bankAccount.findFirst({
    where: { id, deletedAt: null },
    include: ACCOUNT_INCLUDE,
  });

  if (!account) throw AppError.notFound('Bank account not found');
  return account;
}

export async function createBankAccount(
  actor: AuthContext,
  input: CreateBankAccountInput,
): Promise<BankAccountView> {
  const existing = await prisma.bankAccount.findUnique({
    where: { code: input.code },
  });

  /*
   * A duplicate code is a conflict, not a silent merge — including against an
   * archived row, because the code is what payments were issued under and
   * reusing it would attach an old account's history to a new bank.
   */
  if (existing) {
    throw AppError.conflict(
      `A bank account with the code "${input.code}" already exists`,
    );
  }

  const last = await prisma.bankAccount.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const account = await prisma.bankAccount.create({
    data: {
      code: input.code,
      label: input.label,
      description: input.description || null,
      currency: input.currency,
      active: input.active ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      fields: {
        create: input.fields.map((field, index) => ({
          label: field.label,
          value: field.value,
          copyable: field.copyable,
          emphasis: field.emphasis,
          sortOrder: index,
        })),
      },
    },
    include: ACCOUNT_INCLUDE,
  });

  void record({
    actor,
    action: AuditAction.BANK_ACCOUNT_CREATED,
    entityType: 'BankAccount',
    entityId: account.id,
    // The code and a field COUNT. Never a label, never a value — those are the
    // bank details themselves.
    metadata: { code: account.code, active: account.active, fields: input.fields.length },
  });

  return accountView(account, 0);
}

/*
 * Edit an account.
 *
 * `fields` is a whole-list replace: they are an ordered set that only means
 * anything together, so the rows are deleted and rewritten in one transaction.
 * A half-applied replace would print an IBAN from one bank beside a BIC from
 * another, which is the single worst thing this screen could do.
 *
 * Payments already issued are unaffected — each carries a frozen copy of the
 * card it displayed (`Payment.wireInstructions`), which is exactly so that
 * correcting a typo here never rewrites instructions somebody is acting on.
 */
export async function updateBankAccount(
  actor: AuthContext,
  accountId: string,
  input: UpdateBankAccountInput,
): Promise<BankAccountView> {
  await readAccount(accountId);

  const account = await prisma.$transaction(async (tx) => {
    if (input.fields) {
      await tx.bankAccountField.deleteMany({ where: { accountId } });
      await tx.bankAccountField.createMany({
        data: input.fields.map((field, index) => ({
          accountId,
          label: field.label,
          value: field.value,
          copyable: field.copyable,
          emphasis: field.emphasis,
          sortOrder: index,
        })),
      });
    }

    return tx.bankAccount.update({
      where: { id: accountId },
      data: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.description === undefined
          ? {}
          : { description: input.description || null }),
        ...(input.currency === undefined ? {} : { currency: input.currency }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
      include: ACCOUNT_INCLUDE,
    });
  });

  const payments = (await accountUsage()).get(accountId) ?? 0;

  void record({
    actor,
    action: AuditAction.BANK_ACCOUNT_UPDATED,
    entityType: 'BankAccount',
    entityId: account.id,
    metadata: {
      code: account.code,
      fields: Object.keys(input),
      ...(input.fields ? { fieldCount: input.fields.length } : {}),
      payments,
    },
  });

  return accountView(account, payments);
}

/*
 * Remove an account, or archive it.
 *
 * Unlike locations and carriers — where a referenced row is refused and the
 * admin is told to switch it off — a bank we have stopped using should leave the
 * list rather than sit in it switched off forever. So the verb resolves by
 * usage:
 *
 *   · Nothing referenced it: a genuine "added by mistake", removed outright.
 *   · Payments were issued against it: soft-deleted. The link on those payments
 *     survives (`onDelete: SetNull` never fires), and their instructions were
 *     snapshotted at intent time anyway, so nothing a customer or a reconciler
 *     reads changes. It simply stops being an account.
 *
 * The response says which happened, so the screen can report it rather than
 * implying a hard delete that did not occur.
 */
export async function deleteBankAccount(
  actor: AuthContext,
  accountId: string,
): Promise<{ id: string; removed: 'deleted' | 'archived' }> {
  const account = await readAccount(accountId);
  const payments = (await accountUsage()).get(accountId) ?? 0;

  const removed = payments > 0 ? 'archived' : 'deleted';

  if (payments > 0) {
    await prisma.bankAccount.update({
      where: { id: accountId },
      data: { deletedAt: new Date(), active: false },
    });
  } else {
    // The fields cascade with it.
    await prisma.bankAccount.delete({ where: { id: accountId } });
  }

  void record({
    actor,
    action: AuditAction.BANK_ACCOUNT_DELETED,
    entityType: 'BankAccount',
    entityId: accountId,
    metadata: { code: account.code, removed, payments },
  });

  return { id: accountId, removed };
}

export async function reorderBankAccounts(
  actor: AuthContext,
  input: ReorderBankAccountsInput,
): Promise<{ accounts: BankAccountView[] }> {
  const known = await prisma.bankAccount.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true },
  });

  const ids = new Set(known.map((row) => row.id));
  const unknown = input.ids.filter((id) => !ids.has(id));

  if (unknown.length > 0) {
    throw AppError.validation('Unknown bank account', { ids: unknown });
  }

  /*
   * The complete sequence: the submitted ids in the order given, then every id
   * the payload omitted, in the order it already had. Renumbering only the
   * submitted subset would leave an omitted row sharing a position with a
   * submitted one — a ranking nobody chose.
   */
  const unique = [...new Set(input.ids)];
  const chosen = new Set(unique);
  const ordered = [
    ...unique,
    ...known.map((row) => row.id).filter((id) => !chosen.has(id)),
  ];

  // One transaction: a half-applied reorder leaves two rows sharing a position.
  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.bankAccount.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  void record({
    actor,
    action: AuditAction.BANK_ACCOUNTS_REORDERED,
    entityType: 'BankAccount',
    entityId: 'all',
    metadata: { count: ordered.length, submitted: input.ids.length },
  });

  return listBankAccounts();
}

/*
 * How many accounts a customer could actually be shown — active, not archived,
 * and carrying at least one field.
 *
 * Resolved here rather than counted in the browser so the screen does not
 * re-derive the rule the checkout applies (`listPayableBankAccounts`) and drift
 * from it. It is what lets the settings page warn "wire transfer is switched on
 * but no account is payable" instead of leaving an admin to discover it from a
 * customer.
 */
export async function countPayableAccounts(): Promise<number> {
  return prisma.bankAccount.count({
    where: { deletedAt: null, active: true, fields: { some: {} } },
  });
}
