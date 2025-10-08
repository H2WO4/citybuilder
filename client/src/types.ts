import type { UUIDTypes as UUID } from "uuid";

export interface City {
  _id: UUID,
  name: string,
}

export interface Building {
  _id: UUID,
  city: UUID,

  type: string,

  position: {
    x: number,
    y: number,
  },
  orientation: "n" | "s" | "e" | "w"
}

export enum BuildingClass {
  Residential,
  Commercial,
  Industry,
  Entertainment,
  Services,
}

export interface BuildingType {
  id: string,
  name: string,
  class: BuildingClass,

  stats: {
    population?: {
      houses?: number,
      employs?: number,
    }
    electricity?: number,
    water?: number,
    food?: number,
  }
}

