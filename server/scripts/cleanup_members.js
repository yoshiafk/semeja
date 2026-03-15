const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupMembers() {
  const client = await pool.connect();
  try {
    console.log('Cleaning up corrupted member records...');
    
    // 1. Identify members with invalid characters (non-alphanumeric, etc.)
    // We target the specific patterns found: control chars, weird symbols
    const { rows: invalidMembers } = await client.query(`
      SELECT id, name FROM members 
      WHERE name ~ '[^a-zA-Z0-9\\s.\\-]'
    `);

    if (invalidMembers.length === 0) {
      console.log('No corrupted members found.');
      return;
    }

    console.log(`Found ${invalidMembers.length} corrupted members.`);

    for (const member of invalidMembers) {
      console.log(`Processing corrupted member: ID ${member.id} ("${member.name}")`);

      // Try to find a legitimate name it might have come from (e.g. "Achi" -> "açî")
      // OR if it's just garbage, we might want to delete if no participations.
      
      const { rows: partCount } = await client.query('SELECT COUNT(*) FROM participations WHERE member_id = $1', [member.id]);
      const hasParticipations = parseInt(partCount[0].count) > 0;

      if (!hasParticipations) {
        console.log(`  No participations found. Deleting ID ${member.id}.`);
        await client.query('DELETE FROM members WHERE id = $1', [member.id]);
        continue;
      }

      console.log(`  ID ${member.id} has participations. Manual intervention recommended or merging required.`);
      // For ID 28 specifically, if it were "Achi", we'd merge it into the real "Achi" if exists.
      // But looking at our list, there is no "Achi" yet.
    }

    // Specific cleanup for the known IDs if they still exist
    const knownCorruptedIds = [28, 29];
    for (const id of knownCorruptedIds) {
        const { rowCount } = await client.query('DELETE FROM members WHERE id = $1', [id]);
        if (rowCount > 0) console.log(`Deleted known corrupted ID ${id}`);
    }

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupMembers();
