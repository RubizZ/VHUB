import { getPremierSeasons } from '../src/lib/henrik-api';

async function main() {
  const seasons = await getPremierSeasons('eu');
  if (!seasons) return console.log('No seasons');
  
  const activeSeason = seasons.sort((a, b) => {
    const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
    const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
    return endB - endA;
  })[0];

  console.log('Active Season:', activeSeason.id);
  
  // Filter for Saturday June 13
  const eventsAtDate = activeSeason.scheduled_events.filter(s => s.starts_at.startsWith('2026-06-13'));
  console.log('Events at 2026-06-13:', JSON.stringify(eventsAtDate, null, 2));
}

main();
