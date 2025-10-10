import type { UUIDTypes as UUID } from "uuid"
import type { Building } from "../types"
import { query } from "./main"

export async function get_all_from_city(uuid: UUID): Promise<Building[]> {
  const response = await query("GET", `/buildings/${uuid}`)
  const result = (await response.json()) as Building[]

  return result
}

export interface BuildingData {
  city: UUID

  type: string

  position: {
    x: number
    y: number
  }
  orientation: "n" | "s" | "e" | "w"
}

export async function post_one(data: BuildingData): Promise<Building[]> {
  const response = await query("POST", "/buildings", data)
  const result = (await response.json()) as Building[]

  return result
}

export interface PositionData {
  city: UUID

  position: {
    x: number
    y: number
  }
}

export async function delete_one(data: PositionData): Promise<void> {

  await query("DELETE", "/buildings", data)

  return
}
