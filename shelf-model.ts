export interface RodSKU {
  sku_id: number; // Unique numeric ID
  name: string; // Name of the produced rod as used for ordering
  spans: number[]; // Spans between attachment points in mm
}

export interface PlateSKU {
  sku_id: number; // Unique numeric ID
  name: string; // Name of the produced plate as used for ordering
  spans: number[]; // Spans between attachment points in mm
}

export interface Position {
  x: number; // mm
  z: number; // mm
}

export interface AttachmentPoint {
  y: number;
  plateId?: string;
}

export interface Rod {
  sku_id: number; // ID to match with a RodSKU
  position: Position; // Position of the (TODO: top or bottom?)
  attachmentPoints: AttachmentPoint[];
}

export interface Plate {
  sku_id: number; // ID to match with a PlateSKU
  // connections: [number, number][]; // [rodId, attachmentIndex]
}

export interface ShelfMetadata {
  [key: string]: any; // TODO: define specific metadata fields
}

export interface Shelf {
  rods: Map<number, Rod>; // id -> Rod
  plates: Map<number, Plate>; // id -> Plate
  metadata: ShelfMetadata;
}

// Constants
export const AVAILABLE_RODS: RodSKU[] = [
  { sku_id: 1, name: "1P", spans: [] },
  { sku_id: 2, name: "2P_2", spans: [200] },
  { sku_id: 3, name: "2P_3", spans: [300] },
  { sku_id: 4, name: "3P_22", spans: [200, 200] },
  { sku_id: 5, name: "3P_23", spans: [200, 300] },
  { sku_id: 6, name: "3P_32", spans: [300, 200] },
  { sku_id: 7, name: "4P_223", spans: [200, 200, 300] },
  { sku_id: 8, name: "4P_232", spans: [200, 300, 200] },
  { sku_id: 9, name: "4P_322", spans: [300, 200, 200] },
  { sku_id: 10, name: "5P_2232", spans: [200, 200, 300, 200] },
  { sku_id: 11, name: "5P_2322", spans: [200, 300, 200, 200] },
  { sku_id: 12, name: "5P_3223", spans: [300, 200, 200, 300] },
  { sku_id: 13, name: "6P_22322", spans: [200, 200, 300, 200, 200] },
  { sku_id: 14, name: "6P_32232", spans: [300, 200, 200, 300, 200] },
  { sku_id: 15, name: "7P_322322", spans: [300, 200, 200, 300, 200, 200] }
];

export const AVAILABLE_PLATES: PlateSKU[] = [
  { sku_id: 1, name: "670mm", spans: [35, 600, 35] },
  { sku_id: 2, name: "1270mm-single", spans: [35, 1200, 35] },
  { sku_id: 3, name: "1270mm-double", spans: [35, 600, 600, 35] },
  { sku_id: 4, name: "1870mm", spans: [35, 600, 600, 600, 35] }
];

// Core functions
export function createEmptyShelf(): Shelf {
  return {
    rods: new Map(),
    plates: new Map(),
    metadata: {}
  };
}

export function findClosestAttachment(cursorY: number, attachmentPoints: AttachmentPoint[]): number {
  // TODO: implement
  return 0;
}

export function findElementAtCursor(cursor: { x: number; y: number }, shelf: Shelf): any {
  // TODO: implement
  return null;
}

export function addRod(position: Position, pattern: string, shelf: Shelf): string {
  // TODO: implement
  return "";
}

export function addPlate(startRodId: string, endRodId: string, attachmentLevel: number, plateSize: number, shelf: Shelf): string {
  // TODO: implement
  return "";
}

export function removePlate(plateId: string, shelf: Shelf): boolean {
  // TODO: implement
  return false;
}

export function validateShelfConfiguration(shelf: Shelf): { valid: boolean; errors: string[]; warnings: string[] } {
  // TODO: implement
  return { valid: true, errors: [], warnings: [] };
}

// TODO: Add remaining exports as they are implemented
export {
  // calculateRodBounds,
  // calculatePlateBounds,
  // isPointInBounds,
  // updateSpatialIndex,
  // updateRodPattern,
  // serializeShelfToString,
  // parseShelfFromString
};