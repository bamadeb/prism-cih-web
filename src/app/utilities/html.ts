/**
 * Escapes text for insertion into an HTML string. Required for any value put
 * into HTML that is later passed to bypassSecurityTrustHtml().
 */
export function escapeHtml(value: unknown): string {
  return (value === null || value === undefined ? '' : String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
