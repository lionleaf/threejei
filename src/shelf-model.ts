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
  y: number; // mm
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
  y: number; // Y coordinate of the plate (constant across all attachment points)
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
export const PLATE_PADDING_MM = 35;

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
  { sku_id: 1, name: "670mm", spans: [PLATE_PADDING_MM, 600, PLATE_PADDING_MM], depth:200 },
  { sku_id: 2, name: "1270mm-single", spans: [PLATE_PADDING_MM, 1200, PLATE_PADDING_MM], depth:200 },
  { sku_id: 3, name: "1270mm-double", spans: [PLATE_PADDING_MM, 600, 600, PLATE_PADDING_MM], depth:200 },
  { sku_id: 4, name: "1870mm", spans: [PLATE_PADDING_MM, 600, 600, 600, PLATE_PADDING_MM], depth:200 }
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
  if (attachmentPoints.length === 0) return -1;

  let closestIndex = 0;
  let closestDistance = Math.abs(attachmentPoints[0].y - cursorY);

  for (let i = 1; i < attachmentPoints.length; i++) {
    const distance = Math.abs(attachmentPoints[i].y - cursorY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  return closestIndex;
}

export function intersectRay(ray: {origin: Vec3f, dir: Vec3f}, shelf: Shelf): any {
  // Basic raycasting implementation - find closest rod or plate intersection
  const intersections: {type: 'rod' | 'plate', id: number, distance: number}[] = [];

  // For now, return null as this requires more complex 3D geometry calculations
  // that would need specific bounding box/mesh intersection logic
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

function findClosestRod(shelf: Shelf, referenceRod: Rod, direction: Direction): number | undefined {
  const rodEntries = Array.from(shelf.rods.entries())
    .filter(([_, rod]) => direction === Direction.Right ?
      rod.position.x > referenceRod.position.x :
      rod.position.x < referenceRod.position.x)
    .sort(([_a, a], [_b, b]) => direction === Direction.Right ?
      a.position.x - b.position.x :
      b.position.x - a.position.x);

  return rodEntries[0]?.[0]; // Return the ID of the closest rod
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
export function addPlate(height: number, sku_id: number, rodIds: number[], shelf: Shelf): number {
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


  const plateId = shelf.metadata.nextId++;

  for (const rodId of rodIds) {
    const rod = shelf.rods.get(rodId);
    if (!rod) return -1;

    const rodBaseHeight = rod.position.y;
    const attachmentIndex = rod.attachmentPoints.findIndex(point => (rodBaseHeight + point.y) === height);

    // Make sure the rod has an attachment point at the desired plate height
    if (attachmentIndex === -1){
      console.warn("Rod "+rodId+" does not have an attachment at the right height");
      for(const a of rod.attachmentPoints){
        console.log(rodBaseHeight + a.y);
      }
     return -1;
    }


    rod.attachmentPoints[attachmentIndex].plateId = plateId;
  }

  shelf.plates.set(plateId, { sku_id, connections: rodIds, y: height });
  return plateId;
}

function findAttachmentPointByY(rod: Rod, targetY: number): number | undefined {
  for (let i = 0; i < rod.attachmentPoints.length; i++) {
    if (rod.attachmentPoints[i].y === targetY) {
      return i;
    }
  }
  return undefined;
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

  // Find the closest rod in the extension direction and calculate new spans
  let targetRod: Rod | undefined;
  let newConnections: number[];
  const newSpans: number[] = [];

  if (extendDirection === Direction.Right) {
    // Find closest rod to the right of rightmost connected rod
    const rightmostRod = connectedRods[connectedRods.length - 1];
    const targetRodId = findClosestRod(shelf, rightmostRod, Direction.Right);
    newConnections = [...plate.connections];

    if (targetRodId !== undefined) {
      targetRod = shelf.rods.get(targetRodId)!;
      // Copy existing spans and add new span to target rod
      newSpans.push(...currentSKU.spans);
      const distanceToTarget = targetRod.position.x - rightmostRod.position.x;
      newSpans[newSpans.length - 1] = distanceToTarget; // Replace end padding with actual distance
      newSpans.push(PLATE_PADDING_MM); // Add new end padding
      newConnections.push(targetRodId);
    }
  } else {
    // Find closest rod to the left of leftmost connected rod
    const leftmostRod = connectedRods[0];
    const targetRodId = findClosestRod(shelf, leftmostRod, Direction.Left);
    newConnections = [...plate.connections];

    if (targetRodId !== undefined) {
      targetRod = shelf.rods.get(targetRodId)!;
      // Add new span from target rod and copy existing spans
      const distanceToTarget = leftmostRod.position.x - targetRod.position.x;
      newSpans.push(PLATE_PADDING_MM); // Start padding
      newSpans.push(distanceToTarget); // Distance to existing plate
      newSpans.push(...currentSKU.spans.slice(1)); // Skip old start padding
      newConnections.unshift(targetRodId);
    }
  }

  if (targetRod === undefined) return false;

  // Check if target rod has available attachment points at same Y level
  const targetAttachmentIndex = findAttachmentPointByY(targetRod, plate.y);
  if (targetAttachmentIndex === undefined) {
    // TODO: Call to function to see if we can swap the rod with a different SKU without moving any other plates
    // And if we can, we should make sure to only change the rod SKU once we know the plate extension succeeds

    // For now we don't handle this case:
    return false;
  }

  const targetAttachmentPoint = targetRod.attachmentPoints[targetAttachmentIndex];
  if (targetAttachmentPoint.plateId !== undefined) {
    // TODO: Call to function that tries to merge the two plates
    // return tryMergePlates()
    return false; // Return false for now
  }

  // Find plate SKU that exactly matches the new span pattern
  const targetSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== newSpans.length) return false;
    return sku.spans.every((span, index) => span === newSpans[index]);
  });
  if (!targetSKU) return false; // No plate available for this span pattern

  // Perform the extension
  plate.sku_id = targetSKU.sku_id;
  plate.connections = newConnections;
  if (targetRod.attachmentPoints[targetAttachmentIndex]) {
    targetRod.attachmentPoints[targetAttachmentIndex].plateId = plateId;
  }

  return true;
}

