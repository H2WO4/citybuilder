import { BuildingClass, type BuildingType } from "../types"

export const Farm: BuildingType = {
  id: "farm",
  name: "Farm",

  class: BuildingClass.Industrial,
  cost: 2000,

  stats: {
    population: {
      houses: 3,
      employs: 5,
    },
    electricity: -10,
    water: -10
  }
}

export const Field: BuildingType = {
  id: "field",
  name: "Field",

  class: BuildingClass.Industrial,
  cost: 400,

  stats: {
    money: 100,
    electricity: -15,
    water: -30
  }
}

export const Sawmill: BuildingType = {
  id: "sawmill",
  name: "Sawmill",

  class: BuildingClass.Industrial,
  cost: 6000,

  stats: {
    population: {
      employs: 40,
    },
    money: 400,
    electricity: -200,
    water: -50
  }
}

export const Factory: BuildingType = {
  id: "factory",
  name: "Factory",

  class: BuildingClass.Industrial,
  cost: 8000,

  stats: {
    population: {
      employs: 60,
    },
    money: 400,
    electricity: -250,
    water: -100
  }
}
