import type { BuildingType } from "./types"
import * as Roads from "./data/roads"
import * as Residential from "./data/residential"
import * as Commercial from "./data/commercial"
import * as Industrial from "./data/industrial"
import * as Entertainment from "./data/entertainment"
import * as Services from "./data/services"

export const ALL_BUILDINGS: Map<string, BuildingType> = init_map()

function init_map() {
  const map = new Map()
  const all_buildings = [
    Roads.Straight,
    Roads.Corner,
    Roads.FourWay,
    Roads.ThreeWay,

    Residential.House,
    Residential.Apartments,
    Residential.Skyscrapper,

    Commercial.GroceryStore,
    Commercial.Bar,
    Commercial.Restaurant,
    Commercial.CityMarket,
    Commercial.Offices,
    Commercial.Skyscrapper,

    Industrial.Farm,
    Industrial.Field,
    Industrial.Sawmill,
    Industrial.Factory,

    Entertainment.Gazebo,
    Entertainment.Fountain,
    Entertainment.Plaza,
    Entertainment.Hotel,

    Services.WindTurbine,
    Services.SolarFarm,
    Services.WaterWell
  ]

  all_buildings.forEach((b) => {
    map.set(b.id, b)
  })

  return map
}