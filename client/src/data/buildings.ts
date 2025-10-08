import { BuildingClass, type BuildingType } from "../types"

export const House: BuildingType = {
  id: "house",
  name: "House",
  class: BuildingClass.Residential,

  stats: {
    population: {
      houses: 4,
    },
    electricity: -10,
  }
}

export const Apartments: BuildingType = {
  id: "apartments",
  name: "Apartments",
  class: BuildingClass.Residential,

  stats: {
    population: {
      houses: 8,
    },
    electricity: -30,
  }
}

export const WindTurbine: BuildingType = {
  id: "wind_turbine",
  name: "Wind Turbine",
  class: BuildingClass.Services,

  stats: {
    electricity: +50,
  }
}

