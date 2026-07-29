import { AuditAction } from './audit.service.js';

/*
 * What each audited action is called, and which section of the log it belongs
 * to. The read half of `audit.service.ts` — that file decides what gets written,
 * this one decides how it reads.
 *
 * Server-owned for the same reason the permission catalogue is (lib/permissions.ts):
 * the viewer renders whatever this publishes, so adding an audited event is a
 * backend change rather than a frontend deploy. The browser never maps an action
 * verb to words.
 *
 * Two rules:
 *
 * 1. Every action in `AuditAction` has an entry. The exhaustiveness check at the
 *    bottom of this file is a compile error otherwise — a new audited event
 *    cannot ship as a raw dotted verb in the admin's screen.
 *
 * 2. An action NOT in this map still renders. Rows outlive the catalogue: a verb
 *    retired two releases ago is still in the table and still has to be readable,
 *    so `describe` falls back to prettifying the verb rather than dropping the
 *    row or printing nothing.
 */

export type AuditCategoryKey =
  | 'auth'
  | 'orders'
  | 'delivery'
  | 'billing'
  | 'catalog'
  | 'mailroom'
  | 'team'
  | 'support'
  | 'settings';

/*
 * The sections the viewer tabs on. Ordered by how often an admin opens them
 * rather than alphabetically — `auth` leads because "who signed in, and what
 * failed" is the question that brings someone to this screen, and it is the one
 * section with no other surface in the admin portal showing the same events.
 */
export const AUDIT_CATEGORIES: readonly { key: AuditCategoryKey; label: string }[] = [
  { key: 'auth', label: 'Authentication' },
  { key: 'orders', label: 'Orders' },
  { key: 'delivery', label: 'Service delivery' },
  { key: 'billing', label: 'Quotes & payments' },
  { key: 'catalog', label: 'Catalog & fields' },
  { key: 'mailroom', label: 'Virtual mail' },
  { key: 'team', label: 'Team & staff' },
  { key: 'support', label: 'Support' },
  { key: 'settings', label: 'Business settings' },
];

/*
 * Severity, as the viewer tints a row.
 *
 * Not stored on the row — it is a property of the action, so deriving it here
 * means re-classifying an event never requires a migration over history.
 *
 * `alert` is reserved for the handful an admin should never scroll past: a
 * failed sign-in, a payment that did not reconcile, and every change to who
 * holds access. `notice` marks the writes that move money or grant something.
 * Everything else is `normal` — the bulk of the table, and marking it would make
 * the tint mean nothing.
 */
export type AuditSeverity = 'normal' | 'notice' | 'alert';

type Entry = { label: string; category: AuditCategoryKey; severity: AuditSeverity };

