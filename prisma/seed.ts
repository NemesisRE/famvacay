import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  console.log('[Seed] Starting database seed...');

  const devEmail = 'dev@famvacay.local';
  const existingUser = await prisma.user.findUnique({
    where: { email: devEmail },
    include: { familyProfile: true },
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = await prisma.user.create({
      data: {
        email: devEmail,
        name: 'FamVacay Dev',
        passwordHash,
        familyProfile: {
          create: {
            familyName: 'Miller Family',
            homeLocation: 'Stuttgart, Baden-Württemberg, Germany',
            homeLat: 48.7758,
            homeLon: 9.1829,
            federalState: 'DE-BW',
            holidayCountry: 'DE',
            holidaySubdivision: 'BW',
            originAirports: ['STR', 'FRA'],
            maxDrivingHours: 2.5,
            preferredCabinClass: 'ECONOMY',
            climatePreference: 'WARM',
            travelModes: ['FLIGHT', 'CAR'],
            locale: 'de',
            currency: 'EUR',
            membersCount: 4,
            members: {
              create: [
                {
                  displayName: 'Alexander Miller',
                  role: 'PARENT',
                  birthDate: new Date('1988-04-12'),
                },
                {
                  displayName: 'Sarah Miller',
                  role: 'PARENT',
                  birthDate: new Date('1990-09-24'),
                },
                {
                  displayName: 'Liam Miller',
                  role: 'CHILD',
                  birthDate: new Date('2018-06-15'),
                  schoolRequired: true,
                },
                {
                  displayName: 'Mia Miller',
                  role: 'CHILD',
                  birthDate: new Date('2021-02-08'),
                  schoolRequired: false,
                },
              ],
            },
          },
        },
      },
    });
    console.log(`[Seed] Created developer seed account: ${user.email} (password: password123) with FamilyProfile.`);
  } else {
    console.log(`[Seed] Developer account ${devEmail} already exists. Skipping creation.`);
  }

  console.log('[Seed] Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

