/**
 * Server-side text sanitization utilities.
 * No DOM dependency — safe for use in Next.js server actions.
 */

/** Strips HTML tags and script content from user-supplied text. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&(lt|gt|amp|quot|apos);/g, (m, e) =>
      ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e as string] ?? m)
    )
    .trim();
}

/** Prevents path traversal attacks on Supabase storage paths. */
export function sanitizeStoragePath(path: string): string {
  if (path.includes('..') || path.includes('//') || path.startsWith('/')) {
    throw new Error('Invalid storage path');
  }
  return path;
}

/** Sanitizes user text before injecting into LLM prompts (31c). */
export function sanitizeForLLM(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .replace(/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/gi, '') // prompt delimiters
    .replace(/ignore\s+(previous|all|above)\s+instructions?/gi, '[filtered]')
    .replace(/system\s*:/gi, '[filtered]')
    .trim();
}