const CATALOG: Record<string, Entry> = {
  // --- Authentication ----------------------------------------------------
  [AuditAction.SIGN_IN]: { label: 'Signed in', category: 'auth', severity: 'normal' },
  [AuditAction.SIGN_IN_FAILED]: {
    label: 'Sign-in failed',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.SIGN_OUT]: { label: 'Signed out', category: 'auth', severity: 'normal' },
  [AuditAction.SIGN_UP]: {
    label: 'Account created',
    category: 'auth',
    severity: 'notice',
  },
  [AuditAction.PASSWORD_CHANGED]: {
    label: 'Password changed',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.PASSWORD_RESET_REQUESTED]: {
    label: 'Password reset requested',
    category: 'auth',
    severity: 'notice',
  },
  [AuditAction.EMAIL_CHANGED]: {
    label: 'Email address changed',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.ROLE_CHANGED]: {
    label: 'Role changed',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.ACCOUNT_BANNED]: {
    label: 'Account banned',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.ACCOUNT_UNBANNED]: {
    label: 'Account unbanned',
    category: 'auth',
    severity: 'alert',
  },
  [AuditAction.SESSIONS_REVOKED]: {
    label: 'Sessions revoked',
    category: 'auth',
    severity: 'alert',
  },

  // --- Orders ------------------------------------------------------------
  [AuditAction.ORDER_STATUS_CHANGED]: {
    label: 'Order status changed',
    category: 'orders',
    severity: 'normal',
  },
  [AuditAction.ORDER_ASSIGNED]: {
    label: 'Order assigned',
    category: 'orders',
    severity: 'normal',
  },
  [AuditAction.ORDER_ACTIVITY_ADDED]: {
    label: 'Order note added',
    category: 'orders',
    severity: 'normal',
  },
  // A read, not a write — staff opening a customer's identity document. Marked
  // `alert` for the reason audit.service.ts records it at all: who looked at a
  // passport is the question this table exists to answer.
  [AuditAction.ORDER_DOCUMENT_ACCESSED]: {
    label: 'Customer document opened',
    category: 'orders',
    severity: 'alert',
  },
  // A write, and an ordinary one: asking for a document is routine review work.
  // The `alert` above is about *reading* a passport, which this is not.
  [AuditAction.ORDER_DOCUMENT_REQUESTED]: {
    label: 'Document requested from customer',
    category: 'orders',
    severity: 'normal',
  },
  // The customer supplying a file. A write and a routine one — the `alert` two
  // entries up is about staff *reading* a passport, which this is not.
  [AuditAction.ORDER_DOCUMENT_UPLOADED]: {
    label: 'Document uploaded by customer',
    category: 'orders',
    severity: 'normal',
  },

  // --- Service delivery --------------------------------------------------
  [AuditAction.RESULT_DELIVERED]: {
    label: 'Record delivered',
    category: 'delivery',
    severity: 'notice',
  },
  [AuditAction.RESULT_UPDATED]: {
    label: 'Delivered record edited',
    category: 'delivery',
    severity: 'normal',
  },
  [AuditAction.RESULT_STATUS_CHANGED]: {
    label: 'Delivered record status changed',
    category: 'delivery',
    severity: 'normal',
  },
  // The other audited read — a certificate or registration document belonging to
  // the customer. Same reasoning as the order document above.
  [AuditAction.RESULT_FILE_ACCESSED]: {
    label: 'Delivered file opened',
    category: 'delivery',
    severity: 'alert',
  },
  [AuditAction.ORDER_ITEM_STATUS_CHANGED]: {
    label: 'Order item status changed',
    category: 'delivery',
    severity: 'normal',
  },
  [AuditAction.SERVICE_REQUEST_STATUS_CHANGED]: {
    label: 'Service request status changed',
    category: 'delivery',
    severity: 'normal',
  },
  [AuditAction.SERVICE_REQUEST_ASSIGNED]: {
    label: 'Service request assigned',
    category: 'delivery',
    severity: 'normal',
  },

  // --- Quotes & payments -------------------------------------------------
  [AuditAction.QUOTE_SENT]: {
    label: 'Quote sent',
    category: 'billing',
    severity: 'notice',
  },
  [AuditAction.QUOTE_CANCELLED]: {
    label: 'Quote cancelled',
    category: 'billing',
    severity: 'notice',
  },
  [AuditAction.PAYMENT_REMINDER_SENT]: {
    label: 'Payment reminder sent',
    category: 'billing',
    severity: 'normal',
  },
  [AuditAction.PAYMENT_INTENT_CREATED]: {
    label: 'Payment window opened',
    category: 'billing',
    severity: 'normal',
  },
  [AuditAction.PAYMENT_CANCELLED]: {
    label: 'Payment cancelled',
    category: 'billing',
    severity: 'notice',
  },
  [AuditAction.PAYMENT_CREDITED]: {
    label: 'Payment credited',
    category: 'billing',
    severity: 'notice',
  },
  // Money arrived and did not match what was expected. An admin has to act on
  // it, which is what separates this from every other payment row.
  [AuditAction.PAYMENT_MISMATCHED]: {
    label: 'Payment amount mismatched',
    category: 'billing',
    severity: 'alert',
  },
  [AuditAction.PAYMENT_EXPIRED]: {
    label: 'Payment window expired',
    category: 'billing',
    severity: 'normal',
  },
  // Money we cannot attribute to anyone. `alert` for the same reason as the
  // mismatch above: it sits in a queue until a human decides what it was.
  [AuditAction.UNMATCHED_TRANSFER_RECORDED]: {
    label: 'Unmatched transfer received',
    category: 'billing',
    severity: 'alert',
  },
  [AuditAction.UNMATCHED_TRANSFER_RESOLVED]: {
    label: 'Unmatched transfer resolved',
    category: 'billing',
    severity: 'notice',
  },

  // --- Catalog & fields --------------------------------------------------
  [AuditAction.SERVICE_CREATED]: {
    label: 'Service created',
    category: 'catalog',
    severity: 'notice',
  },
  [AuditAction.SERVICE_UPDATED]: {
    label: 'Service updated',
    category: 'catalog',
    severity: 'notice',
  },
  [AuditAction.SERVICE_DELETED]: {
    label: 'Service deleted',
    category: 'catalog',
    severity: 'alert',
  },
  [AuditAction.FIELD_CREATED]: {
    label: 'Form field created',
    category: 'catalog',
    severity: 'normal',
  },
  [AuditAction.FIELD_UPDATED]: {
    label: 'Form field updated',
    category: 'catalog',
    severity: 'normal',
  },
  [AuditAction.FIELD_DELETED]: {
    label: 'Form field deleted',
    category: 'catalog',
    severity: 'notice',
  },
  [AuditAction.RESULT_FIELD_CREATED]: {
    label: 'Result field created',
    category: 'catalog',
    severity: 'normal',
  },
  [AuditAction.RESULT_FIELD_UPDATED]: {
    label: 'Result field updated',
    category: 'catalog',
    severity: 'normal',
  },
  [AuditAction.RESULT_FIELD_DELETED]: {
    label: 'Result field deleted',
    category: 'catalog',
    severity: 'notice',
  },
  [AuditAction.RESULT_SCHEMA_UPDATED]: {
    label: 'Delivery schema updated',
    category: 'catalog',
    severity: 'notice',
  },
  // One entry, matching the one verb — see the note in audit.service.ts for why
  // the batch write does not split into created/updated.
  [AuditAction.REQUEST_TYPE_UPDATED]: {
    label: 'Request types updated',
    category: 'catalog',
    severity: 'normal',
  },

  // --- Virtual mail ------------------------------------------------------
  [AuditAction.MAIL_ROOM_PROVISIONED]: {
    label: 'Mail room opened',
    category: 'mailroom',
    severity: 'notice',
  },
  [AuditAction.MAIL_SCAN_UPLOADED]: {
    label: 'Mail scan uploaded',
    category: 'mailroom',
    severity: 'normal',
  },
  [AuditAction.MAIL_REQUEST_CREATED]: {
    label: 'Mail request raised',
    category: 'mailroom',
    severity: 'normal',
  },
  [AuditAction.MAIL_REQUEST_PROCESSED]: {
    label: 'Mail request processed',
    category: 'mailroom',
    severity: 'normal',
  },
  [AuditAction.MAIL_REQUEST_RESOLVED]: {
    label: 'Mail request resolved',
    category: 'mailroom',
    severity: 'normal',
  },

  // --- Team & staff ------------------------------------------------------
  // All three are `alert`: they are how access to every other area is handed out
  // or taken away, and an unexpected one is the single most serious row here.
  [AuditAction.STAFF_CREATED]: {
    label: 'Staff account created',
    category: 'team',
    severity: 'alert',
  },
  [AuditAction.STAFF_UPDATED]: {
    label: 'Staff role or access changed',
    category: 'team',
    severity: 'alert',
  },
  [AuditAction.STAFF_DELETED]: {
    label: 'Staff account deleted',
    category: 'team',
    severity: 'alert',
  },

  // --- Support -----------------------------------------------------------
  [AuditAction.CONVERSATION_ASSIGNED]: {
    label: 'Conversation assigned',
    category: 'support',
    severity: 'normal',
  },
  [AuditAction.CONVERSATION_STATUS_CHANGED]: {
    label: 'Conversation status changed',
    category: 'support',
    severity: 'normal',
  },

  // --- Business settings -------------------------------------------------
  [AuditAction.LOCATION_CREATED]: {
    label: 'Location added',
    category: 'settings',
    severity: 'notice',
  },
  [AuditAction.LOCATION_UPDATED]: {
    label: 'Location updated',
    category: 'settings',
    severity: 'normal',
  },
  [AuditAction.LOCATION_DELETED]: {
    label: 'Location removed',
    category: 'settings',
    severity: 'alert',
  },
  [AuditAction.LOCATIONS_REORDERED]: {
    label: 'Locations reordered',
    category: 'settings',
    severity: 'normal',
  },
  [AuditAction.CARRIER_CREATED]: {
    label: 'Mail carrier added',
    category: 'settings',
    severity: 'notice',
  },
  [AuditAction.CARRIER_UPDATED]: {
    label: 'Mail carrier updated',
    category: 'settings',
    severity: 'normal',
  },
  [AuditAction.CARRIER_DELETED]: {
    label: 'Mail carrier removed',
    category: 'settings',
    severity: 'notice',
  },
  [AuditAction.CARRIERS_REORDERED]: {
    label: 'Mail carriers reordered',
    category: 'settings',
    severity: 'normal',
  },
};

