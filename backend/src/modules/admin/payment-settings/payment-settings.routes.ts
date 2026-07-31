import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './payment-settings.controller.js';

/*
 * Payment configuration, mounted under the admin router (requireAuth +
 * requireStaff already applied).
 *
 * Reading takes the `payments` area rather than `settings`: this is where the
 * money goes, so it belongs to whoever works the ledger, not to whoever curates
 * the location list. Writing is admin-only on top of that, and that pairing is
 * not a formality — the deposit address decides where every future crypto
 * payment lands, and a bank account's fields decide it for wires. It is the same
 * "account-level" bar the catalog and business-settings writes sit behind, for a
 * change with more reach than either.
 *
 * The bank details these endpoints carry are published figures — the same ones
 * that go on an invoice — and nothing here reads or writes a credential. The
 * TronGrid key stays in server env and is reported only as a boolean.
 */

const router = Router();

router.use(requirePermission('payments'));

router.get('/', apiRateLimit, controller.getSettings);
router.patch('/', requireAdmin, sensitiveRateLimit, controller.updateSettings);

// --- Bank accounts -------------------------------------------------------
router.get('/bank-accounts', apiRateLimit, controller.listBankAccounts);
router.post(
  '/bank-accounts',
  requireAdmin,
  sensitiveRateLimit,
  controller.createBankAccount,
);
/*
 * Declared before `/bank-accounts/:accountId` so the literal segment is not
 * swallowed by the parameter — Express matches in mount order, and "order" is a
 * valid-looking id (the same ordering the business-settings router uses).
 */
router.put(
  '/bank-accounts/order',
  requireAdmin,
  sensitiveRateLimit,
  controller.reorderBankAccounts,
);
router.patch(
  '/bank-accounts/:accountId',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateBankAccount,
);
router.delete(
  '/bank-accounts/:accountId',
  requireAdmin,
  sensitiveRateLimit,
  controller.deleteBankAccount,
);

export const adminPaymentSettingsRouter = router;
