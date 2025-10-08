import { Request, Response } from 'express'

import { APP } from '..';
import { Buildings } from '../models/building';

export function init() {
  APP.get("/buildings/:city", get_all_from_city)
  APP.post("/buildings", post_one)
}

async function get_all_from_city(req: Request, res: Response) {
  let city = req.params.city

  try {
    let result = await Buildings.find({ city })

    res
      .status(200)
      .json(result)
  } catch (e) {
    console.log(e)
    res
      .status(404)
      .send("not found")
  }
}

async function post_one(req: Request, res: Response) {
  let city = req.body.city
  let position = req.body.position
  let orientation = req.body.orientation
  let type = req.body.type

  try {
    let result = await Buildings.insertOne({ city, position, orientation, type })

    res
      .status(201)
      .json(result)
  } catch (e) {
    console.log(e)

    res
      .status(400)
      .send("invalid arguments")
  }
}
