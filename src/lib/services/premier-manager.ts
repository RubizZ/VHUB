import { db } from '@/lib/db';

/**
 * Premier Manager
 *
 * In Valorant Premier, each team plays a maximum of 2 matches per week.
 * This module detects when 2 matches have been played in a given Premier week
 * and marks remaining scheduled events for that week as "cancelled".
 */

export async function checkPremierWeek(premierWeek: string): Promise<{
  played: number;
  cancelled: number;
}> {
  // Count completed matches in this week
  const played = await db.event.count({
    where: {
      premier_week: premierWeek,
      status: 'completed',
      type: { in: ['match', 'premier'] }
    }
  });

  let cancelled = 0;

  if (played >= 2) {
    // Cancel remaining scheduled events in this week
    const result = await db.event.updateMany({
      where: {
        premier_week: premierWeek,
        status: 'scheduled',
        type: { in: ['match', 'premier'] }
      },
      data: { status: 'cancelled' }
    });
    cancelled = result.count;
  }

  return { played, cancelled };
}

/**
 * Check all Premier weeks that have events
 */
export async function checkAllPremierWeeks(): Promise<{
  weeks: { week: string; played: number; cancelled: number }[];
}> {
  const weeksRaw = await db.event.findMany({
    where: { premier_week: { not: null } },
    select: { premier_week: true },
    distinct: ['premier_week']
  });

  const results = [];
  for (const { premier_week } of weeksRaw) {
    if (premier_week === null) continue;
    const result = await checkPremierWeek(premier_week);
    results.push({ week: premier_week, ...result });
  }

  return { weeks: results };
}

/**
 * Get Premier week number from a date
 */
export function getPremierWeekFromDate(date: Date, seasonStartDate: Date): string {
  const diffMs = date.getTime() - seasonStartDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return (Math.floor(diffDays / 7) + 1).toString();
}
