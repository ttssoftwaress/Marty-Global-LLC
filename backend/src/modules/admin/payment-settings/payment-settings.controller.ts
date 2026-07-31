import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import * as service from './payment-settings.service.js';
import {
  bankAccountIdParamSchema,
  createBankAccountSchema,
  reorderBankAccountsSchema,
  updateBankAccountSchema,
  updatePaymentSettingsSchema,
} from './payment-settings.validation.js';

// Thin: validate → call service → respond with the { data } envelope
// (AGENTS.md, API Conventions). No business logic and no Prisma here.

export async function getSettings(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.readSettings() });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updatePaymentSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid payment settings', parsed.error.issues);
    }

    const settings = await service.updateSettings(getAuth(req), parsed.data);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
}

export async function listBankAccounts(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.listBankAccounts() });
  } catch (error) {
    next(error);
  }
}

export async function createBankAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createBankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid bank account', parsed.error.issues);
    }

    const account = await service.createBankAccount(getAuth(req), parsed.data);
    res.status(201).json({ data: account });
  } catch (error) {
    next(error);
  }
}

export async function updateBankAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = bankAccountIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw AppError.validation('Invalid bank account id', params.error.issues);
    }

    const parsed = updateBankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid bank account', parsed.error.issues);
    }

    const account = await service.updateBankAccount(
      getAuth(req),
      params.data.accountId,
      parsed.data,
    );

    res.json({ data: account });
  } catch (error) {
    next(error);
  }
}

export async function deleteBankAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = bankAccountIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw AppError.validation('Invalid bank account id', params.error.issues);
    }

    const result = await service.deleteBankAccount(
      getAuth(req),
      params.data.accountId,
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function reorderBankAccounts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = reorderBankAccountsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid order', parsed.error.issues);
    }

    const accounts = await service.reorderBankAccounts(getAuth(req), parsed.data);
    res.json({ data: accounts });
  } catch (error) {
    next(error);
  }
}
