/**
 * Hands a link to the user: the native share sheet on touch devices, otherwise the clipboard.
 * `navigator.share` and `navigator.clipboard` only exist on secure origins (https / localhost) -
 * opened over plain http (e.g. the dev server from a phone on the LAN) both are undefined, so the
 * legacy copy command is the fallback there. 'failed' means the caller should show the link for
 * manual copying.
 */
export type ShareLinkOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareOrCopyLink(url: string, title?: string): Promise<ShareLinkOutcome> {
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  if (isTouchDevice && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      // The user closed the share sheet: nothing to do
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Otherwise (not allowed, unsupported data) fall through to copying
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      // Permission denied or document not focused: try the legacy path
    }
  }

  return legacyCopy(url) ? 'copied' : 'failed';
}

/** document.execCommand('copy') via an off-screen textarea - works without a secure context. */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Off-screen but focusable; font-size 16px keeps iOS from zooming in
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.fontSize = '16px';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
