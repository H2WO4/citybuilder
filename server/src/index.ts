import 'dotenv/config'
import express from 'express';
import mongoose from 'mongoose';

// Setup
const ENV = process.env

export const PORT = ENV.PORT;
export const APP = express();
APP.use(express.json())

const DB_URL = `mongodb://${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_BASE}`
mongoose.connect(DB_URL)
  .then(() => console.log('Connected!'));

// Use routes
require("./routes/buildings").init()
require("./routes/cities").init()

// Start server
APP.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

