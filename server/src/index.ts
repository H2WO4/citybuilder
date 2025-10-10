import "dotenv/config"
import express from "express"
import cors from "cors"
import session from "express-session"
import mongoose, { Types } from "mongoose"

import { Request, Response } from "express"

declare module "express-session" {
  interface SessionData {
    user?: Types.ObjectId
  }
}

const ENV = process.env

export const PORT = ENV.PORT
export const APP = express()
APP.use(express.json())
APP.use(cors())
APP.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: "cat"
  })
)

export function auth(req: Request, res: Response, next: any) {
  if (req.session.user !== undefined) {
    next()
  } else {
    res.status(401).send("please login first")
  }
}

const DB_URL = `mongodb://${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_BASE}`
mongoose.connect(DB_URL).then(() => console.log("Connected!"))

// Use routes
require("./routes/accounts").init()
require("./routes/buildings").init()
require("./routes/cities").init()

// Start server
APP.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
