import { getPremierSeasons } from '../src/lib/henrik-api';

async function main() {
  const seasons = await getPremierSeasons('eu');
  if (!seasons) return console.log('No seasons');
  
  const activeSeason = seasons.sort((a, b) => {
    const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
    const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
    return endB - endA;
  })[0];

  console.log('--- ACTIVE SEASON METADATA ---');
  console.log(JSON.stringify({
    id: activeSeason.id,
    starts_at: activeSeason.starts_at,
    ends_at: activeSeason.ends_at
  }, null, 2));

  // Focus on June 2026 events for EU_IBIT
  const targetConference = 'EU_IBIT';
  const juneEvents = activeSeason.scheduled_events.filter(s => 
    s.starts_at.startsWith('2026-06') && s.conference === targetConference
  );

  console.log(`\n--- RAW SCHEDULED EVENTS FOR ${targetConference} (JUNE 2026) ---`);
  
  const detailedEvents = juneEvents.map(s => {
    const meta = activeSeason.events.find(e => e.id === s.event_id);
    return {
      scheduled: s,
      metadata: {
        id: meta?.id,
        type: meta?.type,
        map_selection: meta?.map_selection
      }
    };
  });

  console.log(JSON.stringify(detailedEvents, null, 2));
}

main();
