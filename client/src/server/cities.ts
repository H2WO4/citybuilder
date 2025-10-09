import type { UUIDTypes as UUID } from "uuid"
import type { City } from "../types"
import { query } from "./main"

export async function get_all(): Promise<City[]> {
  const response = await query("GET", "/cities")
  const result = (await response.json()) as City[]

  return result
}

interface CityData {
  name: string
}

export async function post_one(data: CityData): Promise<City> {
  const response = await query("POST", "/cities", data)
  const result = (await response.json()) as City

  return result
}

export async function patch_one(uuid: UUID, data: CityData): Promise<City> {
  const response = await query("PATCH", `/cities/${uuid}`, data)
  const result = (await response.json()) as City

  return result
}

export async function delete_one(uuid: UUID): Promise<void> {
  await query("DELETE", `/cities/${uuid}`)
}
