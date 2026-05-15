import { getPremierSeasons } from '../src/lib/henrik-api';

async function main() {
  const seasons = await getPremierSeasons('eu');
  if (!seasons) return console.log('No seasons');
  
  const activeSeason = seasons.sort((a, b) => {
    const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
    const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
    return endB - endA;
  })[0];

  const eventsAtDate = activeSeason.scheduled_events.filter(s => s.starts_at.startsWith('2026-06-21') && s.conference === 'EU_IBIT');
  console.log('Scheduled Events at 2026-06-21 (EU_IBIT):', JSON.stringify(eventsAtDate, null, 2));

  for (const s of eventsAtDate) {
    const evMeta = activeSeason.events.find(e => e.id === s.event_id);
    console.log(`Event ${s.event_id} Info:`, JSON.stringify(evMeta, null, 2));
  }
}

main();