/*
 * Rule 1 above, as a compile-time check. `satisfies` on the object literal would
 * be the obvious way to write it, but the keys are computed from `AuditAction`,
 * and TypeScript widens a computed key to `string` — so the literal cannot know
 * it covers the union. This asserts the coverage separately: the assignment
 * fails if `CATALOG` is missing an action.
 *
 * It has no runtime cost — the value is the same object, and nothing reads this
 * binding.
 */
const _exhaustive: Record<AuditAction, Entry> = CATALOG as Record<AuditAction, Entry>;
void _exhaustive;

/*
 * Rule 2: an unknown verb still reads. "billing.quote_sent" with no entry
 * becomes "Quote sent" in the `billing` category — the dotted verb already
 * carries both, which is why the convention is worth keeping.
 */
function prettify(action: string): string {
  const verb = action.includes('.') ? action.slice(action.indexOf('.') + 1) : action;
  const words = verb.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const CATEGORY_KEYS = new Set<string>(AUDIT_CATEGORIES.map((entry) => entry.key));

function inferCategory(action: string): AuditCategoryKey | 'other' {
  const prefix = action.split('.')[0] ?? '';
  return CATEGORY_KEYS.has(prefix) ? (prefix as AuditCategoryKey) : 'other';
}

export type AuditDescription = {
  label: string;
  category: AuditCategoryKey | 'other';
  severity: AuditSeverity;
};

export function describe(action: string): AuditDescription {
  const entry = CATALOG[action];
  if (entry) return { label: entry.label, category: entry.category, severity: entry.severity };

  return {
    label: prettify(action),
    category: inferCategory(action),
    // An unrecognised verb is not treated as serious. Tinting it would make the
    // one signal on this screen fire on the rows we know least about.
    severity: 'normal',
  };
}

/*
 * The action verbs a category covers, for the list query's `where`.
 *
 * Built from the catalogue rather than from a `startsWith` on the prefix,
 * because the two do not always agree: `delivery.*` and `catalog.*` each hold
 * actions the screen groups elsewhere, and the category an admin picked must
 * select exactly the rows the same category prints on those rows.
 *
 * The prefix is still included as a fallback so a historical verb with no
 * catalogue entry lands in the category its own prefix names — otherwise
 * filtering to a category would silently hide rows that display under it.
 */
export function actionsInCategory(category: string): string[] {
  return Object.entries(CATALOG)
    .filter(([, entry]) => entry.category === category)
    .map(([action]) => action);
}

export function isAuditCategory(value: string): boolean {
  return CATEGORY_KEYS.has(value);
}

/*
 * Every action the viewer offers as a filter, grouped by category and labelled.
 * Published with the summary so the action dropdown is server-driven, exactly
 * like the category tabs.
 */
export function auditActionOptions(): {
  value: string;
  label: string;
  category: AuditCategoryKey;
}[] {
  return Object.entries(CATALOG)
    .map(([value, entry]) => ({
      value,
      label: entry.label,
      category: entry.category,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
