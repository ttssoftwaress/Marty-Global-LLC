import { FileImage, FileSpreadsheet, FileText, FileType } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * The glyph beside a document's name, chosen from its content type.
 *
 * Icons come from the library, never hand-drawn (Design.md). The set is
 * deliberately small — a customer distinguishes "a PDF", "a picture", "a
 * spreadsheet"; finer-grained icons would be noise in a list.
 *
 * A row with no content type recorded falls back to the generic document glyph
 * rather than guessing from the filename extension, which lies as often as not.
 */

export function fileIconFor(contentType: string | null): LucideIcon {
  if (!contentType) return FileText;

  if (contentType.startsWith('image/')) return FileImage;
  if (contentType === 'application/pdf') return FileType;
  if (
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType === 'text/csv'
  ) {
    return FileSpreadsheet;
  }

  return FileText;
}
