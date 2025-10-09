import { BuildingClass, type BuildingType } from "../types"

export const Straight: BuildingType = {
  id: "road_straight",
  name: "Road (Straight)",

  class: BuildingClass.Roads,
  cost: 100,

  stats: {}
}

export const Corner: BuildingType = {
  id: "road_corner",
  name: "Road (Corner)",

  class: BuildingClass.Roads,
  cost: 100,

  stats: {}
}

export const ThreeWay: BuildingType = {
  id: "road_three_way",
  name: "Road (3-way)",

  class: BuildingClass.Roads,
  cost: 100,

  stats: {}
}

export const FourWay: BuildingType = {
  id: "road_four_way",
  name: "Road (4-way)",

  class: BuildingClass.Roads,
  cost: 100,

  stats: {}
}
