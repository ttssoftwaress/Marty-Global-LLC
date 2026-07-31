/*
 * Payment configuration — local mirror of the API shapes `/admin/settings`
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles against the same contract.
 *
 * MONEY: the USD→USDT rate is an integer numerator over 1_000_000, never a
 * float. The form edits it as a decimal string for readability and converts on
 * both sides with integer arithmetic (`admin/lib/payment-settings.ts`) — no
 * `parseFloat`, no `toFixed` (AGENTS.md, Money).
 */

export type PaymentSettings = {
  usdt: {
    enabled: boolean;
    depositAddress: string | null;
    /** USDT-per-USD numerator over 1_000_000. 1000000 is parity. */
    rateMinor: number;
    rateTtlMinutes: number;
    minConfirmations: number;
    pollIntervalSeconds: number;
    /**
     * Whether the chain sweep credits payments on its own. Off, USDT is settled
     * by hand like a bank transfer — the poller idles and whoever holds
     * `payments.settle` confirms each transfer against a block explorer.
     */
    autoVerifyEnabled: boolean;
    /**
     * The two facts this screen shows but cannot change: both are deployment
     * level (server env). The contract address is hardcoded per network on
     * purpose — an attacker-supplied one would credit invoices for worthless
     * look-alike tokens.
     */
    network: 'mainnet' | 'nile';
    contractAddress: string;
    /** Whether a TronGrid key is configured — a boolean, never the key. */
    apiKeyConfigured: boolean;
  };
  wire: {
    enabled: boolean;
    instructions: string | null;
  };
  /**
   * How many bank accounts a customer could actually be shown — active, not
   * archived, and carrying at least one field. Resolved server-side so this
   * screen does not re-derive the rule the checkout applies.
   */
  payableAccounts: number;
  updatedAt: string;
};

export type PaymentSettingsPayload = Partial<{
  usdtEnabled: boolean;
  tronDepositAddress: string;
  usdtUsdRateMinor: number;
  usdtRateTtlMinutes: number;
  tronMinConfirmations: number;
  tronPollIntervalSeconds: number;
  usdtAutoVerifyEnabled: boolean;
  wireEnabled: boolean;
  wireInstructions: string;
}>;

/*
 * One labelled line on a bank account's checkout card.
 *
 * The admin owns both halves — "IBAN" / "GB29 NWBK…", "Beneficiary" / "Marty
 * Global LLC" — which is what makes the card work for any country's banking
 * without a schema change. Nothing in this app assumes a field named `iban`.
 */
export type BankAccountField = {
  label: string;
  value: string;
  /** Renders with a copy button at checkout. */
  copyable: boolean;
  /** Renders larger and monospaced — the one or two lines that matter most. */
  emphasis: boolean;
};

export type BankAccount = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  currency: string;
  active: boolean;
  sortOrder: number;
  fields: BankAccountField[];
  /** Payments issued against this account — what decides whether Delete
   *  removes the row or archives it. */
  usage: { payments: number };
  updatedAt: string;
};

export type BankAccountCreatePayload = {
  code: string;
  label: string;
  description?: string;
  currency: string;
  active: boolean;
  fields: BankAccountField[];
};

// No `code`: it is stored on every payment issued through the account, so it is
// immutable once the row exists — the same rule locations and carriers follow.
export type BankAccountUpdatePayload = Partial<{
  label: string;
  description: string;
  currency: string;
  active: boolean;
  fields: BankAccountField[];
}>;

/** What a delete actually did — a used account is archived, not removed. */
export type BankAccountDeleteResult = {
  id: string;
  removed: 'deleted' | 'archived';
};

// --- Draft state the form edits -----------------------------------------

export type BankFieldDraft = BankAccountField & {
  /** Stable across reorders and removals, so React keys don't reuse rows. */
  key: string;
};

export type BankAccountDraft = {
  code: string;
  label: string;
  description: string;
  currency: string;
  active: boolean;
  fields: BankFieldDraft[];
};

export type BankAccountFormErrors = Partial<
  Record<'code' | 'label' | 'currency' | 'fields', string>
>;

export type PaymentSettingsErrors = Partial<
  Record<
    | 'tronDepositAddress'
    | 'usdtUsdRateMinor'
    | 'usdtRateTtlMinutes'
    | 'tronMinConfirmations'
    | 'tronPollIntervalSeconds',
    string
  >
>;
