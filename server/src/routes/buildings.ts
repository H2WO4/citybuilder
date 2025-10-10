import { Request, Response } from "express"

import { APP } from ".."
import { Buildings } from "../models/building"

export function init() {
  APP.get("/buildings/:city", get_all_from_city)
  APP.post("/buildings", post_one)
  APP.delete("/buildings", delete_one)
}

async function get_all_from_city(req: Request, res: Response) {
  const city = req.params.city

  try {
    const result = await Buildings.find({ city })

    res.status(200).json(result)
    res.status(200).json(result)
  } catch (e) {
    console.log(e)
    res.status(404).send("not found")
  }
}

async function post_one(req: Request, res: Response) {
  const city = req.body.city
  const position = req.body.position
  const orientation = req.body.orientation
  const type = req.body.type

  try {
    const result = await Buildings.insertOne({ city, type, position, orientation })

    res.status(201).json(result)
  } catch (e) {
    console.log(e);

    res.status(400).send("invalid arguments");
  }
}

async function delete_one(req: Request, res: Response) {
  let city = req.body.city
  let position = req.body.position

  try {
    await Buildings.findOneAndDelete({ city, position })

    res.status(204).send()
  } catch (e) {
    console.log(e)

    res.status(400).send("invalid arguments")
  }
}
