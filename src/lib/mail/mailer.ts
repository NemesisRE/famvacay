import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outgoing mail over SMTP (verification links, passport reminders). Optional: without SMTP_HOST
 * and MAIL_FROM nothing is sent, accounts work without verification and no reminders go out.
 *
 *   SMTP_HOST      mail server, e.g. smtp.example.org
 *   SMTP_PORT      587 (STARTTLS, default) or 465 (implicit TLS)
 *   SMTP_SECURE    true for implicit TLS; defaults to true on port 465
 *   SMTP_USER / SMTP_PASSWORD   login, if the server needs one
 *   MAIL_FROM      sender, e.g. "FamVacay <noreply@example.org>"
 *   SMTP_ALLOW_INSECURE  true only for a relay without TLS on your own network (e.g. Mailpit)
 */
export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  allowInsecure: boolean;
}

export function getMailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.MAIL_FROM?.trim();
  if (!host || !from) return null;
  const port = Number(env.SMTP_PORT) || 587;
  const secureFlag = env.SMTP_SECURE?.trim().toLowerCase();
  return {
    host,
    port,
    secure: secureFlag ? secureFlag === 'true' : port === 465,
    user: env.SMTP_USER?.trim() || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from,
    allowInsecure: env.SMTP_ALLOW_INSECURE?.trim().toLowerCase() === 'true',
  };
}

export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

type SendFn = (message: MailMessage & { from: string }) => Promise<unknown>;

let testSender: SendFn | null = null;
/** Tests replace the SMTP transport; null restores it */
export function setMailSenderForTests(sender: SendFn | null): void {
  testSender = sender;
}

function getTransport(config: MailConfig): Transporter {
  const g = globalThis as unknown as { __famvacayMail?: { key: string; transport: Transporter } };
  const key = `${config.host}:${config.port}:${config.secure}:${config.allowInsecure}:${config.user ?? ''}`;
  if (g.__famvacayMail?.key !== key) {
    g.__famvacayMail = {
      key,
      transport: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        // Never send credentials or mail in clear text: STARTTLS is required when not on TLS
        // already, unless explicitly allowed for a relay on the own network
        requireTLS: !config.secure && !config.allowInsecure,
        auth: config.user ? { user: config.user, pass: config.password ?? '' } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return g.__famvacayMail.transport;
}

/**
 * Sends one mail; false when mail is not configured or the server refused it (logged, never
 * thrown - a failed mail must not fail the request that triggered it).
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const config = getMailConfig();
  if (!config) return false;
  try {
    const send: SendFn = testSender ?? ((m) => getTransport(config).sendMail(m));
    await send({ ...message, from: config.from });
    return true;
  } catch (err) {
    // The recipient stays out of the log (personal data); the error says what went wrong
    console.warn('[mail] sending failed:', (err as Error)?.message || err);
    return false;
  }
}
