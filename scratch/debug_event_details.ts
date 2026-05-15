import { getPremierSeasons } from '../src/lib/henrik-api';

async function main() {
  const seasons = await getPremierSeasons('eu');
  if (!seasons) return console.log('No seasons');
  
  const activeSeason = seasons.sort((a, b) => {
    const endB = b.ends_at ? new Date(b.ends_at).getTime() : 0;
    const endA = a.ends_at ? new Date(a.ends_at).getTime() : 0;
    return endB - endA;
  })[0];

  const targetIds = ['9f02b9e1-4517-463a-283a-a79c526d00f3', 'ef1e71ae-4917-df9e-0330-b484a1356b08'];
  const eventsInfo = activeSeason.events.filter(e => targetIds.includes(e.id));
  console.log('Events Info:', JSON.stringify(eventsInfo, null, 2));
}

main();
