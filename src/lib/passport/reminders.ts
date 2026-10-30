import { prisma } from '@/lib/db/prisma';
import { isMailConfigured, sendMail } from '@/lib/mail/mailer';
import { passportReminderMail, travellerLabel } from '@/lib/mail/templates';
import { PASSPORT_VALIDITY_MONTHS, addMonths, reminderStage } from './validity';

/**
 * Mails the adults of a family when a member's passport expires within 6 months, and again within
 * a month - only for profiles with the passport check switched on, only to confirmed addresses.
 * Every reminder is claimed in the database first ("<expiry>:<stage>" in passportRemindersSent,
 * one atomic UPDATE), so several replicas never send it twice; a new expiry date starts over.
 */
const FIRST_RUN_MS = 5 * 60 * 1000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

interface ReminderMember {
  id: string;
  displayName: string | null;
  firstName: string | null;
  role: string;
  passportExpiry: Date | null;
  passportRemindersSent: string[];
}

interface ReminderProfile {
  locale: string;
  user: { email: string | null; emailVerified: Date | null } | null;
  memberships: { user: { email: string | null; emailVerified: Date | null } }[];
  members: ReminderMember[];
}

export interface ReminderDb {
  familyProfile: {
    findMany(args: unknown): Promise<ReminderProfile[]>;
  };
  familyMember: {
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function sendDuePassportReminders(
  db: ReminderDb = prisma as unknown as ReminderDb,
  now = new Date(),
  send: typeof sendMail = sendMail
): Promise<number> {
  const today = isoDate(now);
  const horizon = new Date(`${addMonths(today, PASSPORT_VALIDITY_MONTHS)}T00:00:00Z`);
  const staleBefore = new Date(now.getTime() - 30 * 86_400_000);
  const confirmed = { email: true, emailVerified: true } as const;

  const profiles = await db.familyProfile.findMany({
    where: {
      passportCheckRequired: true,
      members: { some: { passportExpiry: { gte: staleBefore, lte: horizon } } },
    },
    select: {
      locale: true,
      user: { select: confirmed },
      memberships: { select: { user: { select: confirmed } } },
      members: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, displayName: true, firstName: true, role: true, passportExpiry: true, passportRemindersSent: true },
      },
    },
  });

  let sent = 0;
  for (const profile of profiles) {
    const recipients = [...new Set(
      [profile.user, ...profile.memberships.map((m) => m.user)]
        .filter((u): u is { email: string; emailVerified: Date } => Boolean(u?.email && u.emailVerified))
        .map((u) => u.email)
    )];
    // Nobody to tell yet: not claimed, so the reminder goes out once an address is confirmed
    if (recipients.length === 0) continue;

    // Labels number adults and children separately ("Child 2"), like the profile form
    const counters = { adult: 0, child: 0 };
    for (const member of profile.members) {
      const isChild = member.role === 'CHILD' || member.role === 'INFANT';
      const index = isChild ? counters.child++ : counters.adult++;
      if (!member.passportExpiry) continue;
      const expiry = isoDate(member.passportExpiry);
      const stage = reminderStage(expiry, today);
      if (!stage) continue;

      const key = `${expiry}:${stage}`;
      const keep = member.passportRemindersSent.filter((k) => k.startsWith(`${expiry}:`));
      const claimed = await db.familyMember.updateMany({
        where: { id: member.id, NOT: { passportRemindersSent: { has: key } } },
        data: { passportRemindersSent: { set: [...keep, key] } },
      });
      if (claimed.count === 0) continue; // already sent (here or by another replica)

      const travellerName = travellerLabel(member, index, profile.locale);
      let delivered = false;
      for (const to of recipients) {
        const ok = await send(
          passportReminderMail({ locale: profile.locale, to, travellerName, expiryDate: expiry, expired: expiry < today })
        );
        delivered ||= ok;
      }
      if (delivered) {
        sent++;
      } else {
        // Nothing went out (mail server down): release the claim so the next run tries again
        await db.familyMember.updateMany({
          where: { id: member.id },
          data: { passportRemindersSent: { set: keep } },
        });
      }
    }
  }
  return sent;
}

export function startPassportReminders(): void {
  const g = globalThis as unknown as { __famvacayPassportReminders?: boolean };
  if (g.__famvacayPassportReminders || !isMailConfigured()) return;
  g.__famvacayPassportReminders = true;

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const count = await sendDuePassportReminders();
      if (count > 0) console.log(`[passport] sent ${count} passport reminder(s)`);
    } catch (err) {
      console.warn('[passport] reminder run failed:', (err as Error)?.message || err);
    } finally {
      running = false;
    }
  };
  setTimeout(run, FIRST_RUN_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
  console.log('[passport] expiry reminders enabled');
}
