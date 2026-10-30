import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMailConfig, isMailConfigured, sendMail, setMailSenderForTests } from '../mailer';
import { emailConfirmationMail, formatMailDate, passportReminderMail, travellerLabel } from '../templates';

describe('mail configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setMailSenderForTests(null);
  });

  it('is off without SMTP_HOST or MAIL_FROM', () => {
    expect(getMailConfig({})).toBeNull();
    expect(getMailConfig({ SMTP_HOST: 'smtp.example.org' })).toBeNull();
    expect(getMailConfig({ MAIL_FROM: 'a@example.org' })).toBeNull();
  });

  it('defaults to STARTTLS on 587 and implicit TLS on 465', () => {
    const base = { SMTP_HOST: 'smtp.example.org', MAIL_FROM: 'FamVacay <noreply@example.org>' };
    expect(getMailConfig(base)).toMatchObject({ port: 587, secure: false, allowInsecure: false });
    expect(getMailConfig({ ...base, SMTP_PORT: '465' })).toMatchObject({ port: 465, secure: true });
    expect(getMailConfig({ ...base, SMTP_PORT: '2525', SMTP_SECURE: 'true' })).toMatchObject({ secure: true });
    expect(getMailConfig({ ...base, SMTP_USER: ' user ', SMTP_PASSWORD: 'p w' })).toMatchObject({ user: 'user', password: 'p w' });
  });

  it('sends with the configured sender and never throws', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.org');
    vi.stubEnv('MAIL_FROM', 'FamVacay <noreply@example.org>');
    const sent: unknown[] = [];
    setMailSenderForTests(async (m) => {
      sent.push(m);
    });
    expect(isMailConfigured()).toBe(true);
    expect(await sendMail({ to: 'a@example.org', subject: 's', text: 't', html: '<p>t</p>' })).toBe(true);
    expect(sent[0]).toMatchObject({ from: 'FamVacay <noreply@example.org>', to: 'a@example.org' });

    setMailSenderForTests(async () => {
      throw new Error('connection refused');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sendMail({ to: 'a@example.org', subject: 's', text: 't', html: 't' })).toBe(false);
  });

  it('sends nothing when mail is not configured', async () => {
    const sender = vi.fn();
    setMailSenderForTests(sender);
    expect(await sendMail({ to: 'a@example.org', subject: 's', text: 't', html: 't' })).toBe(false);
    expect(sender).not.toHaveBeenCalled();
  });
});

describe('mail templates', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('writes the confirmation mail in the requested language with the link in text and HTML', () => {
    vi.stubEnv('APP_URL', 'https://famvacay.example.org/');
    const url = 'https://famvacay.example.org/api/auth/verify-email?token=abc';
    const mail = emailConfirmationMail({ locale: 'de-AT', to: 'anna@example.org', url, kind: 'verify' });
    expect(mail.subject).toBe('Bestätige deine E-Mail-Adresse');
    expect(mail.text).toContain('anna@example.org');
    expect(mail.text).toContain(url);
    expect(mail.text).toContain('famvacay.example.org');
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.html).toContain('<html lang="de">');

    const change = emailConfirmationMail({ locale: 'xx', to: 'new@example.org', url, kind: 'change' });
    expect(change.subject).toBe('Confirm your new email address');
  });

  it('escapes names in the HTML part', () => {
    const mail = passportReminderMail({
      locale: 'en',
      to: 'a@example.org',
      travellerName: '<b>Max</b> & "Co"',
      expiryDate: '2027-05-17',
      expired: false,
    });
    expect(mail.html).toContain('&lt;b&gt;Max&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(mail.html).not.toContain('<b>Max</b>');
    expect(mail.subject).toBe('Passport of <b>Max</b> & "Co": valid until May 17, 2027');
  });

  it('says when a passport already expired', () => {
    const mail = passportReminderMail({ locale: 'fr', to: 'a@example.org', travellerName: 'Léa', expiryDate: '2027-01-02', expired: true });
    expect(mail.text).toContain('Le passeport de Léa a expiré le 2 janvier 2027.');
  });

  it('formats dates without shifting them by the time zone', () => {
    expect(formatMailDate('2027-12-31', 'de')).toBe('31. Dezember 2027');
  });

  it('labels unnamed travellers by role and position', () => {
    expect(travellerLabel({ displayName: ' Mia ' }, 0, 'de')).toBe('Mia');
    expect(travellerLabel({ role: 'CHILD' }, 1, 'de')).toBe('Kind 2');
    expect(travellerLabel({ role: 'PARENT' }, 0, 'en')).toBe('Adult 1');
  });
});
