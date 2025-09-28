export interface RodSKU {
  sku_id: number; // Unique numeric ID
  name: string; // Name of the produced rod as used for ordering
  spans: number[]; // Spans between attachment points in mm
}

export interface PlateSKU {
  sku_id: number; // Unique numeric ID
  name: string; // Name of the produced plate as used for ordering
  spans: number[]; // Spans between attachment points in mm
  depth: number; // mm
}

export interface Vec2f {
  x: number; // mm
  z: number; // mm
}

export interface Vec3f {
  x: number;
  y: number;
  z: number;
}

export interface AttachmentPoint {
  y: number;
  plateId?: number;
}

export interface Rod {
  sku_id: number; // ID to match with a RodSKU
  position: Vec2f; // Position of the (TODO: top or bottom?)
  attachmentPoints: AttachmentPoint[];
}

export interface Plate {
  sku_id: number; // ID to match with a PlateSKU
  connections: number[]; // rodIds, attachmentIndex implicit by order
}

export interface ShelfMetadata {
  nextId: number;
}

export enum Direction {
  Left = "left",
  Right = "right"
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
  { sku_id: 1, name: "670mm", spans: [35, 600, 35], depth:200 },
  { sku_id: 2, name: "1270mm-single", spans: [35, 1200, 35], depth:200 },
  { sku_id: 3, name: "1270mm-double", spans: [35, 600, 600, 35], depth:200 },
  { sku_id: 4, name: "1870mm", spans: [35, 600, 600, 600, 35], depth:200 }
];

// Core functions
export function createEmptyShelf(): Shelf {
  return {
    rods: new Map(),
    plates: new Map(),
    metadata: { nextId: 1 }
  };
}

export function findClosestAttachment(cursorY: number, attachmentPoints: AttachmentPoint[]): number {
  // TODO: implement
  return 0;
}

export function intersectRay(ray: {origin: Vec3f, dir: Vec3f}, shelf: Shelf): any {
  // TODO: implement
  return null;
}

export function calculateAttachmentPositions(pattern: RodSKU): number[] {
  const positions = [];
  let currentPosition = 0;

  positions.push(currentPosition);
  for (const gap of pattern.spans) {
    currentPosition += gap;
    positions.push(currentPosition);
  }

  return positions;
}

export function addRod(position: Vec2f, sku_id: number, shelf: Shelf): number {
  const id = shelf.metadata.nextId++;
  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === sku_id);

  // Create attachment points based on rod pattern
  const attachmentPoints: AttachmentPoint[] = [];
  if (rodSKU) {
    const positions = calculateAttachmentPositions(rodSKU);
    for (const y of positions) {
      attachmentPoints.push({ y });
    }
  }

  shelf.rods.set(id, { sku_id, position, attachmentPoints });
  return id;
}

// rodIds MUST be in order of increasing x position
export function addPlate(sku_id: number, rodIds: number[], shelf: Shelf): number {
  const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === sku_id);
  if (!plateSKU) return -1;

  // Validate rod spacing matches plate spans
  if (rodIds.length < 2) return -1;
  const rods = rodIds.map(id => shelf.rods.get(id)).filter(rod => rod !== undefined);
  if (rods.length !== rodIds.length) return -1;

  for (let i = 0; i < rods.length - 1; i++) {
    const distance = Math.abs(rods[i + 1].position.x - rods[i].position.x);
    const expectedDistance = plateSKU.spans[i + 1]; // Skip first padding span
    if (distance !== expectedDistance) return -1;
  }

  const attachmentCount = plateSKU.spans.length - 1;

  const plateId = shelf.metadata.nextId++;
  for (const rodId of rodIds) {
    const rod = shelf.rods.get(rodId);
    if (rod) {
      for (let i = 0; i < attachmentCount && i < rod.attachmentPoints.length; i++) {
        if (rod.attachmentPoints[i]) {
          rod.attachmentPoints[i].plateId = plateId;
        }
      }
    }
  }

  shelf.plates.set(plateId, { sku_id, connections: rodIds });
  return plateId;
}

