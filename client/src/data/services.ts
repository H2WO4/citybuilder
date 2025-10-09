import { BuildingClass, type BuildingType } from "../types"

export const WindTurbine: BuildingType = {
  id: "wind_turbine",
  name: "Wind Turbine",

  class: BuildingClass.Services,
  cost: 800,

  stats: {
    money: -10,
    electricity: 50
  }
}
export const SolarFarm: BuildingType = {
  id: "solar_farm",
  name: "Solar Farm",

  class: BuildingClass.Services,
  cost: 2400,

  stats: {
    money: -30,
    electricity: 250
  }
}

export const WaterWell: BuildingType = {
  id: "water_well",
  name: "Water Well",

  class: BuildingClass.Services,
  cost: 1000,

  stats: {
    money: -10,
    water: 100
  }
}
