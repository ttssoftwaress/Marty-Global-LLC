/*
 * Local mirror of the backend's upload policy table — the real one lives in
 * `modules/uploads/uploads.service.ts` and is the source of truth (AGENTS.md).
 *
 * Everything here is convenience: it exists so a customer is told about a file
 * we cannot accept while it is still on their machine, instead of after the
 * round trip. The server re-checks all of it and is the actual boundary. When
 * the backend's table changes, this changes in the same task.
 */

export const DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const MB = 1024 * 1024;

export const MAX_BYTES = {
  orderDocument: 10 * MB,
  mailScan: 25 * MB,
  resultFile: 20 * MB,
  avatar: 5 * MB,
  supportAttachment: 10 * MB,
} as const;

/*
 * `File.type` is empty whenever the OS has no mapping for an extension — a
 * Windows machine with no PDF reader reports `''` for an ordinary `.pdf`. Every
 * check below goes through this rather than reading `file.type` directly, or
 * those files would be refused as "not a PDF" for a reason that has nothing to
 * do with the file.
 *
 * Only types the backend accepts are mapped. Anything genuinely unidentifiable
 * still resolves to octet-stream and is refused — which is correct.
 */
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeOf(file: File): string {
  if (file.type) return file.type;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_BY_EXTENSION[extension] ?? FALLBACK_CONTENT_TYPE;
}

export function isAcceptedType(file: File, accepted: readonly string[]): boolean {
  // An empty list is "no restriction" — the admin-configured file questions use
  // it to mean exactly that.
  return accepted.length === 0 || accepted.includes(contentTypeOf(file));
}

/*
 * The `accept` attribute for a file picker. Extensions alongside the MIME types
 * because the two are not interchangeable in practice: a browser that reports no
 * type for a `.pdf` also fails to match `application/pdf` in the picker filter,
 * and the file becomes unselectable rather than merely unlabelled.
 */
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export function acceptAttr(types: readonly string[]): string {
  return [
    ...types,
    ...types.flatMap((type) => EXTENSIONS_BY_TYPE[type] ?? []),
  ].join(',');
}

// "PDF, JPG, PNG or WebP" — the human half of a helper line. WebP is spelled the
// way the format is written rather than upper-cased like the acronyms.
const LABEL_BY_TYPE: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

export function describeTypes(types: readonly string[]): string {
  const labels = [
    ...new Set(
      types.map(
        (type) => LABEL_BY_TYPE[type] ?? (type.split('/')[1] ?? type).toUpperCase(),
      ),
    ),
  ];

  if (labels.length === 0) return 'Any file';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
}
