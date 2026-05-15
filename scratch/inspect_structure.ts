import { getPremierSeasons } from '../src/lib/henrik-api';

async function main() {
  const seasons = await getPremierSeasons('eu');
  if (!seasons) return console.log('No seasons');
  
  const activeSeason = seasons.sort((a, b) => {
    const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
    const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
    return endB - endA;
  })[0];

  // Look for any field that might indicate rank/division
  console.log('--- EVENT SAMPLE ---');
  console.log(JSON.stringify(activeSeason.events[0], null, 2));

  console.log('\n--- SCHEDULED EVENT SAMPLE ---');
  console.log(JSON.stringify(activeSeason.scheduled_events[0], null, 2));

  // Check if there are other fields in the season object itself
  console.log('\n--- SEASON FIELDS ---');
  console.log(Object.keys(activeSeason));
}

main();