export function removePlate(plateId: number, shelf: Shelf): boolean {
  const plate = shelf.plates.get(plateId);
  if (!plate) return false;


  // Remove plate connections from all connected rods
  for (const rodId of plate.connections) {
    const rod = shelf.rods.get(rodId);
    if (rod) {
      const attachmentIndex = findAttachmentPointByY(rod, plate.y);
      if (attachmentIndex !== undefined) {
        const attachmentPoint = rod.attachmentPoints[attachmentIndex];
        if (attachmentPoint.plateId === plateId) {
          attachmentPoint.plateId = undefined;
        } else {
          console.warn("Rod missing expected plate connection");
        }
      }
    }
  }

  // Remove the plate from the shelf
  shelf.plates.delete(plateId);
  return true;
}

function tryMergePlates(leftPlateId: number, rightPlateId: number, shelf: Shelf): number {
  const leftPlate = shelf.plates.get(leftPlateId);
  const rightPlate = shelf.plates.get(rightPlateId);

  if (!leftPlate || !rightPlate) {
    console.log('tryMergePlates: One or both plates not found');
    return -1;
  }

  // Plates must be at same height
  if (leftPlate.y !== rightPlate.y) {
    console.log('tryMergePlates: Plates at different heights', leftPlate.y, rightPlate.y);
    return -1;
  }

  // Get the SKUs
  const leftSKU = AVAILABLE_PLATES.find(p => p.sku_id === leftPlate.sku_id);
  const rightSKU = AVAILABLE_PLATES.find(p => p.sku_id === rightPlate.sku_id);

  if (!leftSKU || !rightSKU) {
    console.log('tryMergePlates: SKU not found');
    return -1;
  }

  // Verify plates have a gap between them (rightmost rod of left plate and leftmost rod of right plate are adjacent)
  const leftRightmostRodId = leftPlate.connections[leftPlate.connections.length - 1];
  const rightLeftmostRodId = rightPlate.connections[0];

  console.log('tryMergePlates: Checking adjacency', {
    leftRightmostRodId,
    rightLeftmostRodId,
    leftConnections: leftPlate.connections,
    rightConnections: rightPlate.connections
  });

  // Get all rods sorted by X position to verify they are adjacent
  const allRodsSorted = Array.from(shelf.rods.entries())
    .sort((a, b) => a[1].position.x - b[1].position.x);

  const leftRightmostIndex = allRodsSorted.findIndex(([id]) => id === leftRightmostRodId);
  const rightLeftmostIndex = allRodsSorted.findIndex(([id]) => id === rightLeftmostRodId);

  // Check if the rods are adjacent (right plate's leftmost rod is immediately after left plate's rightmost rod)
  if (rightLeftmostIndex !== leftRightmostIndex + 1) {
    console.log('tryMergePlates: Plates not adjacent - gap too large or overlapping');
    return -1;
  }

  // Combine rod connections (include all rods from both plates)
  const combinedRods = [...leftPlate.connections, ...rightPlate.connections];

  // Get all rod objects to calculate distances
  const rods = combinedRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
  if (rods.length !== combinedRods.length) {
    console.log('tryMergePlates: Some rods not found');
    return -1;
  }

  // Build span array: [padding, gap1, gap2, ..., padding]
  const mergedSpans: number[] = [PLATE_PADDING_MM];
  for (let i = 0; i < rods.length - 1; i++) {
    const distance = rods[i + 1].position.x - rods[i].position.x;
    mergedSpans.push(distance);
  }
  mergedSpans.push(PLATE_PADDING_MM);

  console.log('tryMergePlates: Merged spans:', mergedSpans);

  // Find matching plate SKU
  const mergedSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== mergedSpans.length) return false;
    return sku.spans.every((span, index) => span === mergedSpans[index]);
  });

  if (!mergedSKU) {
    console.log('tryMergePlates: No matching SKU found for spans', mergedSpans);
    return -1;
  }

  console.log('tryMergePlates: Found matching SKU:', mergedSKU.name);

  // Perform the merge
  // Remove old plates
  removePlate(leftPlateId, shelf);
  removePlate(rightPlateId, shelf);

  // Add new merged plate
  const mergedPlateId = addPlate(leftPlate.y, mergedSKU.sku_id, combinedRods, shelf);

  console.log('tryMergePlates: Merge complete, new plate ID:', mergedPlateId);

  return mergedPlateId;
}