export function tryExtendPlate(plateId: number, extendDirection: Direction, shelf: Shelf): boolean{
  // Get the plate and validate it exists
  const plate = shelf.plates.get(plateId);
  if (!plate) return false;

  // Get current plateSKU to understand current span structure
  const currentSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
  if (!currentSKU) return false;

  // Find all connected rods and their positions
  const connectedRods = plate.connections.map(rodId => shelf.rods.get(rodId)).filter(rod => rod !== undefined);
  if (connectedRods.length === 0) return false;

  // Find the closest rod in the extension direction
  let targetRod: Rod | undefined;
  let newConnections: number[];

  if (extendDirection === Direction.Right) {
    // Find closest rod to the right of rightmost connected rod
    const rightmostRod = connectedRods[connectedRods.length - 1];
    targetRod = Array.from(shelf.rods.values())
      .filter(rod => rod.position.x > rightmostRod.position.x)
      .sort((a, b) => a.position.x - b.position.x)[0]; // Closest to the right
    newConnections = [...plate.connections];
  } else {
    // Find closest rod to the left of leftmost connected rod
    const leftmostRod = connectedRods[0];
    targetRod = Array.from(shelf.rods.values())
      .filter(rod => rod.position.x < leftmostRod.position.x)
      .sort((a, b) => b.position.x - a.position.x)[0]; // Closest to the left
    newConnections = [...plate.connections];
  }

  if (!targetRod) return false;

  // Check if target rod has available attachment points at same Y level
  // For simplicity, use first attachment point (index 0) for now
  if (!targetRod.attachmentPoints[0] || targetRod.attachmentPoints[0].plateId !== undefined) {
    return false; // Attachment point occupied or doesn't exist
  }

  // Calculate the required spans for the new plate
  const newSpans: number[] = [];
  if (extendDirection === Direction.Right) {
    // Copy existing spans and add new span to target rod
    newSpans.push(...currentSKU.spans);
    const rightmostRod = connectedRods[connectedRods.length - 1];
    const distanceToTarget = targetRod.position.x - rightmostRod.position.x;
    newSpans[newSpans.length - 1] = distanceToTarget; // Replace end padding with actual distance
    newSpans.push(35); // Add new end padding
  } else {
    // Add new span from target rod and copy existing spans
    const leftmostRod = connectedRods[0];
    const distanceToTarget = leftmostRod.position.x - targetRod.position.x;
    newSpans.push(35); // Start padding
    newSpans.push(distanceToTarget); // Distance to existing plate
    newSpans.push(...currentSKU.spans.slice(1)); // Skip old start padding
  }

  // Find plate SKU that matches the new span pattern
  const targetSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== newSpans.length) return false;
    const totalLength = sku.spans.reduce((sum, span) => sum + span, 0);
    const requiredLength = newSpans.reduce((sum, span) => sum + span, 0);
    return totalLength === requiredLength;
  });
  if (!targetSKU) return false; // No plate available for this span pattern

  // Perform the extension
  // Remove old plate connections from all rods
  for (const rodId of plate.connections) {
    const rod = shelf.rods.get(rodId);
    if (rod && rod.attachmentPoints[0]) {
      rod.attachmentPoints[0].plateId = undefined;
    }
  }

  // Update plate connections and SKU
  const targetRodId = Array.from(shelf.rods.entries()).find(([_, rod]) => rod === targetRod)?.[0];
  if (!targetRodId) return false;

  if (extendDirection === Direction.Right) {
    newConnections.push(targetRodId);
  } else {
    newConnections.unshift(targetRodId);
  }

  plate.sku_id = targetSKU.sku_id;
  plate.connections = newConnections;

  // Add new plate connections to all rods
  for (const rodId of newConnections) {
    const rod = shelf.rods.get(rodId);
    if (rod && rod.attachmentPoints[0]) {
      rod.attachmentPoints[0].plateId = plateId;
    }
  }

  return true;
}

export function removePlate(plateId: number, shelf: Shelf): boolean {
  // TODO: implement
  return false;
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