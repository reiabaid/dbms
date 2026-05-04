# Database Configuration

This project is configured to connect to a MySQL database on Aiven.

## Credentials
The credentials are stored in the `.env` file (not to be committed to version control).

- **Host**: `multiverse-db-dbms-project01.f.aivencloud.com`
- **Port**: `12757`
- **User**: `avnadmin`
- **Database**: `defaultdb`

## Files
- `.env`: Stores environment variables.
- `db.js`: Exports a MySQL connection pool using `mysql2/promise`.
- `test-connection.js`: A script to verify the connection.

## Usage
To test the connection, run:
```bash
node test-connection.js
```

To use the database in your code:
```javascript
const db = require('./db');

async function getData() {
  const [rows] = await db.execute('SELECT * FROM your_table');
  return rows;
}
```
