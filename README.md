# Database Configuration

This project is configured to connect to a MySQL database on Aiven.

## Credentials
The credentials are stored in the `.env` file (not to be committed to version control).

- **Host**: `multiverse-db-dbms-project01.f.aivencloud.com`
- **Port**: `12757`
- **User**: `avnadmin`
- **Database**: `defaultdb`

## Project Structure
```text
dbms/
├── docs/                # Project documentation & Viva prep
├── sql/                 # Schema setup and seed data
├── src/                 # Connection logic and automation scripts
├── .env                 # Database credentials
└── package.json         # Scripts and dependencies
```

## Setup & Usage
1. **Initialize Project**:
   ```bash
   npm install
   ```
2. **Setup Database**:
   ```bash
   npm run setup
   ```
3. **Verify Connection**:
   ```bash
   npm run test
   ```
4. **Seed Sample Data**:
   ```bash
   npm run seed
   ```

## Database Utility
To use the database in your code:
```javascript
const db = require('./src/db');

async function getData() {
  const [rows] = await db.execute('SELECT * FROM your_table');
  return rows;
}
```
