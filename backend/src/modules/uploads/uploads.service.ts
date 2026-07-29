import type { AuthContext } from '../../guards/auth-context.js';
import { AppError } from '../../lib/app-error.js';
import { Role } from '../../lib/roles.js';
import {
  buildObjectKey,
  presignUpload,
  storageEnabled,
  type PresignedUpload,
} from '../../lib/storage.js';
import { hasPermission } from '../admin/admin.guards.js';
import type { PermissionKey } from '../../lib/permissions.js';
import type { RequestUploadInput, UploadPurpose } from './uploads.validation.js';

/*
 * Minting presigned uploads.
 *
 * The bytes never pass through this process: a caller declares what it wants to
 * upload, we decide whether it may and where the object lands, and it PUTs
 * straight to R2 (AGENTS.md, Storage). Only the resulting object key comes back
 * to us, on the request that attaches the file to something.
 *
 * Everything that makes this safe lives in the policy table below:
 *
 *   - the KEY PREFIX is ours, never the caller's. A client-chosen path could
 *     otherwise overwrite another customer's document.
 *   - the CONTENT TYPE and SIZE are signed into the PUT, so the upload is
 *     rejected unless the bytes match what was authorised.
 *   - the PERMISSION decides who may ask for a slot of that kind at all.
 *
 * The prefix is also checked on the way back in (`assertKeyForPurpose`), so a
 * key minted for an avatar cannot be submitted as a mail scan.
 */

const MB = 1024 * 1024;

const DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type UploadPolicy = {
  // The first segment of every key minted for this purpose. Also what an
  // incoming key is checked against before it is trusted.
  prefix: string;
  contentTypes: readonly string[];
  maxBytes: number;
  /*
   * Who may request this kind of upload. `customer` means any signed-in user
   * (staff included — a staff member has a profile picture too); a
   * PermissionKey means staff holding that admin area.
   */
  access: 'authenticated' | PermissionKey;
  // Whether the key is namespaced per user. Customer-owned files are, so one
  // customer's uploads are never even in the same prefix as another's; team
  // uploads are not, because they are filed against someone else's record.
  perUser: boolean;
};

const POLICIES: Record<UploadPurpose, UploadPolicy> = {
  'order-document': {
    prefix: 'orders',
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 10 * MB,
    access: 'authenticated',
    perUser: true,
  },
  'mail-scan': {
    prefix: 'mail',
    contentTypes: DOCUMENT_TYPES,
    // Higher than the rest: a scanned envelope can be a long multi-page PDF.
    maxBytes: 25 * MB,
    access: 'mailroom',
    perUser: false,
  },
  'result-file': {
    prefix: 'results',
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 20 * MB,
    access: 'orders',
    perUser: false,
  },
  avatar: {
    prefix: 'avatars',
    contentTypes: IMAGE_TYPES,
    maxBytes: 5 * MB,
    access: 'authenticated',
    perUser: true,
  },
  'support-attachment': {
    prefix: 'support',
    contentTypes: DOCUMENT_TYPES,
    maxBytes: 10 * MB,
    access: 'authenticated',
    perUser: true,
  },
};

function describeSize(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`;
}

export async function requestUpload(
  actor: AuthContext,
  input: RequestUploadInput,
): Promise<PresignedUpload> {
  const policy = POLICIES[input.purpose];

  if (policy.access !== 'authenticated') {
    // Staff-only slots are gated by the same permission the matching admin area
    // uses, so an operator who may not work the mail room cannot mint a key that
    // would let them file into one either.
    if (
      actor.role !== Role.ADMIN &&
      !(await hasPermission(actor, policy.access))
    ) {
      throw AppError.unauthorized();
    }
  }

  // Compared case-insensitively and without the `; charset=` suffix browsers
  // append to text types, so a legitimate upload is not refused on formatting.
  const contentType = input.contentType.split(';')[0]?.trim().toLowerCase() ?? '';

  if (!policy.contentTypes.includes(contentType)) {
    throw AppError.validation(
      `${input.contentType} files are not accepted here`,
      { accepted: policy.contentTypes },
    );
  }

  if (input.sizeBytes > policy.maxBytes) {
    throw AppError.validation(
      `Files must be ${describeSize(policy.maxBytes)} or smaller`,
      { maxBytes: policy.maxBytes },
    );
  }

  /*
   * Reported as a business rule rather than a 500: the request is valid and the
   * caller is entitled to it, we simply have nowhere to put the bytes. The
   * frontend surfaces this as "uploads aren't available yet" instead of a
   * generic failure.
   */
  if (!storageEnabled) {
    throw AppError.businessRule(
      'File uploads are not configured on this environment',
    );
  }

  const prefix = policy.perUser
    ? `${policy.prefix}/${actor.userId}`
    : policy.prefix;

  const presigned = await presignUpload({
    objectKey: buildObjectKey(prefix, input.fileName),
    contentType,
    contentLength: input.sizeBytes,
  });

  if (!presigned) {
    throw AppError.businessRule(
      'File uploads are not configured on this environment',
    );
  }

  return presigned;
}

/*
 * Confirms an object key submitted alongside a record was actually minted for
 * that kind of file, and — for customer-owned purposes — minted for THIS caller.
 *
 * Keys are unguessable, so this is a second line of defence rather than the only
 * one. It exists because a key travels through the browser between being minted
 * and being attached: without this check a caller could hold a key back and
 * submit it somewhere it was never meant to go.
 */
export function assertKeyForPurpose(
  actor: AuthContext,
  purpose: UploadPurpose,
  objectKey: string,
): void {
  const policy = POLICIES[purpose];
  const expected = policy.perUser
    ? `${policy.prefix}/${actor.userId}/`
    : `${policy.prefix}/`;

  if (!objectKey.startsWith(expected)) {
    throw AppError.validation('That file reference is not valid here');
  }
}

/*
 * The same check for a key that may legitimately belong to someone else — a
 * staff member filing a scan the operator uploaded, where the prefix is right
 * but the owner segment is not theirs. Only the kind of file is asserted.
 */
export function assertKeyKind(purpose: UploadPurpose, objectKey: string): void {
  if (!objectKey.startsWith(`${POLICIES[purpose].prefix}/`)) {
    throw AppError.validation('That file reference is not valid here');
  }
}

export const uploadPolicies = POLICIES;
