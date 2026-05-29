const express = require('express')
const cors = require('cors')
const boardRoutes = require('./routes/boards')

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/boards', boardRoutes)
module.exports = app
