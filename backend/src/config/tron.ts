import { env } from './env.js';
import { logger } from '../lib/logger.js';

/*
 * TronGrid — the read-only chain client (AGENTS.md, Payments: "we watch
 * transfers, we never sign or move funds"). There is no private key, no signing,
 * and no write call anywhere in this file or anything that imports it.
 *
 * The one security-critical fact here is the USDT contract address. A TRC-20
 * token can claim any name and symbol it likes, so "the transfer said USDT" is
 * worthless — a scam token named USDT costs nothing to deploy. Only the contract
 * address identifies the real asset, which is why it is a hardcoded constant per
 * network rather than an env var: a typo'd or attacker-supplied address in the
 * environment would credit real invoices for worthless tokens.
 */

// The official Tether USDT TRC-20 contracts. Verified, network-pinned, and NOT
// configurable — see above.
const USDT_CONTRACT = {
  mainnet: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  nile: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
} as const;

const TRONGRID_BASE_URL = {
  mainnet: 'https://api.trongrid.io',
  nile: 'https://nile.trongrid.io',
} as const;

// USDT is a 6-decimal token on every network. Stored alongside the raw integer
// on the Payment row so a future token with different precision can't be
// misread (AGENTS.md, Money).
export const USDT_DECIMALS = 6;

export const tronConfig = {
  network: env.TRON_NETWORK,
  baseUrl: TRONGRID_BASE_URL[env.TRON_NETWORK],
  usdtContract: USDT_CONTRACT[env.TRON_NETWORK],
  depositAddress: env.TRON_DEPOSIT_ADDRESS,
  minConfirmations: env.TRON_MIN_CONFIRMATIONS,
  pollIntervalSeconds: env.TRON_POLL_INTERVAL_SECONDS,
  apiKey: env.TRONGRID_API_KEY,
} as const;

// Without a receiving address there is nothing to watch; the poller checks this
// and idles rather than erroring every interval.
export function isTronConfigured(): boolean {
  return Boolean(tronConfig.depositAddress);
}

/*
 * One TRC-20 transfer as TronGrid reports it. Amounts arrive as decimal strings
 * of the raw integer ("1500000" = 1.5 USDT) — kept as strings all the way to
 * BigInt so a large value never touches a float (AGENTS.md, Money).
 */
export type TronTransfer = {
  transactionId: string;
  from: string;
  to: string;
  /** Raw integer amount as a decimal string, at `USDT_DECIMALS` precision. */
  value: string;
  /** Contract that emitted the transfer — verified against `usdtContract`. */
  contractAddress: string;
  /** Milliseconds since epoch, from the block. */
  blockTimestamp: number;
};

type Trc20ApiRow = {
  transaction_id?: unknown;
  from?: unknown;
  to?: unknown;
  value?: unknown;
  block_timestamp?: unknown;
  type?: unknown;
  token_info?: { address?: unknown; decimals?: unknown } | null;
};

type Trc20ApiResponse = {
  success?: unknown;
  data?: unknown;
};

const isString = (value: unknown): value is string => typeof value === 'string';

/*
 * TronGrid's response is untrusted input — it comes off the network. Every row
 * is validated structurally, and any row that is malformed, from the wrong
 * contract, at the wrong precision, or not a plain Transfer is dropped rather
 * than coerced. A dropped row is a row we simply don't credit; a coerced row
 * could be a credit for a token that isn't USDT.
 */
