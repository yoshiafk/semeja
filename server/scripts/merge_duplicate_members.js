const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupDuplicates() {
  const client = await pool.connect();
  try {
    console.log('Searching for duplicate member names (case-insensitive)...');
    
    // 1. Find groups of members with the same lowercase name
    const { rows: duplicateGroups } = await client.query(`
      SELECT LOWER(name) as lower_name, COUNT(*) 
      FROM members 
      GROUP BY LOWER(name) 
      HAVING COUNT(*) > 1
    `);

    if (duplicateGroups.length === 0) {
      console.log('No duplicate members found. Your data is clean!');
      return;
    }

    console.log(`Found ${duplicateGroups.length} groups of duplicates.`);

    for (const group of duplicateGroups) {
      const { lower_name } = group;
      console.log(`\nProcessing duplicate group: "${lower_name}"`);

      // Get all IDs for this name, ordered by ID (we'll keep the lowest ID)
      const { rows: members } = await client.query(`
        SELECT id, name, role, device_id 
        FROM members 
        WHERE LOWER(name) = $1 
        ORDER BY id ASC
      `, [lower_name]);

      const keepMember = members[0];
      const redundantMembers = members.slice(1);
      const redundantIds = redundantMembers.map(m => m.id);

      console.log(`Keeping ID ${keepMember.id} ("${keepMember.name}")`);
      console.log(`Merging redundant IDs: ${redundantIds.join(', ')}`);

      // Update all tables that reference member_id
      const tablesToUpdate = [
        { table: 'participations', column: 'member_id' },
        { table: 'activities', column: 'created_by' },
        { table: 'activity_participations', column: 'member_id' },
        { table: 'gifts', column: 'created_by' },
        { table: 'gift_participants', column: 'member_id' }
      ];

      for (const { table, column } of tablesToUpdate) {
        // We use UPDATE IGNORE style (handle the unique constraint on participations/activity_participations/gift_participants)
        if (table === 'participations' || table === 'activity_participations' || table === 'gift_participants') {
            const idColumn = table === 'participations' ? 'meal_id' : table === 'activity_participations' ? 'activity_id' : 'gift_id';
            
            // For unique constraint tables, we need to be careful:
            // If the "keep" user already has a record for that specific event, we should just delete the redundant user's record.
            // If the "keep" user doesn't have a record, we can update the redundant user's record to the "keep" user.
            
            await client.query(`
                DELETE FROM ${table} t1
                WHERE ${column} = ANY($1)
                AND EXISTS (
                    SELECT 1 FROM ${table} t2
                    WHERE t2.${idColumn} = t1.${idColumn}
                    AND t2.${column} = $2
                )
            `, [redundantIds, keepMember.id]);
        }

        const { rowCount } = await client.query(`
          UPDATE ${table} 
          SET ${column} = $1 
          WHERE ${column} = ANY($2)
        `, [keepMember.id, redundantIds]);
        
        console.log(`  Updated ${rowCount} records in ${table}`);
      }

      // Finally delete redundant members
      const { rowCount: deletedCount } = await client.query(`
        DELETE FROM members 
        WHERE id = ANY($1)
      `, [redundantIds]);
      
      console.log(`  Deleted ${deletedCount} redundant member records.`);
    }

    console.log('\nCleanup complete! You can now redeploy to create the unique index.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicates();
