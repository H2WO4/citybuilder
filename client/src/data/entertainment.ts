import { BuildingClass, type BuildingType } from "../types"

export const Gazebo: BuildingType = {
  id: "gazebo",
  name: "Gazebo",

  class: BuildingClass.Entertainment,
  cost: 300,

  stats: {
    money: -10,
  }
}

export const Fountain: BuildingType = {
  id: "fountain",
  name: "Fountain",

  class: BuildingClass.Entertainment,
  cost: 400,

  stats: {
    money: -15,
    water: -5
  }
}

export const Plaza: BuildingType = {
  id: "plaza",
  name: "Plaza",

  class: BuildingClass.Entertainment,
  cost: 600,

  stats: {
    money: -25,
    water: -5
  }
}

export const Hotel: BuildingType = {
  id: "hotel",
  name: "Hotel",

  class: BuildingClass.Entertainment,
  cost: 3000,

  stats: {
    money: 1000,
    electricity: -120,
    water: -80
  }
}
