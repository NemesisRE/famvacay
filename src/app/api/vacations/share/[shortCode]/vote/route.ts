import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { setCached } from '@/lib/cache/redis';
import { RATE_LIMITS, rateLimitByClient } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const VALID_VOTES = new Set([-1, 1, 2]); // -1 = Veto, 1 = Upvote, 2 = Favorite

/**
 * POST /api/vacations/share/[shortCode]/vote
 * Allows family members invited via a share link to vote on a candidate without logging in.
 * Body: { candidateId: string, voterName: string, vote: -1 | 1 | 2, comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const limited = await rateLimitByClient(req, RATE_LIMITS.vote);
  if (limited) return limited;
  try {
    const { shortCode: rawShortCode } = await params;
    const shortCode = rawShortCode.startsWith('s_') ? rawShortCode : `s_${rawShortCode}`;

    const body = await req.json();
    const { candidateId, voterName, vote, comment } = body;

    if (typeof candidateId !== 'string' || !candidateId) {
      return NextResponse.json({ error: 'candidateId is required.' }, { status: 400 });
    }
    if (typeof voterName !== 'string' || voterName.trim().length === 0 || voterName.length > 60) {
      return NextResponse.json({ error: 'voterName must be a non-empty string (max 60 chars).' }, { status: 400 });
    }
    if (typeof vote !== 'number' || !VALID_VOTES.has(vote)) {
      return NextResponse.json({ error: 'vote must be one of -1 (veto), 1 (upvote), 2 (favorite).' }, { status: 400 });
    }
    if (comment !== undefined && (typeof comment !== 'string' || comment.length > 500)) {
      return NextResponse.json({ error: 'comment must be a string up to 500 characters.' }, { status: 400 });
    }

    const board = await prisma.sharedTripBoard.findUnique({ where: { shortCode } });
    if (!board || (board.expiresAt && board.expiresAt < new Date())) {
      return NextResponse.json({ error: 'Shared board not found or expired.' }, { status: 404 });
    }

    const candidate = await prisma.sharedCandidate.findFirst({
      where: { id: candidateId, boardId: board.id },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found on this board.' }, { status: 404 });
    }

    const voterNameTrimmed = voterName.trim();

    const savedVote = await prisma.candidateVote.upsert({
      where: { candidateId_voterName: { candidateId, voterName: voterNameTrimmed } },
      create: {
        candidateId,
        voterName: voterNameTrimmed,
        vote,
        comment: comment || null,
      },
      update: {
        vote,
        comment: comment || null,
      },
    });

    // Invalidate the read-through cache so the next GET reflects the new vote immediately.
    await setCached(`famvac:share:${shortCode}`, null, 1).catch(() => {});

    const allVotes = await prisma.candidateVote.findMany({ where: { candidateId } });

    return NextResponse.json({
      success: true,
      vote: { voterName: savedVote.voterName, vote: savedVote.vote, comment: savedVote.comment },
      tally: {
        upvotes: allVotes.filter((v) => v.vote === 1).length,
        favorites: allVotes.filter((v) => v.vote === 2).length,
        vetoes: allVotes.filter((v) => v.vote === -1).length,
      },
    });
  } catch (error: any) {
    console.error('[API /api/vacations/share/[shortCode]/vote POST Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit vote' },
      { status: 500 }
    );
  }
}
