export enum BuildingClass {
  Residential,
  Commercial,
  Industrial,
  Entertainment,
  Services,
  Roads,
}

export interface BuildingType {
  id: string,
  name: string,

  class: BuildingClass,
  cost: number,

  stats: {
    population?: {
      houses?: number,
      employs?: number,
    }
    money?: number,
    electricity?: number,
    water?: number,
    food?: number,
  }
}
