import { BuildingClass, type BuildingType } from "../types"

export const GroceryStore: BuildingType = {
  id: "grocery_store",
  name: "Grocery Store",

  class: BuildingClass.Commercial,
  cost: 900,

  stats: {
    population: {
      employs: 6,
    },
    money: 150,
    electricity: -25,
    water: -10
  }
}

export const Bar: BuildingType = {
  id: "bar",
  name: "Bar",

  class: BuildingClass.Commercial,
  cost: 1800,

  stats: {
    population: {
      employs: 8,
    },
    money: 600,
    electricity: -40,
    water: -20
  }
}

export const Restaurant: BuildingType = {
  id: "restaurant",
  name: "Restaurant",

  class: BuildingClass.Commercial,
  cost: 1600,

  stats: {
    population: {
      employs: 15,
    },
    money: 250,
    electricity: -30,
    water: -30
  }
}

export const CityMarket: BuildingType = {
  id: "city_market",
  name: "City Market",

  class: BuildingClass.Commercial,
  cost: 1200,

  stats: {
    population: {
      employs: 10,
    },
  }
}

export const Offices: BuildingType = {
  id: "offices",
  name: "Offices",

  class: BuildingClass.Commercial,
  cost: 2000,

  stats: {
    population: {
      employs: 20,
    },
    money: 300,
    electricity: -50,
    water: -5
  }
}

export const Skyscrapper: BuildingType = {
  id: "skyscrapper_offices",
  name: "Skyscrapper (Offices)",

  class: BuildingClass.Commercial,
  cost: 25000,

  stats: {
    population: {
      employs: 140,
    },
    money: 2000,
    electricity: -400,
    water: -80
  }
}
