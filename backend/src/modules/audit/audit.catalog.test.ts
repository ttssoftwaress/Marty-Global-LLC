import { describe, expect, it } from 'vitest';

import {
  AUDIT_CATEGORIES,
  actionsInCategory,
  auditActionOptions,
  describe as describeAction,
  isAuditCategory,
} from './audit.catalog.js';
import { AuditAction } from './audit.service.js';

/*
 * The audit catalogue — the read half of the trail.
 *
 * Worth testing because it is the one place a gap is silent: an action with no
 * entry still renders (by design), so a missing label does not throw, it just
 * shows an admin a raw dotted verb on the screen they use to investigate. The
 * compile-time check in the catalogue catches an omission, and these assert the
 * behaviour that check cannot express.
 */

const ALL_ACTIONS = Object.values(AuditAction);

describe('audit catalogue', () => {
  it('gives every recorded action a label, a category, and a severity', () => {
    for (const action of ALL_ACTIONS) {
      const described = describeAction(action);

      expect(described.label, action).not.toBe('');
      // 'other' is the fallback for a verb whose prefix names no category. No
      // catalogued action may land there — that is the unknown-action path.
      expect(described.category, action).not.toBe('other');
      expect(isAuditCategory(described.category), action).toBe(true);
    }
  });

  it('never labels a known action with its raw verb', () => {
    // The prettified fallback would produce "Sign in failed" from the verb
    // itself. A real entry reads "Sign-in failed", so a label that still
    // contains an underscore or a dot means the entry was missed.
    for (const action of ALL_ACTIONS) {
      expect(describeAction(action).label, action).not.toMatch(/[_.]/);
    }
  });

  it('flags the events an admin must not scroll past', () => {
    // Not an exhaustive severity map — these are the specific rows the screen's
    // one visual signal exists for, and downgrading any of them silently would
    // defeat it.
    const mustAlert = [
      AuditAction.SIGN_IN_FAILED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.EMAIL_CHANGED,
      AuditAction.ROLE_CHANGED,
      AuditAction.STAFF_CREATED,
      AuditAction.STAFF_UPDATED,
      AuditAction.STAFF_DELETED,
      AuditAction.PAYMENT_MISMATCHED,
      AuditAction.ORDER_DOCUMENT_ACCESSED,
      AuditAction.RESULT_FILE_ACCESSED,
    ];

    for (const action of mustAlert) {
      expect(describeAction(action).severity, action).toBe('alert');
    }
  });

  it('routes every auth event into the auth category', () => {
    // The category tabs are how an admin reaches the authentication trail at
    // all; an auth action filed elsewhere would be unreachable from that tab.
    const authActions = ALL_ACTIONS.filter((action) => action.startsWith('auth.'));

    expect(authActions.length).toBeGreaterThan(0);
    for (const action of authActions) {
      expect(describeAction(action).category, action).toBe('auth');
    }
  });

  it('resolves an unknown verb rather than dropping it', () => {
    // Rows outlive the catalogue: a verb retired two releases ago is still in
    // the table and still has to read.
    const retired = describeAction('billing.some_retired_verb');

    expect(retired.label).toBe('Some retired verb');
    expect(retired.category).toBe('billing');
    // An unrecognised verb is never treated as serious — tinting it would make
    // the one signal on the screen fire on the rows we know least about.
    expect(retired.severity).toBe('normal');
  });

  it('files a verb with no known prefix under "other"', () => {
    expect(describeAction('nonsense.thing').category).toBe('other');
    expect(describeAction('bareverb').label).toBe('Bareverb');
  });

  it('covers every category with at least one action', () => {
    // A tab that can only ever be empty is a dead control.
    for (const category of AUDIT_CATEGORIES) {
      expect(actionsInCategory(category.key), category.key).not.toHaveLength(0);
    }
  });

  it('offers every action as a filter option exactly once', () => {
    const options = auditActionOptions();
    const values = options.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
    expect(new Set(values)).toEqual(new Set(ALL_ACTIONS));
  });
});