export function tryFillGapWithPlate(leftRodId: number, rightRodId: number, height: number, shelf: Shelf): number {
  const leftRod = shelf.rods.get(leftRodId);
  const rightRod = shelf.rods.get(rightRodId);

  if (!leftRod || !rightRod) return -1;

  // Check if both rods have attachment points at the specified height
  const leftAttachmentY = height - leftRod.position.y;
  const rightAttachmentY = height - rightRod.position.y;

  const leftAttachment = leftRod.attachmentPoints.find(ap => ap.y === leftAttachmentY);
  const rightAttachment = rightRod.attachmentPoints.find(ap => ap.y === rightAttachmentY);

  if (!leftAttachment || !rightAttachment) return -1;

  const leftPlateId = leftAttachment.plateId;
  const rightPlateId = rightAttachment.plateId;

  // Case 1: Both attachment points are empty - add a new plate
  if (leftPlateId === undefined && rightPlateId === undefined) {
    // Calculate the gap distance
    const gapDistance = rightRod.position.x - leftRod.position.x;

    // Find a plate SKU that fits this gap (2-rod plate with matching span)
    const plateSKU = AVAILABLE_PLATES.find(p => {
      return p.spans.length === 3 && p.spans[1] === gapDistance;
    });

    if (!plateSKU) return -1;

    // Add the plate
    return addPlate(height, plateSKU.sku_id, [leftRodId, rightRodId], shelf);
  }

  // Case 2: Plate on left side only - extend it to the right
  if (leftPlateId !== undefined && rightPlateId === undefined) {
    const success = tryExtendPlate(leftPlateId, Direction.Right, shelf);
    return success ? leftPlateId : -1;
  }

  // Case 3: Plate on right side only - extend it to the left
  if (leftPlateId === undefined && rightPlateId !== undefined) {
    const success = tryExtendPlate(rightPlateId, Direction.Left, shelf);
    return success ? rightPlateId : -1;
  }

  // Case 4: Both sides have plates
  if (leftPlateId !== undefined && rightPlateId !== undefined) {
    // If they're the same plate, the gap is already filled
    if (leftPlateId === rightPlateId) {
      return leftPlateId;
    }

    // Different plates - try to merge them
    return tryMergePlates(leftPlateId, rightPlateId, shelf);
  }

  return -1;
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