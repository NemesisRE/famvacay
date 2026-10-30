import type { SupportedLocale, TranslationDictionary } from '@/lib/i18n/types';
import { en } from '@/lib/i18n/locales/en';
import { de } from '@/lib/i18n/locales/de';
import { fr } from '@/lib/i18n/locales/fr';
import { es } from '@/lib/i18n/locales/es';
import { it } from '@/lib/i18n/locales/it';
import type { MailMessage } from './mailer';

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = { en, de, fr, es, it };

export function mailLocale(locale: string | null | undefined): SupportedLocale {
  const code = (locale || '').slice(0, 2).toLowerCase();
  return code in DICTIONARIES ? (code as SupportedLocale) : 'en';
}

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Public base URL for links in mails (APP_URL, never a request's Host header) */
export function appBaseUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** "17. Mai 2027" / "May 17, 2027" for a YYYY-MM-DD date, independent of the server's time zone */
export function formatMailDate(isoDate: string, locale: SupportedLocale): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

interface Section {
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Smaller print below the button */
  notes?: string[];
}

function render(locale: SupportedLocale, to: string, subject: string, section: Section): MailMessage {
  const t = DICTIONARIES[locale];
  const host = new URL(appBaseUrl()).host;
  const footer = fill(t.mail.automatedNotice, { host });
  const text = [
    ...section.paragraphs,
    ...(section.button ? [`${section.button.label}: ${section.button.url}`] : []),
    ...(section.notes ?? []),
    '--',
    footer,
  ].join('\n\n');

  const p = (s: string, style = '') => `<p style="margin:0 0 16px;${style}">${escapeHtml(s)}</p>`;
  const button = section.button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(section.button.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0d9488;color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(section.button.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:12px;color:#64748b;word-break:break-all">${escapeHtml(section.button.url)}</p>`
    : '';
  const html =
    `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;font-size:15px;line-height:1.5">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">` +
    `<p style="margin:0 0 16px;font-weight:700;color:#0d9488">FamVacay</p>` +
    section.paragraphs.map((s) => p(s)).join('') +
    button +
    (section.notes ?? []).map((s) => p(s, 'font-size:13px;color:#475569')).join('') +
    `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(footer)}</p>` +
    `</div></body></html>`;

  return { to, subject, text, html };
}

/** Link to confirm an address: after registration (`verify`) or for a new address (`change`) */
export function emailConfirmationMail(params: {
  locale: string | null | undefined;
  to: string;
  url: string;
  kind: 'verify' | 'change';
}): MailMessage {
  const locale = mailLocale(params.locale);
  const t = DICTIONARIES[locale];
  const subject = params.kind === 'change' ? t.mail.changeSubject : t.mail.verifySubject;
  const intro = params.kind === 'change' ? t.mail.changeIntro : t.mail.verifyIntro;
  return render(locale, params.to, subject, {
    paragraphs: [fill(intro, { email: params.to })],
    button: { label: t.mail.confirmButton, url: params.url },
    notes: [t.mail.linkValidity],
  });
}

/** Reminder that a family member's passport expires soon (or already did) */
export function passportReminderMail(params: {
  locale: string | null | undefined;
  to: string;
  travellerName: string;
  expiryDate: string;
  expired: boolean;
}): MailMessage {
  const locale = mailLocale(params.locale);
  const t = DICTIONARIES[locale];
  const vars = { name: params.travellerName, date: formatMailDate(params.expiryDate, locale) };
  return render(locale, params.to, fill(t.mail.passportSubject, vars), {
    paragraphs: [fill(params.expired ? t.mail.passportExpiredIntro : t.mail.passportIntro, vars), t.mail.passportAdvice],
    button: { label: t.mail.openProfile, url: `${appBaseUrl()}/profile` },
    notes: [t.mail.passportSettings],
  });
}

/** "Anna", or "Child 2" for members without a name */
export function travellerLabel(
  member: { displayName?: string | null; firstName?: string | null; role?: string | null },
  index: number,
  locale: string | null | undefined
): string {
  const name = member.displayName?.trim() || member.firstName?.trim();
  if (name) return name;
  const t = DICTIONARIES[mailLocale(locale)];
  const isChild = member.role === 'CHILD' || member.role === 'INFANT';
  return fill(isChild ? t.mail.travellerChild : t.mail.travellerAdult, { n: String(index + 1) });
}
