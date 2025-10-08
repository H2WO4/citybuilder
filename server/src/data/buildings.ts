export enum BuildingClass {
  Residential,
  Commercial,
  Industry,
  Entertainment,
  Services,
}

export interface BuildingType {
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

export const House: BuildingType = {
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
  name: "Wind Turbine",
  class: BuildingClass.Services,

  stats: {
    electricity: +50,
  }
}
