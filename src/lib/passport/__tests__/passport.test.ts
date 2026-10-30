import { describe, it, expect, vi } from 'vitest';
import { addMonths, needsPassportValidity, passportWarningsForTrip, reminderStage } from '../validity';
import { sendDuePassportReminders, type ReminderDb } from '../reminders';
import type { MailMessage } from '@/lib/mail/mailer';

describe('passport validity rules', () => {
  it('adds months and clamps to the end of shorter months', () => {
    expect(addMonths('2027-03-15', 6)).toBe('2027-09-15');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
    expect(addMonths('2027-10-31', 4)).toBe('2028-02-29');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('needs no passport validity within the EU/EEA/Switzerland or at home', () => {
    expect(needsPassportValidity('DE', 'ES')).toBe(false);
    expect(needsPassportValidity('AT', 'CH')).toBe(false);
    expect(needsPassportValidity('DE', 'DE')).toBe(false);
    expect(needsPassportValidity('DE', 'EG')).toBe(true);
    expect(needsPassportValidity('GB', 'ES')).toBe(true);
    expect(needsPassportValidity('DE', undefined)).toBe(false);
  });

  it('warns for passports valid less than 6 months after the trip', () => {
    const holders = [
      { label: 'Anna', expiry: '2027-12-31' },
      { label: 'Child 1', expiry: '2028-03-01' },
    ];
    // Trip ends 2027-08-15: required until 2028-02-15
    expect(passportWarningsForTrip(holders, '2027-08-15', 'DE', 'EG').map((h) => h.label)).toEqual(['Anna']);
    expect(passportWarningsForTrip(holders, '2027-08-15', 'DE', 'ES')).toEqual([]);
    expect(passportWarningsForTrip([], '2027-08-15', 'DE', 'EG')).toEqual([]);
  });

  it('picks the reminder stage by the time left', () => {
    expect(reminderStage('2028-06-01', '2027-06-01')).toBeNull();
    expect(reminderStage('2027-11-30', '2027-06-01')).toBe('6m');
    expect(reminderStage('2027-07-01', '2027-06-01')).toBe('1m');
    expect(reminderStage('2027-05-20', '2027-06-01')).toBe('1m'); // expired recently
    expect(reminderStage('2027-04-01', '2027-06-01')).toBeNull(); // stale date
  });
});

interface Member {
  id: string;
  displayName: string | null;
  firstName: string | null;
  role: string;
  passportExpiry: Date | null;
  passportRemindersSent: string[];
}

function fakeDb(members: Member[], users: { email: string | null; emailVerified: Date | null }[], locale = 'de') {
  const db: ReminderDb & { members: Member[] } = {
    members,
    familyProfile: {
      findMany: vi.fn(async () => [{ locale, user: users[0] ?? null, memberships: users.slice(1).map((user) => ({ user })), members }]),
    },
    familyMember: {
      // Mimics UPDATE ... WHERE NOT key = ANY(passportRemindersSent): only one caller wins
      updateMany: vi.fn(async ({ where, data }: any) => {
        const m = members.find((x) => x.id === where.id);
        if (!m) return { count: 0 };
        if (where.NOT && m.passportRemindersSent.includes(where.NOT.passportRemindersSent.has)) return { count: 0 };
        m.passportRemindersSent = data.passportRemindersSent.set;
        return { count: 1 };
      }),
    },
  };
  return db;
}

const verified = (email: string) => ({ email, emailVerified: new Date('2027-01-01') });
const NOW = new Date('2027-06-01T08:00:00Z');

describe('passport reminder mails', () => {
  it('mails every confirmed adult once per stage, naming unnamed members by position', async () => {
    const members: Member[] = [
      { id: 'a', displayName: 'Anna', firstName: null, role: 'PARENT', passportExpiry: null, passportRemindersSent: [] },
      { id: 'c1', displayName: null, firstName: null, role: 'CHILD', passportExpiry: new Date('2028-06-01'), passportRemindersSent: [] },
      { id: 'c2', displayName: null, firstName: null, role: 'CHILD', passportExpiry: new Date('2027-10-15'), passportRemindersSent: [] },
    ];
    const db = fakeDb(members, [verified('anna@example.org'), { email: 'ben@example.org', emailVerified: null }, verified('anna@example.org')]);
    const mails: MailMessage[] = [];
    const send = vi.fn(async (m: MailMessage) => {
      mails.push(m);
      return true;
    });

    expect(await sendDuePassportReminders(db, NOW, send)).toBe(1);
    // Only the confirmed address, once (duplicates removed); Child 2 is the only one due
    expect(mails.map((m) => m.to)).toEqual(['anna@example.org']);
    expect(mails[0].subject).toBe('Reisepass von Kind 2: gültig bis 15. Oktober 2027');
    expect(members[2].passportRemindersSent).toEqual(['2027-10-15:6m']);

    // Next run: nothing new
    expect(await sendDuePassportReminders(db, NOW, send)).toBe(0);
    // A month before expiry: the second reminder
    expect(await sendDuePassportReminders(db, new Date('2027-09-20T08:00:00Z'), send)).toBe(1);
    expect(members[2].passportRemindersSent).toEqual(['2027-10-15:6m', '2027-10-15:1m']);
  });

  it('keeps reminders for later when nobody has a confirmed address', async () => {
    const members: Member[] = [
      { id: 'a', displayName: 'Anna', firstName: null, role: 'PARENT', passportExpiry: new Date('2027-07-01'), passportRemindersSent: [] },
    ];
    const db = fakeDb(members, [{ email: 'anna@example.org', emailVerified: null }]);
    const send = vi.fn(async () => true);
    expect(await sendDuePassportReminders(db, NOW, send)).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(members[0].passportRemindersSent).toEqual([]);
  });

  it('releases the claim when no mail went out, and starts over for a new expiry date', async () => {
    const members: Member[] = [
      { id: 'a', displayName: 'Anna', firstName: null, role: 'PARENT', passportExpiry: new Date('2027-07-01'), passportRemindersSent: ['2025-01-01:6m'] },
    ];
    const db = fakeDb(members, [verified('anna@example.org')]);
    expect(await sendDuePassportReminders(db, NOW, async () => false)).toBe(0);
    // Old keys of an earlier passport are dropped, the failed one is not kept
    expect(members[0].passportRemindersSent).toEqual([]);
    expect(await sendDuePassportReminders(db, NOW, async () => true)).toBe(1);
    expect(members[0].passportRemindersSent).toEqual(['2027-07-01:1m']);
  });
});
