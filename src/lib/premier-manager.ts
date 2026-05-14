import { query, execute, dbReady } from '@/lib/db';

/**
 * Premier Manager
 *
 * In Valorant Premier, each team plays a maximum of 2 matches per week.
 * This module detects when 2 matches have been played in a given Premier week
 * and marks remaining scheduled events for that week as "cancelled".
 */

export async function checkPremierWeek(premierWeek: number): Promise<{
  played: number;
  cancelled: number;
}> {
  await dbReady;

  // Count completed matches in this week
  const completedEvents = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM events WHERE premier_week = $1 AND status = 'completed' AND type IN ('match', 'premier')",
    [premierWeek]
  );
  const played = parseInt(completedEvents[0]?.count || '0');

  let cancelled = 0;

  if (played >= 2) {
    // Cancel remaining scheduled events in this week
    const result = await execute(
      "UPDATE events SET status = 'cancelled' WHERE premier_week = $1 AND status = 'scheduled' AND type IN ('match', 'premier')",
      [premierWeek]
    );
    cancelled = result.rowCount;
  }

  return { played, cancelled };
}

/**
 * Check all Premier weeks that have events
 */
export async function checkAllPremierWeeks(): Promise<{
  weeks: { week: number; played: number; cancelled: number }[];
}> {
  await dbReady;

  const weeks = await query<{ premier_week: number }>(
    "SELECT DISTINCT premier_week FROM events WHERE premier_week IS NOT NULL ORDER BY premier_week"
  );

  const results = [];
  for (const { premier_week } of weeks) {
    const result = await checkPremierWeek(premier_week);
    results.push({ week: premier_week, ...result });
  }

  return { weeks: results };
}

/**
 * Get Premier week number from a date
 * Each Premier season has a start date, and weeks are counted from there
 */
export function getPremierWeekFromDate(date: Date, seasonStartDate: Date): number {
  const diffMs = date.getTime() - seasonStartDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}
