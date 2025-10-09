import { Request, Response } from "express"

import { APP } from ".."
import { Accounts } from "../models/accounts"

export function init() {
  APP.post("/login", login)
  APP.post("/accounts", post_one)
}

async function login(req: Request, res: Response) {
  const name = req.body.name
  const pass = req.body.pass

  // FIXME: NO
  const hash = pass

  try {
    let result = await Accounts.findOne({ name, hash })

    if (result !== null) {
      res.status(200).send("connected")
    } else {
      res.status(404).send("incorrect login information")
    }
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}

async function post_one(req: Request, res: Response) {
  const name = req.body.name
  const pass = req.body.pass

  // FIXME: NO
  const hash = pass

  try {
    let result = await Accounts.insertOne({ name, hash })

    res.status(201).json(result)
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}
