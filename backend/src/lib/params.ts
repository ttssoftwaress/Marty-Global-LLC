import type { Request } from 'express';

import { AppError } from './app-error.js';

/*
 * Read a required path parameter.
 *
 * Express types `req.params[name]` as `string | string[] | undefined` (a
 * wildcard segment can repeat), and the backend runs with
 * `noUncheckedIndexedAccess`, so every handler would otherwise repeat the same
 * narrowing block. A missing or repeated value is a malformed request, which is
 * a 400 — not a crash, and not a silent empty string that would go on to query
 * for the id `""`.
 */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== 'string' || value.length === 0) {
    throw AppError.validation(`${name} is required`);
  }

  return value;
}
