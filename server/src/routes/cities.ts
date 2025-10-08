import { Request, Response } from 'express'

import { APP } from '..';
import { Cities } from '../models/city';

export function init() {
  APP.get("/cities", get_all)
  APP.post("/cities", post_one)
  APP.patch("/cities/:id", patch_one)
  APP.delete("/cities/:id", delete_by_id)
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
  } catch (e) {
    console.log(e)

    res
      .status(400)
      .send("invalid arguments")
  }
}


async function patch_one(req: Request, res: Response) {
  let id = req.params.id
  let name = req.body.name

  try {
    let result = await Cities.findOneAndUpdate({ _id: id }, { name })

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

async function delete_by_id(req: Request, res: Response) {
  let id = req.params.id

  try {
    await Cities.findByIdAndDelete(id)

    res
      .status(204)
      .send()
  } catch (e) {
    console.log(e)

    res
      .status(404)
      .send("not found")
  }
}
