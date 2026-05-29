const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

module.exports = async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ||
    'postgres://localhost:5432/tactics_board_test'

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const schema = fs.readFileSync(
    path.join(__dirname, '../src/db/schema.sql'), 'utf8'
  )
  await pool.query('DROP TABLE IF EXISTS boards CASCADE')
  await pool.query(schema)
  await pool.end()
}
