import { Request, Response } from 'express'

import { APP } from "..";
import { Cities } from '../models/city';

export function init() {
  APP.get("/cities", get_all)
  APP.post("/cities", post_one)
  APP.get("/cities/:name", get_by_name)
}

async function get_all(_: Request, res: Response) {
  let all_cities = await Cities.find()

  res
    .status(200)
    .json(all_cities)
}

async function post_one(req: Request, res: Response) {
  let name = req.body.name

  try {
    let result = await Cities.insertOne({ name })

    res
      .status(201)
      .json(result)
  } catch (_) {
    res
      .status(400)
      .send("invalid arguments")
  }
}

async function get_by_name(req: Request, res: Response) {
  let name = req.params.name

  try {
    let result = await Cities.findOne({ name })

    res
      .status(200)
      .json(result)
  } catch (_) {
    res
      .status(404)
      .send("not found")
  }

}

