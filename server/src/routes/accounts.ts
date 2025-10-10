import { Request, Response } from "express"

import { APP, auth } from ".."
import { Accounts } from "../models/accounts"
import argon2 from "argon2"

export function init() {
  APP.post("/login", login)
  APP.post("/logout", auth, logout)
  APP.post("/signin", signin)
}

async function login(req: Request, res: Response) {
  if (req.session.user !== undefined) {
    res.status(409).send("already connected")
    return
  }

  const name = req.body.name
  const pass = req.body.pass

  try {
    let result = await Accounts.findOne({ name })

    if (result !== null && (await argon2.verify(result.hash!, pass))) {
      req.session.regenerate(() => {
        req.session.user = result._id
        res.status(200).send("connected")
      })
    } else {
      res.status(404).send("incorrect login information")
    }
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}

async function logout(req: Request, res: Response) {
  req.session.destroy(() => {
    res.status(204).send()
  })
}

async function signin(req: Request, res: Response) {
  const name = req.body.name
  const pass = req.body.pass

  const hash = await argon2.hash(pass)

  try {
    const result = await Accounts.insertOne({ name, hash })

    req.session.regenerate(() => {
      req.session.user = result._id
      res.status(201).send("connected")
    })
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}
