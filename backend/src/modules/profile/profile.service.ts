import { Prisma } from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import type {
  UpdateCompanyInput,
  UpdateNotificationPreferencesInput,
  UpdateProfileInput,
} from './profile.validation.js';

/*
 * Account settings: the customer's profile, their company, and their
 * notification preferences. All Prisma access lives here.
 *
 * Name and email live on the Better Auth `user` row (the session is their source
 * of truth); phone, avatar, and timezone are ours on a satellite record created
 * lazily on first save, so a Better Auth regeneration never touches them
 * (schema.prisma). Passwords are Better Auth's alone — nothing here reads or
 * writes one.
 *
 * Phone is PII and never logged (AGENTS.md, Security & PII).
 */

// --- Profile -------------------------------------------------------------
export type ProfileInfo = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
};

export async function getProfile(
  req: Parameters<typeof getAuth>[0],
): Promise<ProfileInfo> {
  const auth = getAuth(req);

  const user = await prisma.user.findFirst({
    where: { id: auth.userId, deletedAt: null },
    include: { profile: true },
  });

  if (!user) {
    throw AppError.notFound('Profile not found');
  }

  return {
    fullName: user.name,
    email: user.email,
    phone: user.profile?.phone ?? '',
    // Short-TTL presigned URL, minted after the ownership check above
    // (AGENTS.md, Security & PII); absent until an avatar is uploaded.
    avatarUrl: presignObject(user.profile?.avatarKey),
  };
}

export async function updateProfile(
  req: Parameters<typeof getAuth>[0],
  input: UpdateProfileInput,
): Promise<ProfileInfo> {
  const auth = getAuth(req);

  // Email is the account identifier — a collision would silently merge two
  // customers, so it is a 409 rather than a write that fails at the constraint.
  if (input.email !== auth.email) {
    const taken = await prisma.user.findFirst({
      where: { email: input.email, id: { not: auth.userId }, deletedAt: null },
      select: { id: true },
    });
    if (taken) {
      throw AppError.conflict('That email address is already in use');
    }
  }

  // Name/email on the auth row, phone on the satellite — one transaction so the
  // two halves of a single Save can never diverge.
  const [user, profile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: auth.userId },
      data: { name: input.fullName, email: input.email },
    }),
    prisma.customerProfile.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, phone: input.phone || null },
      update: { phone: input.phone || null },
    }),
  ]);

  return {
    fullName: user.name,
    email: user.email,
    phone: profile.phone ?? '',
    avatarUrl: presignObject(profile.avatarKey),
  };
}

// --- Company -------------------------------------------------------------
// A customer has at most one company — the Company-details frame edits a single
// record, created lazily on first save.
export type CompanyDetails = {
  businessName: string;
  country: string;
  industry: string;
  address: string;
};

const EMPTY_COMPANY: CompanyDetails = {
  businessName: '',
  country: '',
  industry: '',
  address: '',
};

export async function getCompany(
  req: Parameters<typeof getAuth>[0],
): Promise<CompanyDetails> {
  const auth = getAuth(req);

  const company = await prisma.company.findFirst({
    where: { ownerId: auth.userId, deletedAt: null },
  });

  // No company yet is a valid state, not a 404 — the form renders empty and the
  // first Save creates the record.
  if (!company) return EMPTY_COMPANY;

  return {
    businessName: company.businessName,
    country: company.country,
    industry: company.industry ?? '',
    address: company.address ?? '',
  };
}

export async function updateCompany(
  req: Parameters<typeof getAuth>[0],
  input: UpdateCompanyInput,
): Promise<CompanyDetails> {
  const auth = getAuth(req);

  const company = await prisma.company.upsert({
    where: { ownerId: auth.userId },
    create: {
      ownerId: auth.userId,
      businessName: input.businessName,
      country: input.country,
      industry: input.industry || null,
      address: input.address || null,
    },
    update: {
      businessName: input.businessName,
      country: input.country,
      industry: input.industry || null,
      address: input.address || null,
    },
  });

  return {
    businessName: company.businessName,
    country: company.country,
    industry: company.industry ?? '',
    address: company.address ?? '',
  };
}

// --- Notification preferences --------------------------------------------
// Stored as explicit columns (schema.prisma), so the mapping between the wire
// shape's nested categories and those columns lives here — in one direction each
// way, rather than scattered across callers.
export type NotificationPreferences = {
  emailMaster: boolean;
  categories: {
    statusUpdates: { email: boolean; inApp: boolean; sms: boolean };
    quoteAlerts: { email: boolean; inApp: boolean; sms: boolean };
    documentRequests: { email: boolean; inApp: boolean; sms: boolean };
    newMessages: { email: boolean; inApp: boolean; sms: boolean };
  };
};

type PreferenceRow = Prisma.NotificationPreferenceGetPayload<object>;

function toView(row: PreferenceRow): NotificationPreferences {
  return {
    emailMaster: row.emailMaster,
    categories: {
      statusUpdates: {
        email: row.statusUpdatesEmail,
        inApp: row.statusUpdatesInApp,
        sms: row.statusUpdatesSms,
      },
      quoteAlerts: {
        email: row.quoteAlertsEmail,
        inApp: row.quoteAlertsInApp,
        sms: row.quoteAlertsSms,
      },
      documentRequests: {
        email: row.documentRequestsEmail,
        inApp: row.documentRequestsInApp,
        sms: row.documentRequestsSms,
      },
      newMessages: {
        email: row.newMessagesEmail,
        inApp: row.newMessagesInApp,
        sms: row.newMessagesSms,
      },
    },
  };
}

function toColumns(input: UpdateNotificationPreferencesInput) {
  return {
    emailMaster: input.emailMaster,
    statusUpdatesEmail: input.categories.statusUpdates.email,
    statusUpdatesInApp: input.categories.statusUpdates.inApp,
    statusUpdatesSms: input.categories.statusUpdates.sms,
    quoteAlertsEmail: input.categories.quoteAlerts.email,
    quoteAlertsInApp: input.categories.quoteAlerts.inApp,
    quoteAlertsSms: input.categories.quoteAlerts.sms,
    documentRequestsEmail: input.categories.documentRequests.email,
    documentRequestsInApp: input.categories.documentRequests.inApp,
    documentRequestsSms: input.categories.documentRequests.sms,
    newMessagesEmail: input.categories.newMessages.email,
    newMessagesInApp: input.categories.newMessages.inApp,
    newMessagesSms: input.categories.newMessages.sms,
  };
}

export async function getNotificationPreferences(
  req: Parameters<typeof getAuth>[0],
): Promise<NotificationPreferences> {
  const auth = getAuth(req);

  // Created lazily: a customer who has never opened the screen has no row, so
  // the record is materialised on first read with the schema's defaults. That
  // way the delivery path can always read a real row.
  const row = await prisma.notificationPreference.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId },
    update: {},
  });

  return toView(row);
}

export async function updateNotificationPreferences(
  req: Parameters<typeof getAuth>[0],
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const auth = getAuth(req);
  const columns = toColumns(input);

  const row = await prisma.notificationPreference.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, ...columns },
    update: columns,
  });

  return toView(row);
}
