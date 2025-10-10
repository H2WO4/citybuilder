import { Straight } from "./data/roads"
import { House } from "./data/residential"
import { Offices } from "./data/commercial"
import { Sawmill } from "./data/industrial"
import { WindTurbine, WaterWell } from "./data/services"

/**
 * Catalog adapts the domain kinds used by the UI ("road", "house", "building", ...)
 * to concrete BuildingType entries defined under `client/src/data/*`.
 *
 * NOTE: this file centralizes the mapping but does not duplicate the authoritative
 * data; it only references the exported objects from the data files (which must
 * not be modified as requested).
 */

export function getBuildingTypeForKind(kind: string) {
  switch (kind) {
    case "road":
      return Straight
    case "house":
      return House
    case "building":
      return Offices // chooses Offices as a representative commercial building
    case "sawmill":
      return Sawmill
    case "turbine":
      return WindTurbine
    case "well":
      return WaterWell
    default:
      return null
  }
}

export function getCostForKind(kind: string): number {
  const t = getBuildingTypeForKind(kind)
  if (!t) {
    throw new Error(`unknown-kind:${kind}`)
  }
  return t.cost
}

export default { getBuildingTypeForKind, getCostForKind }
