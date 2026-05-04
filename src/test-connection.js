require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false // Required for Aiven unless you provide the CA cert
    }
  };

  console.log('--- Database Connection Test ---');
  console.log(`Connecting to: ${config.host}:${config.port}`);
  console.log(`User: ${config.user}`);
  console.log(`Database: ${config.database}`);

  try {
    const connection = await mysql.createConnection(config);
    console.log('\n✅ Success! Connected to the database.');
    
    const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
    console.log(`Verification Query (1+1): ${rows[0].solution}`);
    
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`\nFound ${tables.length} tables in ${config.database}:`);
    tables.forEach(table => {
      console.log(`- ${Object.values(table)[0]}`);
    });

    await connection.end();
    console.log('\nConnection closed.');
  } catch (error) {
    console.error('\n❌ Connection Failed!');
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
  }
}

testConnection();
