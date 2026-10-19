import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/vacations/optimize/route';
import { NextRequest } from 'next/server';

describe('Vacations Optimize API - Input Validation & Edge Cases', () => {
  it('rejects empty request body with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/vacations/optimize', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Invalid input');
  });

  it('rejects requests missing earliestDate or latestDate with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/vacations/optimize', {
      method: 'POST',
      body: JSON.stringify({
        userProfile: {
          familyMembers: [],
          homeLocation: 'Karlsruhe',
          federalState: 'DE-BW',
          originAirports: ['FKB'],
        },
        durationDays: 7,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects requests missing durationDays and durationDaysMin with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/vacations/optimize', {
      method: 'POST',
      body: JSON.stringify({
        userProfile: {
          familyMembers: [],
          homeLocation: 'Karlsruhe',
          federalState: 'DE-BW',
          originAirports: ['FKB'],
        },
        earliestDate: '2026-07-01',
        latestDate: '2026-08-31',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