function parseTransfer(row: Trc20ApiRow, expectedContract: string): TronTransfer | null {
  const { transaction_id: txId, from, to, value, block_timestamp: ts } = row;

  if (!isString(txId) || !isString(from) || !isString(to)) return null;

  // Value must be a plain non-negative integer string. Anything with a decimal
  // point, sign, or exponent is not a raw token amount.
  if (!isString(value) || !/^\d+$/.test(value)) return null;

  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;

  // `type` is absent on plain transfers and set to "Approval" and friends on
  // other events. Only a Transfer moves value.
  if (row.type !== undefined && row.type !== 'Transfer') return null;

  const contractAddress = row.token_info?.address;
  if (!isString(contractAddress)) return null;

  // THE check: the real USDT contract, case-sensitively. Everything else is a
  // look-alike token.
  if (contractAddress !== expectedContract) return null;

  // A token claiming a different precision is not the USDT we priced against.
  const decimals = row.token_info?.decimals;
  if (decimals !== undefined && decimals !== USDT_DECIMALS) return null;

  return {
    transactionId: txId,
    from,
    to,
    value,
    contractAddress,
    blockTimestamp: ts,
  };
}

/*
 * Every USDT transfer into our deposit address since `sinceMs`, newest first.
 * Read-only: this is a GET, and the API key (when present) is a read key.
 *
 * TronGrid caps a page at 200; we page until the window is exhausted or the cap
 * is hit so a burst of deposits can't leave transfers unseen.
 */
export async function fetchUsdtTransfers(
  sinceMs: number,
  { maxPages = 5, pageSize = 200 } = {},
): Promise<TronTransfer[]> {
  const address = tronConfig.depositAddress;
  if (!address) return [];

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (tronConfig.apiKey) headers['TRON-PRO-API-KEY'] = tronConfig.apiKey;

  const transfers: TronTransfer[] = [];

  let url =
    `${tronConfig.baseUrl}/v1/accounts/${address}/transactions/trc20` +
    `?only_to=true&limit=${pageSize}&order_by=block_timestamp,desc` +
    `&min_timestamp=${sinceMs}&contract_address=${tronConfig.usdtContract}`;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Log the status only — never the key, never the body (AGENTS.md: log the
      // detail, never leak the provider error).
      throw new Error(`TronGrid request failed with status ${response.status}`);
    }

    const body = (await response.json()) as Trc20ApiResponse;
    const rows = Array.isArray(body.data) ? (body.data as Trc20ApiRow[]) : [];

    for (const row of rows) {
      const transfer = parseTransfer(row, tronConfig.usdtContract);
      // `only_to` is a query hint, not a guarantee we should trust — re-check
      // the destination ourselves before treating this as a deposit.
      if (transfer && transfer.to === address) transfers.push(transfer);
    }

    const next = (body as { meta?: { links?: { next?: unknown } } }).meta?.links?.next;
    if (rows.length < pageSize || !isString(next)) break;
    url = next;
  }

  return transfers;
}

/*
 * The current block height, used to turn a transfer's block into a confirmation
 * count. Returns null when the node can't be read — the caller then holds the
 * payment rather than crediting it, because an unknown confirmation depth must
 * never be treated as "deep enough".
 */
export async function fetchLatestBlockNumber(): Promise<number | null> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (tronConfig.apiKey) headers['TRON-PRO-API-KEY'] = tronConfig.apiKey;

  try {
    const response = await fetch(`${tronConfig.baseUrl}/wallet/getnowblock`, {
      method: 'POST',
      headers,
      body: '{}',
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      block_header?: { raw_data?: { number?: unknown } };
    };

    const number = body.block_header?.raw_data?.number;
    return typeof number === 'number' && Number.isFinite(number) ? number : null;
  } catch (error) {
    logger.error({ err: error }, 'Failed to read latest Tron block');
    return null;
  }
}

/*
 * A transfer's confirmation count. TronGrid's TRC-20 endpoint returns a block
 * timestamp rather than a block number, so depth is derived from elapsed time
 * against Tron's fixed 3-second block interval — deliberately floored, so an
 * estimate is never optimistic about how deep a transfer is.
 */
export const TRON_BLOCK_SECONDS = 3;

export function estimateConfirmations(blockTimestampMs: number, nowMs: number): number {
  const elapsedSeconds = Math.floor((nowMs - blockTimestampMs) / 1000);
  if (elapsedSeconds <= 0) return 0;
  return Math.floor(elapsedSeconds / TRON_BLOCK_SECONDS);
}
