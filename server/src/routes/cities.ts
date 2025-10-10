import { Request, Response } from "express"

import { APP, auth } from ".."
import { Cities } from "../models/city"

export function init() {
  APP.get("/cities", get_all)
  APP.post("/cities", auth, post_own)
  APP.patch("/cities", auth, patch_own)
  APP.delete("/cities", auth, delete_own)
}

async function get_all(_: Request, res: Response) {
  let all_cities = await Cities.find()

  res.status(200).json(all_cities)
}

async function post_own(req: Request, res: Response) {
  const name = req.body.name
  const owner = req.session.user

  try {
    const result = await Cities.insertOne({ name, owner })

    res.status(201).json(result)
  } catch (e: any) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}

async function patch_own(req: Request, res: Response) {
  const name = req.body.name
  const user = req.session.user!

  try {
    const result = await Cities.findOneAndUpdate({ owner: user }, { name })

    res.status(200).json(result)
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}

async function delete_own(req: Request, res: Response) {
  const user = req.session.user!

  try {
    await Cities.findOneAndDelete({ owner: user })

    res.status(204).send()
  } catch (e) {
    console.log(e)

    res.status(404).send("not found")
  }
}
