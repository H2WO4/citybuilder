import type { UUIDTypes as UUID } from "uuid"
import type { Building } from "../types"
import { query } from "./main"

export async function get_all_from_city(uuid: UUID): Promise<Building[]> {
  let response = await query('GET', `/buildings/${uuid}`)
  let result = await response.json() as Building[]

  return result
}

interface BuildingData {
  city: UUID,

  type: string,

  position: {
    x: number,
    y: number,
  },
  orientation: "n" | "s" | "e" | "w"
}

export async function post_one(data: BuildingData): Promise<Building[]> {
  let response = await query('POST', "/buildings", data)
  let result = await response.json() as Building[]

  return result
}
