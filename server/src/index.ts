import express from 'express';
import mongoose from 'mongoose';

// Setup
export const PORT = process.env.PORT || 3000;
export const APP = express();

APP.use(express.json())

mongoose.connect("mongodb://127.0.0.1:27017/main")
  .then(() => console.log('Connected!'));

// Use routes
require("./routes/cities.ts").init()

// Start server
APP.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

