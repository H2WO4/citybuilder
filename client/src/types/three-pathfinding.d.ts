declare module 'three-pathfinding' {
  import { BufferGeometry } from 'three'
  export class Pathfinding {
    setZoneData(zoneId: string, data: any): void
    getGroup(zoneId: string, position: any): number
    findPath(start: any, end: any, zone: string, group: number): any[] | null
    static createZone(geometry: BufferGeometry): any
  }
}
