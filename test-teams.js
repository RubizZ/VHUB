const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://vhub:vhub_dev@localhost:5432/vhub"
  });
  await client.connect();
  const res = await client.query('SELECT id, name, logo_url FROM "Team"');
  console.log("Teams:", res.rows);
  await client.end();
}

run();
