import { BuildingClass, type BuildingType } from "../types"

export const House: BuildingType = {
  id: "house",
  name: "House",

  class: BuildingClass.Residential,
  cost: 500,

  stats: {
    population: {
      houses: 4
    },
    money: -50,
    electricity: -10,
    water: -20
  }
}

export const Apartments: BuildingType = {
  id: "apartments",
  name: "Apartments",

  class: BuildingClass.Residential,
  cost: 1200,

  stats: {
    population: {
      houses: 10
    },
    money: -150,
    electricity: -30,
    water: -40
  }
}

export const Skyscrapper: BuildingType = {
  id: "skyscrapper_residential",
  name: "Skyscrapper (Residential)",

  class: BuildingClass.Residential,
  cost: 20000,

  stats: {
    population: {
      houses: 80
    },
    money: -1500,
    electricity: -300,
    water: -240
  }
}
