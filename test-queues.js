const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://vhub:vhub_dev@localhost:5432/vhub"
  });
  await client.connect();
  const res = await client.query('SELECT id, riot_match_id, event_id FROM "Match"');
  console.log("Matches:", res.rows);
  await client.end();
}

run();
