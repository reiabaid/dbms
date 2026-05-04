const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runSetup() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'setup_db.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('--- Starting Database Setup ---');
  
  try {
    // We execute the whole script. 
    // Since multipleStatements is enabled, this will run all commands in order.
    await db.query(sql);
    console.log('\n✅ Database "nexusdb" and all components created successfully!');
    
    // Verify tables
    const [tables] = await db.query('SHOW TABLES FROM nexusdb');
    console.log(`\nTables created in nexusdb (${tables.length}):`);
    tables.forEach(table => {
      console.log(`- ${Object.values(table)[0]}`);
    });

  } catch (error) {
    console.error('\n❌ Setup Failed!');
    console.error('Error Message:', error.message);
  } finally {
    await db.end();
  }
}

runSetup();
