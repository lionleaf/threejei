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
  ghostPlateIds?: Array<number>
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

// A GhostPlate is a UX element of a plate that is not part of the shelf yet
// but provides information about potential shelf modifications,
// and includes the information to allow the user to add this plate (or information why it's illegal)
export interface GhostPlate {
  sku_id?: number; // ID to match with a PlateSKU
  connections?: number[]; // rodIds, attachmentIndex implicit by order
  position: Vec2f;
  legal: boolean;
  direction?: 'left' | 'right'; // For debugging: which direction was this ghost generated from
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
  ghostPlates: Array<GhostPlate>
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
  { sku_id: 1, name: "670mm", spans: [PLATE_PADDING_MM, 600, PLATE_PADDING_MM], depth: 200 },
  { sku_id: 2, name: "1270mm-single", spans: [PLATE_PADDING_MM, 1200, PLATE_PADDING_MM], depth: 200 },
  { sku_id: 3, name: "1270mm-double", spans: [PLATE_PADDING_MM, 600, 600, PLATE_PADDING_MM], depth: 200 },
  { sku_id: 4, name: "1870mm", spans: [PLATE_PADDING_MM, 600, 600, 600, PLATE_PADDING_MM], depth: 200 }
];

// Core functions
export function createEmptyShelf(): Shelf {
  return {
    rods: new Map(),
    plates: new Map(),
    ghostPlates: new Array(),
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

export function intersectRay(ray: { origin: Vec3f, dir: Vec3f }, shelf: Shelf): any {
  // Basic raycasting implementation - find closest rod or plate intersection
  const intersections: { type: 'rod' | 'plate', id: number, distance: number }[] = [];

  // For now, return undefined as this requires more complex 3D geometry calculations
  // that would need specific bounding box/mesh intersection logic
  return undefined;
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
    if (attachmentIndex === -1) {
      console.warn("Rod " + rodId + " does not have an attachment at the right height");
      for (const a of rod.attachmentPoints) {
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

export function canExtendPlate(plateId: number, extendDirection: Direction, shelf: Shelf): [number, number[]] | undefined {
  // Get the plate and validate it exists
  const plate = shelf.plates.get(plateId);
  if (!plate) return undefined;

  // Get current plateSKU to understand current span structure
  const currentSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
  if (!currentSKU) return undefined;

  // Find all connected rods and their positions
  const connectedRods = plate.connections.map(rodId => shelf.rods.get(rodId)).filter(rod => rod !== undefined);
  if (connectedRods.length === 0) return undefined;

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

  if (targetRod === undefined) return undefined;

  // Check if target rod has available attachment points at same Y level
  const targetAttachmentIndex = findAttachmentPointByY(targetRod, plate.y);
  if (targetAttachmentIndex === undefined) {
    // TODO: Call to function to see if we can swap the rod with a different SKU without moving any other plates
    // And if we can, we should make sure to only change the rod SKU once we know the plate extension succeeds

    // For now we don't handle this case:
    return undefined;
  }

  const targetAttachmentPoint = targetRod.attachmentPoints[targetAttachmentIndex];
  if (targetAttachmentPoint.plateId !== undefined) {
    // TODO: Call to function that tries to merge the two plates
    // return tryMergePlates()
    return undefined; // Return undefined for now
  }

  // Find plate SKU that exactly matches the new span pattern
  const targetSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== newSpans.length) return false;
    return sku.spans.every((span, index) => span === newSpans[index]);
  });
  if (!targetSKU) return undefined; // No plate available for this span pattern

  // Perform the extension
  plate.sku_id = targetSKU.sku_id;
  plate.connections = newConnections;
  if (targetRod.attachmentPoints[targetAttachmentIndex]) {
    targetRod.attachmentPoints[targetAttachmentIndex].plateId = plateId;
  }

  return [targetSKU.sku_id, newConnections];
}

export function tryExtendPlate(plateId: number, extendDirection: Direction, shelf: Shelf): boolean {
  const result = canExtendPlate(plateId, extendDirection, shelf);
  return result !== undefined;
}

export function tryMergePlates(leftPlateId: number, rightPlateId: number, shelf: Shelf): number {
  const leftPlate = shelf.plates.get(leftPlateId);
  const rightPlate = shelf.plates.get(rightPlateId);

  if (!leftPlate || !rightPlate) return -1;
  if (leftPlate.y !== rightPlate.y) return -1;

  const leftSKU = AVAILABLE_PLATES.find(p => p.sku_id === leftPlate.sku_id);
  const rightSKU = AVAILABLE_PLATES.find(p => p.sku_id === rightPlate.sku_id);
  if (!leftSKU || !rightSKU) return -1;

  const leftRightmostRodId = leftPlate.connections[leftPlate.connections.length - 1];
  const rightLeftmostRodId = rightPlate.connections[0];

  const leftRightmostRod = shelf.rods.get(leftRightmostRodId);
  const rightLeftmostRod = shelf.rods.get(rightLeftmostRodId);

  if (!leftRightmostRod || !rightLeftmostRod) return -1;

  const combinedRods = [...leftPlate.connections, ...rightPlate.connections];
  let mergedSpans: number[];

  if (leftRightmostRodId === rightLeftmostRodId) {
    mergedSpans = [
      ...leftSKU.spans.slice(0, -1),
      ...rightSKU.spans.slice(1)
    ];
  } else {
    const gapDistance = rightLeftmostRod.position.x - leftRightmostRod.position.x;
    mergedSpans = [
      ...leftSKU.spans.slice(0, -1),
      gapDistance,
      ...rightSKU.spans.slice(1)
    ];
  }

  const mergedSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== mergedSpans.length) return false;
    return sku.spans.every((span, index) => span === mergedSpans[index]);
  });

  if (!mergedSKU) return -1;

  removePlate(rightPlateId, shelf);
  leftPlate.sku_id = mergedSKU.sku_id;
  leftPlate.connections = combinedRods;

  for (const rodId of combinedRods) {
    const rod = shelf.rods.get(rodId);
    if (!rod) continue;
    const attachmentY = leftPlate.y - rod.position.y;
    const attachment = rod.attachmentPoints.find(ap => ap.y === attachmentY);
    if (attachment) {
      attachment.plateId = leftPlateId;
    }
  }

  return leftPlateId;
}

export function removeRod(rodId: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) return false;

  // Remove all plates connected to this rod
  const platesToRemove: number[] = [];
  shelf.plates.forEach((plate, plateId) => {
    if (plate.connections.includes(rodId)) {
      platesToRemove.push(plateId);
    }
  });

  platesToRemove.forEach(plateId => removePlate(plateId, shelf));

  // Remove the rod from the shelf
  shelf.rods.delete(rodId);
  return true;
}

export function removeRodSegment(rodId: number, segmentIndex: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) {
    console.log('removeRodSegment: Rod not found');
    return false;
  }

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) {
    console.log('removeRodSegment: Rod SKU not found');
    return false;
  }

  const numSegments = rodSKU.spans.length;

  console.log(`removeRodSegment: Removing segment ${segmentIndex} from ${numSegments}-segment rod`, {
    rodId,
    sku: rodSKU.name,
    segmentIndex
  });

  // Special case: Rod with no segments (single attachment point like "1P")
  // Remove the entire rod instead
  if (numSegments === 0) {
    console.log('removeRodSegment: Rod has no segments (single attachment point), removing entire rod');
    return removeRod(rodId, shelf);
  }

  // Validate segment index
  if (segmentIndex < 0 || segmentIndex >= numSegments) {
    console.log('removeRodSegment: Invalid segment index');
    return false;
  }

  const removedSegmentSpan = rodSKU.spans[segmentIndex];

  // Find first and last attachment points with plates
  let firstPlateAttachmentIndex = -1;
  let lastPlateAttachmentIndex = -1;

  for (let i = 0; i < rod.attachmentPoints.length; i++) {
    if (rod.attachmentPoints[i].plateId !== undefined) {
      if (firstPlateAttachmentIndex === -1) {
        firstPlateAttachmentIndex = i;
      }
      lastPlateAttachmentIndex = i;
    }
  }

  // If no plates on rod, remove entire rod
  if (firstPlateAttachmentIndex === -1) {
    console.log('removeRodSegment: No plates on rod, removing entire rod');
    return removeRod(rodId, shelf);
  }

  // Segment i is between attachment points i and i+1
  const clickedSegmentBottomAttachment = segmentIndex;
  const clickedSegmentTopAttachment = segmentIndex + 1;

  // Check if clicked segment is in the bottom empty region (below first plate)
  const isInBottomEmptyRegion = clickedSegmentTopAttachment <= firstPlateAttachmentIndex;

  // Check if clicked segment is in the top empty region (above last plate)
  const isInTopEmptyRegion = clickedSegmentBottomAttachment >= lastPlateAttachmentIndex;

  console.log(`removeRodSegment: Segment ${segmentIndex}, firstPlate at attachment ${firstPlateAttachmentIndex}, lastPlate at ${lastPlateAttachmentIndex}`);
  console.log(`removeRodSegment: isInBottomEmptyRegion: ${isInBottomEmptyRegion}, isInTopEmptyRegion: ${isInTopEmptyRegion}`);

  // Case A: Clicked in bottom empty region - remove all bottom empty segments
  if (isInBottomEmptyRegion) {
    console.log('removeRodSegment: Removing all bottom empty segments, adjusting Y position');

    // Calculate how many segments to remove (segments below the first plate attachment)
    const segmentsToRemove = firstPlateAttachmentIndex;

    if (segmentsToRemove === 0) {
      console.log('removeRodSegment: Bottom attachment point has plate, cannot remove');
      return false;
    }

    console.log(`removeRodSegment: Removing ${segmentsToRemove} bottom segment(s) to reach first plate at attachment ${firstPlateAttachmentIndex}`);

    const newSpans = rodSKU.spans.slice(segmentsToRemove); // Remove first N segments

    const newRodSKU = AVAILABLE_RODS.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newRodSKU) {
      console.log('removeRodSegment: No matching rod SKU for trimmed rod');
      return false;
    }

    // Calculate total Y adjustment
    const totalAdjustment = rodSKU.spans.slice(0, segmentsToRemove).reduce((sum, span) => sum + span, 0);

    // Adjust Y position upward to keep top fixed
    rod.position.y += totalAdjustment;

    // Update SKU
    rod.sku_id = newRodSKU.sku_id;

    // Rebuild attachment points
    rod.attachmentPoints = [];
    const positions = calculateAttachmentPositions(newRodSKU);
    for (const y of positions) {
      rod.attachmentPoints.push({ y });
    }

    // Re-attach existing plates (Y positions haven't changed in world space)
    shelf.plates.forEach((plate, plateId) => {
      if (plate.connections.includes(rodId)) {
        const attachmentY = plate.y - rod.position.y;
        const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
        if (attachmentIndex !== -1) {
          rod.attachmentPoints[attachmentIndex].plateId = plateId;
        }
      }
    });

    console.log(`removeRodSegment: ${segmentsToRemove} bottom segment(s) removed, Y adjusted by`, totalAdjustment);
    return true;
  }

  // Case B: Clicked in top empty region - remove all top empty segments
  if (isInTopEmptyRegion) {
    console.log('removeRodSegment: Removing all top empty segments');

    // Calculate how many segments to remove (segments above the last plate attachment)
    // Number of attachment points = number of segments + 1
    // So segments to remove = (total attachment points - 1) - lastPlateAttachmentIndex
    const segmentsToRemove = (rod.attachmentPoints.length - 1) - lastPlateAttachmentIndex;

    if (segmentsToRemove === 0) {
      console.log('removeRodSegment: Top attachment point has plate, cannot remove');
      return false;
    }

    console.log(`removeRodSegment: Removing ${segmentsToRemove} top segment(s) to reach last plate at attachment ${lastPlateAttachmentIndex}`);

    const newSpans = rodSKU.spans.slice(0, numSegments - segmentsToRemove); // Remove last N segments

    const newRodSKU = AVAILABLE_RODS.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newRodSKU) {
      console.log('removeRodSegment: No matching rod SKU for trimmed rod');
      return false;
    }

    // Find and handle affected plates
    const oldAttachmentPositions = calculateAttachmentPositions(rodSKU);
    const newAttachmentPositions = calculateAttachmentPositions(newRodSKU);

    const platesToHandle: number[] = [];
    rod.attachmentPoints.forEach((ap, index) => {
      if (ap.plateId !== undefined) {
        const oldY = oldAttachmentPositions[index];
        const stillExists = newAttachmentPositions.includes(oldY);

        if (!stillExists && !platesToHandle.includes(ap.plateId)) {
          platesToHandle.push(ap.plateId);
        }
      }
    });

    // Remove or trim affected plates
    platesToHandle.forEach(plateId => {
      const plate = shelf.plates.get(plateId);
      if (!plate) return;

      const rodIndexInPlate = plate.connections.indexOf(rodId);
      if (rodIndexInPlate === -1) return;

      if (rodIndexInPlate === 0 || rodIndexInPlate === plate.connections.length - 1) {
        const segmentToRemove = rodIndexInPlate === 0 ? 0 : plate.connections.length - 2;
        removeSegmentFromPlate(plateId, segmentToRemove, shelf);
      } else {
        removePlate(plateId, shelf);
      }
    });

    // Update SKU
    rod.sku_id = newRodSKU.sku_id;

    // Rebuild attachment points
    rod.attachmentPoints = [];
    const positions = calculateAttachmentPositions(newRodSKU);
    for (const y of positions) {
      rod.attachmentPoints.push({ y });
    }

    // Re-attach remaining plates
    shelf.plates.forEach((plate, plateId) => {
      if (plate.connections.includes(rodId)) {
        const attachmentY = plate.y - rod.position.y;
        const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
        if (attachmentIndex !== -1) {
          rod.attachmentPoints[attachmentIndex].plateId = plateId;
        }
      }
    });

    console.log(`removeRodSegment: ${segmentsToRemove} top segment(s) removed`);
    return true;
  }

  // Case E: Remove middle segment - split into two rods
  console.log('removeRodSegment: Removing middle segment, splitting rod');

  const bottomSpans = rodSKU.spans.slice(0, segmentIndex);
  const topSpans = rodSKU.spans.slice(segmentIndex + 1);

  const bottomRodSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== bottomSpans.length) return false;
    return sku.spans.every((span, i) => span === bottomSpans[i]);
  });

  const topRodSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== topSpans.length) return false;
    return sku.spans.every((span, i) => span === topSpans[i]);
  });

  if (!bottomRodSKU || !topRodSKU) {
    console.log('removeRodSegment: Cannot split - no matching SKUs for both parts');
    return false;
  }

  // Calculate Y positions
  const oldAttachmentPositions = calculateAttachmentPositions(rodSKU);
  const splitPointY = rod.position.y + oldAttachmentPositions[segmentIndex + 1];

  // Create top rod
  const topRodId = addRod({ x: rod.position.x, y: splitPointY }, topRodSKU.sku_id, shelf);

  // Update bottom rod (reuse existing rod)
  rod.sku_id = bottomRodSKU.sku_id;
  rod.attachmentPoints = [];
  const bottomPositions = calculateAttachmentPositions(bottomRodSKU);
  for (const y of bottomPositions) {
    rod.attachmentPoints.push({ y });
  }

  // Reassign plates to appropriate rods
  const platesToReassign: number[] = [];
  shelf.plates.forEach((plate, plateId) => {
    if (plate.connections.includes(rodId)) {
      platesToReassign.push(plateId);
    }
  });

  platesToReassign.forEach(plateId => {
    const plate = shelf.plates.get(plateId);
    if (!plate) return;

    // Determine if plate belongs to bottom or top rod
    if (plate.y < splitPointY) {
      // Belongs to bottom rod - already connected
      const attachmentY = plate.y - rod.position.y;
      const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
      if (attachmentIndex !== -1) {
        rod.attachmentPoints[attachmentIndex].plateId = plateId;
      } else {
        // No attachment point, remove plate
        removePlate(plateId, shelf);
      }
    } else {
      // Belongs to top rod - update connection
      const topRod = shelf.rods.get(topRodId);
      if (!topRod) return;

      const rodIndexInPlate = plate.connections.indexOf(rodId);
      plate.connections[rodIndexInPlate] = topRodId;

      const attachmentY = plate.y - topRod.position.y;
      const attachmentIndex = topRod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
      if (attachmentIndex !== -1) {
        topRod.attachmentPoints[attachmentIndex].plateId = plateId;
      } else {
        // No attachment point, remove plate
        removePlate(plateId, shelf);
      }
    }
  });

  console.log('removeRodSegment: Split complete, new rods:', rodId, topRodId);
  return true;
}

export function removeSegmentFromPlate(plateId: number, segmentIndex: number, shelf: Shelf): boolean {
  const plate = shelf.plates.get(plateId);
  if (!plate) {
    console.log('removeSegmentFromPlate: Plate not found');
    return false;
  }

  const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
  if (!plateSKU) {
    console.log('removeSegmentFromPlate: Plate SKU not found');
    return false;
  }

  const numSegments = plate.connections.length - 1;

  console.log(`removeSegmentFromPlate: Removing segment ${segmentIndex} from ${numSegments}-segment plate`, {
    plateId,
    connections: plate.connections,
    segmentIndex
  });

  // Case D: Single-segment plate - remove entirely
  if (numSegments === 1) {
    console.log('removeSegmentFromPlate: Single segment plate, removing entirely');
    return removePlate(plateId, shelf);
  }

  // Validate segment index
  if (segmentIndex < 0 || segmentIndex >= numSegments) {
    console.log('removeSegmentFromPlate: Invalid segment index');
    return false;
  }

  // Case A: Remove left edge segment
  if (segmentIndex === 0) {
    console.log('removeSegmentFromPlate: Removing left edge segment');
    const newRods = plate.connections.slice(1);

    // Calculate new spans
    const newSpans = [PLATE_PADDING_MM];
    const rods = newRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
    for (let i = 0; i < rods.length - 1; i++) {
      const distance = rods[i + 1]!.position.x - rods[i]!.position.x;
      newSpans.push(distance);
    }
    newSpans.push(PLATE_PADDING_MM);

    // Find matching SKU
    const newSKU = AVAILABLE_PLATES.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newSKU) {
      console.log('removeSegmentFromPlate: No matching SKU for trimmed plate, removing entirely');
      return removePlate(plateId, shelf);
    }

    // Remove old plate and add new one
    removePlate(plateId, shelf);
    const newPlateId = addPlate(plate.y, newSKU.sku_id, newRods, shelf);
    console.log('removeSegmentFromPlate: Left edge removed, new plate:', newPlateId);
    return newPlateId !== -1;
  }

  // Case B: Remove right edge segment
  if (segmentIndex === numSegments - 1) {
    console.log('removeSegmentFromPlate: Removing right edge segment');
    const newRods = plate.connections.slice(0, -1);

    // Calculate new spans
    const newSpans = [PLATE_PADDING_MM];
    const rods = newRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
    for (let i = 0; i < rods.length - 1; i++) {
      const distance = rods[i + 1]!.position.x - rods[i]!.position.x;
      newSpans.push(distance);
    }
    newSpans.push(PLATE_PADDING_MM);

    // Find matching SKU
    const newSKU = AVAILABLE_PLATES.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newSKU) {
      console.log('removeSegmentFromPlate: No matching SKU for trimmed plate, removing entirely');
      return removePlate(plateId, shelf);
    }

    // Remove old plate and add new one
    removePlate(plateId, shelf);
    const newPlateId = addPlate(plate.y, newSKU.sku_id, newRods, shelf);
    console.log('removeSegmentFromPlate: Right edge removed, new plate:', newPlateId);
    return newPlateId !== -1;
  }

  // Case C: Remove middle segment - split into two plates
  console.log('removeSegmentFromPlate: Removing middle segment, splitting plate');
  const leftRods = plate.connections.slice(0, segmentIndex + 1);
  const rightRods = plate.connections.slice(segmentIndex + 1);

  // Calculate spans for left plate
  const leftSpans = [PLATE_PADDING_MM];
  const leftRodObjs = leftRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
  for (let i = 0; i < leftRodObjs.length - 1; i++) {
    const distance = leftRodObjs[i + 1]!.position.x - leftRodObjs[i]!.position.x;
    leftSpans.push(distance);
  }
  leftSpans.push(PLATE_PADDING_MM);

  // Calculate spans for right plate
  const rightSpans = [PLATE_PADDING_MM];
  const rightRodObjs = rightRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
  for (let i = 0; i < rightRodObjs.length - 1; i++) {
    const distance = rightRodObjs[i + 1]!.position.x - rightRodObjs[i]!.position.x;
    rightSpans.push(distance);
  }
  rightSpans.push(PLATE_PADDING_MM);

  // Find matching SKUs
  const leftSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== leftSpans.length) return false;
    return sku.spans.every((span, i) => span === leftSpans[i]);
  });

  const rightSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== rightSpans.length) return false;
    return sku.spans.every((span, i) => span === rightSpans[i]);
  });

  if (!leftSKU || !rightSKU) {
    console.log('removeSegmentFromPlate: Cannot split - no matching SKUs for both parts, removing entirely');
    return removePlate(plateId, shelf);
  }

  // Remove old plate and add two new ones
  removePlate(plateId, shelf);
  const leftPlateId = addPlate(plate.y, leftSKU.sku_id, leftRods, shelf);
  const rightPlateId = addPlate(plate.y, rightSKU.sku_id, rightRods, shelf);

  console.log('removeSegmentFromPlate: Split complete, new plates:', leftPlateId, rightPlateId);
  return leftPlateId !== -1 && rightPlateId !== -1;
}

function canMergePlates(leftPlateId: number, rightPlateId: number, shelf: Shelf): [y: number, sku_id: number, rods: number[]] | undefined {
  const leftPlate = shelf.plates.get(leftPlateId);
  const rightPlate = shelf.plates.get(rightPlateId);

  if (!leftPlate || !rightPlate) {
    console.log('tryMergePlates: One or both plates not found');
    return undefined;
  }

  // Plates must be at same height
  if (leftPlate.y !== rightPlate.y) {
    console.log('tryMergePlates: Plates at different heights', leftPlate.y, rightPlate.y);
    return undefined;
  }

  // Get the SKUs
  const leftSKU = AVAILABLE_PLATES.find(p => p.sku_id === leftPlate.sku_id);
  const rightSKU = AVAILABLE_PLATES.find(p => p.sku_id === rightPlate.sku_id);

  if (!leftSKU || !rightSKU) {
    console.log('tryMergePlates: SKU not found');
    return undefined;
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
    return undefined;
  }

  // Combine rod connections (include all rods from both plates)
  const combinedRods = [...leftPlate.connections, ...rightPlate.connections];

  // Get all rod objects to calculate distances
  const rods = combinedRods.map(id => shelf.rods.get(id)).filter(r => r !== undefined);
  if (rods.length !== combinedRods.length) {
    console.log('tryMergePlates: Some rods not found');
    return undefined;
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
    return undefined;
  }

  console.log('tryMergePlates: Found matching SKU:', mergedSKU.name);

  // Perform the merge
  // Remove old plates
  // Add new merged plate
  // const mergedPlateId = addPlate(leftPlate.y, mergedSKU.sku_id, combinedRods, shelf);

  return [leftPlate.y, mergedSKU.sku_id, combinedRods];
}

export interface PlateConfig {
  sku_id: number;
  rodIds: number[];
  y: number;
}

export interface ExtensionInfo {
  newSKU_id: number;
  spanToAdd: number;
}

export type PlateAction = 'create' | 'extend' | 'merge';

export interface PlateSegmentResult {
  sku_id: number;
  rodIds: number[];
  y: number;
  action: PlateAction;
  existingPlateId?: number;
  requiresNewRod?: { x: number; y: number };
  requiresExtension?: Map<number, ExtensionInfo>;
}

function findPlateForGap(gapDistance: number): PlateSKU | undefined {
  return AVAILABLE_PLATES.find(p => p.spans.length === 3 && p.spans[1] === gapDistance);
}

function checkAttachmentExists(rodId: number, y: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) return false;
  const attachmentY = y - rod.position.y;
  return rod.attachmentPoints.some(ap => ap.y === attachmentY);
}

function getAttachmentPlateId(rodId: number, y: number, shelf: Shelf): number | undefined {
  const rod = shelf.rods.get(rodId);
  if (!rod) return undefined;
  const attachmentY = y - rod.position.y;
  const attachment = rod.attachmentPoints.find(ap => ap.y === attachmentY);
  return attachment?.plateId;
}

function findTargetRod(fromRodId: number, direction: 'left' | 'right', shelf: Shelf): number | undefined {
  const STANDARD_GAP = 600;
  const fromRod = shelf.rods.get(fromRodId);
  if (!fromRod) return undefined;

  const targetX = direction === 'left' ? fromRod.position.x - STANDARD_GAP : fromRod.position.x + STANDARD_GAP;

  let targetRodId: number | undefined = undefined;
  shelf.rods.forEach((rod, rodId) => {
    if (Math.abs(rod.position.x - targetX) < 1) {
      targetRodId = rodId;
    }
  });

  return targetRodId;
}

function calculateGapPlate(leftRodId: number, rightRodId: number, height: number, shelf: Shelf): PlateConfig | undefined {
  const leftRod = shelf.rods.get(leftRodId);
  const rightRod = shelf.rods.get(rightRodId);
  if (!leftRod || !rightRod) return undefined;

  const leftAttachmentY = height - leftRod.position.y;
  const rightAttachmentY = height - rightRod.position.y;
  const leftAttachment = leftRod.attachmentPoints.find(ap => ap.y === leftAttachmentY);
  const rightAttachment = rightRod.attachmentPoints.find(ap => ap.y === rightAttachmentY);

  if (!leftAttachment || !rightAttachment) return undefined;
  if (leftAttachment.plateId !== undefined || rightAttachment.plateId !== undefined) return undefined;

  const gapDistance = rightRod.position.x - leftRod.position.x;
  const plateSKU = findPlateForGap(gapDistance);
  if (!plateSKU) return undefined;

  return {
    sku_id: plateSKU.sku_id,
    rodIds: [leftRodId, rightRodId],
    y: height
  };
}

export function canAddPlateSegment(rodId: number, y: number, direction: 'left' | 'right', shelf: Shelf): PlateSegmentResult | undefined {
  const STANDARD_GAP = 600;
  const rod = shelf.rods.get(rodId);
  if (!rod) return undefined;

  if (!checkAttachmentExists(rodId, y, shelf)) return undefined;

  const sourcePlateId = getAttachmentPlateId(rodId, y, shelf);
  const targetRodId = findTargetRod(rodId, direction, shelf);

  if (targetRodId !== undefined) {
    const targetPlateId = getAttachmentPlateId(targetRodId, y, shelf);

    if (sourcePlateId !== undefined && targetPlateId !== undefined) {
      if (sourcePlateId === targetPlateId) {
        return undefined;
      }
      const leftRodId = direction === 'left' ? targetRodId : rodId;
      const rightRodId = direction === 'left' ? rodId : targetRodId;
      const leftRod = shelf.rods.get(leftRodId)!;
      const rightRod = shelf.rods.get(rightRodId)!;
      const gapDistance = rightRod.position.x - leftRod.position.x;
      const plateSKU = findPlateForGap(gapDistance);
      if (!plateSKU) return undefined;

      return {
        sku_id: plateSKU.sku_id,
        rodIds: [leftRodId, rightRodId],
        y: y,
        action: 'merge',
        existingPlateId: sourcePlateId
      };
    }

    if (sourcePlateId !== undefined && targetPlateId === undefined) {
      if (!checkAttachmentExists(targetRodId, y, shelf)) return undefined;

      const leftRodId = direction === 'left' ? targetRodId : rodId;
      const rightRodId = direction === 'left' ? rodId : targetRodId;
      const leftRod = shelf.rods.get(leftRodId)!;
      const rightRod = shelf.rods.get(rightRodId)!;
      const gapDistance = rightRod.position.x - leftRod.position.x;
      const plateSKU = findPlateForGap(gapDistance);
      if (!plateSKU) return undefined;

      return {
        sku_id: plateSKU.sku_id,
        rodIds: [leftRodId, rightRodId],
        y: y,
        action: 'extend',
        existingPlateId: sourcePlateId
      };
    }

    if (sourcePlateId === undefined && targetPlateId !== undefined) {
      if (!checkAttachmentExists(targetRodId, y, shelf)) return undefined;

      const leftRodId = direction === 'left' ? targetRodId : rodId;
      const rightRodId = direction === 'left' ? rodId : targetRodId;
      const leftRod = shelf.rods.get(leftRodId)!;
      const rightRod = shelf.rods.get(rightRodId)!;
      const gapDistance = rightRod.position.x - leftRod.position.x;
      const plateSKU = findPlateForGap(gapDistance);
      if (!plateSKU) return undefined;

      return {
        sku_id: plateSKU.sku_id,
        rodIds: [leftRodId, rightRodId],
        y: y,
        action: 'extend',
        existingPlateId: targetPlateId
      };
    }

    if (sourcePlateId === undefined && targetPlateId === undefined) {
      if (!checkAttachmentExists(targetRodId, y, shelf)) return undefined;

      const leftRodId = direction === 'left' ? targetRodId : rodId;
      const rightRodId = direction === 'left' ? rodId : targetRodId;
      const leftRod = shelf.rods.get(leftRodId)!;
      const rightRod = shelf.rods.get(rightRodId)!;
      const gapDistance = rightRod.position.x - leftRod.position.x;
      const plateSKU = findPlateForGap(gapDistance);
      if (!plateSKU) return undefined;

      return {
        sku_id: plateSKU.sku_id,
        rodIds: [leftRodId, rightRodId],
        y: y,
        action: 'create'
      };
    }
  }

  const targetX = direction === 'left' ? rod.position.x - STANDARD_GAP : rod.position.x + STANDARD_GAP;
  const plateSKU = findPlateForGap(STANDARD_GAP);
  if (!plateSKU) return undefined;

  if (sourcePlateId !== undefined) {
    return {
      sku_id: plateSKU.sku_id,
      rodIds: direction === 'left' ? [-1, rodId] : [rodId, -1],
      y: y,
      action: 'extend',
      existingPlateId: sourcePlateId,
      requiresNewRod: { x: targetX, y: y }
    };
  }

  return {
    sku_id: plateSKU.sku_id,
    rodIds: direction === 'left' ? [-1, rodId] : [rodId, -1],
    y: y,
    action: 'create',
    requiresNewRod: { x: targetX, y: y }
  };
}

export function canFillGapWithPlate(leftRodId: number, rightRodId: number, height: number, shelf: Shelf): PlateConfig | undefined {
  const leftRod = shelf.rods.get(leftRodId);
  const rightRod = shelf.rods.get(rightRodId);

  if (!leftRod || !rightRod) {
    return undefined;
  }

  const leftAttachmentY = height - leftRod.position.y;
  const rightAttachmentY = height - rightRod.position.y;

  const leftAttachment = leftRod.attachmentPoints.find(ap => ap.y === leftAttachmentY);
  const rightAttachment = rightRod.attachmentPoints.find(ap => ap.y === rightAttachmentY);

  if (!leftAttachment || !rightAttachment) {
    return undefined;
  }

  const leftPlateId = leftAttachment.plateId;
  const rightPlateId = rightAttachment.plateId;

  if (leftPlateId === undefined && rightPlateId === undefined) {
    const gapDistance = rightRod.position.x - leftRod.position.x;
    const plateSKU = AVAILABLE_PLATES.find(p => {
      return p.spans.length === 3 && p.spans[1] === gapDistance;
    });

    if (!plateSKU) return undefined;

    return {
      sku_id: plateSKU.sku_id,
      rodIds: [leftRodId, rightRodId],
      y: height
    };
  }

  return undefined;
}

export function tryFillGapWithPlate(leftRodId: number, rightRodId: number, height: number, shelf: Shelf): number {
  const leftRod = shelf.rods.get(leftRodId);
  const rightRod = shelf.rods.get(rightRodId);

  if (!leftRod || !rightRod) {
    console.log('tryFillGapWithPlate: Rod not found', { leftRodId, rightRodId });
    return -1;
  }

  const leftAttachmentY = height - leftRod.position.y;
  const rightAttachmentY = height - rightRod.position.y;

  console.log('tryFillGapWithPlate: Looking for attachments', {
    height,
    leftRodId,
    leftRodPosY: leftRod.position.y,
    leftAttachmentY,
    leftAttachments: leftRod.attachmentPoints.map(ap => ap.y),
    rightRodId,
    rightRodPosY: rightRod.position.y,
    rightAttachmentY,
    rightAttachments: rightRod.attachmentPoints.map(ap => ap.y)
  });

  const leftAttachment = leftRod.attachmentPoints.find(ap => ap.y === leftAttachmentY);
  const rightAttachment = rightRod.attachmentPoints.find(ap => ap.y === rightAttachmentY);

  if (!leftAttachment || !rightAttachment) {
    console.log('tryFillGapWithPlate: Missing attachment point', {
      leftAttachment: !!leftAttachment,
      rightAttachment: !!rightAttachment
    });
    return -1;
  }

  const leftPlateId = leftAttachment.plateId;
  const rightPlateId = rightAttachment.plateId;

  if (leftPlateId === undefined && rightPlateId === undefined) {
    const plateConfig = calculateGapPlate(leftRodId, rightRodId, height, shelf);
    if (!plateConfig) return -1;
    return addPlate(plateConfig.y, plateConfig.sku_id, plateConfig.rodIds, shelf);
  }

  if (leftPlateId !== undefined && rightPlateId === undefined) {
    const success = tryExtendPlate(leftPlateId, Direction.Right, shelf);
    return success ? leftPlateId : -1;
  }

  if (leftPlateId === undefined && rightPlateId !== undefined) {
    const success = tryExtendPlate(rightPlateId, Direction.Left, shelf);
    return success ? rightPlateId : -1;
  }

  if (leftPlateId !== undefined && rightPlateId !== undefined) {
    if (leftPlateId === rightPlateId) {
      return leftPlateId;
    }
    return tryMergePlates(leftPlateId, rightPlateId, shelf);
  }

  return -1;
}

export function calculateEdgeGapPlate(edgeRodId: number, y: number, direction: 'left' | 'right', shelf: Shelf): PlateConfig | undefined {
  const edgeRod = shelf.rods.get(edgeRodId);
  if (!edgeRod) return undefined;

  // Check if edge rod already has a plate at this height
  const edgeAttachmentY = y - edgeRod.position.y;
  const edgeAttachment = edgeRod.attachmentPoints.find(ap => ap.y === edgeAttachmentY);

  if (edgeAttachment && edgeAttachment.plateId !== undefined) {
    // Edge rod already has a plate - this should not create a new plate
    // The caller should handle extending the existing plate instead
    return undefined;
  }

  const STANDARD_GAP = 600;
  const newRodX = direction === 'left' ? edgeRod.position.x - STANDARD_GAP : edgeRod.position.x + STANDARD_GAP;

  let targetRodId: number | undefined = undefined;
  shelf.rods.forEach((rod, rodId) => {
    if (Math.abs(rod.position.x - newRodX) < 1) {
      targetRodId = rodId;
    }
  });

  if (targetRodId !== undefined) {
    const targetRod = shelf.rods.get(targetRodId)!;
    const attachmentY = y - targetRod.position.y;
    const hasAttachment = targetRod.attachmentPoints.some(ap => ap.y === attachmentY);

    if (hasAttachment) {
      const leftRodId = direction === 'left' ? targetRodId : edgeRodId;
      const rightRodId = direction === 'left' ? edgeRodId : targetRodId;
      return calculateGapPlate(leftRodId, rightRodId, y, shelf);
    }
  }

  const minimalRodSKU = AVAILABLE_RODS.find(r => r.name === "1P");
  if (!minimalRodSKU) return undefined;

  const gapDistance = STANDARD_GAP;
  const plateSKU = AVAILABLE_PLATES.find(p => {
    return p.spans.length === 3 && p.spans[1] === gapDistance;
  });

  if (!plateSKU) return undefined;

  return {
    sku_id: plateSKU.sku_id,
    rodIds: direction === 'left' ? [-1, edgeRodId] : [edgeRodId, -1],
    y: y
  };
}

export function tryFillEdgeGap(edgeRodId: number, y: number, direction: 'left' | 'right', shelf: Shelf): number {
  // First check if edge rod already has a plate at this height that needs to be extended
  const edgeRod = shelf.rods.get(edgeRodId);
  if (edgeRod) {
    const edgeAttachmentY = y - edgeRod.position.y;
    const edgeAttachment = edgeRod.attachmentPoints.find(ap => ap.y === edgeAttachmentY);

    if (edgeAttachment && edgeAttachment.plateId !== undefined) {
      // Edge rod has a plate - try to extend it
      console.log(`tryFillEdgeGap: Edge rod has existing plate ${edgeAttachment.plateId}, attempting to extend`);
      const plate = shelf.plates.get(edgeAttachment.plateId);
      if (!plate) return -1;

      const extendDir = direction === 'left' ? Direction.Left : Direction.Right;
      const success = tryExtendPlate(edgeAttachment.plateId, extendDir, shelf);

      if (success) {
        return edgeAttachment.plateId;
      }

      // Extension failed - check if we need to create a new rod at the edge
      // Get the current plate SKU to see if we've reached maximum size
      const currentSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
      if (!currentSKU) return -1;

      // Check if this is already the maximum plate size (1870mm = 4 spans + 2 padding)
      if (currentSKU.spans.length >= 6) {
        console.log('tryFillEdgeGap: Plate already at maximum size, cannot extend further');
        return -1;
      }

      // Create a new rod at standard distance and try again
      const STANDARD_GAP = 600;
      const newRodX = direction === 'left' ? edgeRod.position.x - STANDARD_GAP : edgeRod.position.x + STANDARD_GAP;

      // Check if there's already a rod at the target position with a plate
      let existingTargetRodId: number | undefined = undefined;
      shelf.rods.forEach((rod, rodId) => {
        if (Math.abs(rod.position.x - newRodX) < 1) {
          existingTargetRodId = rodId;
        }
      });

      if (existingTargetRodId !== undefined) {
        // Target rod exists - check if it has a plate at this height
        const targetRod = shelf.rods.get(existingTargetRodId)!;
        const targetAttachmentY = y - targetRod.position.y;
        const targetAttachment = targetRod.attachmentPoints.find(ap => ap.y === targetAttachmentY);

        if (targetAttachment && targetAttachment.plateId !== undefined) {
          // Target rod has a plate - try to merge plates
          console.log(`tryFillEdgeGap: Target rod ${existingTargetRodId} has plate ${targetAttachment.plateId}, attempting to merge`);
          const leftPlateId = direction === 'left' ? targetAttachment.plateId : edgeAttachment.plateId;
          const rightPlateId = direction === 'left' ? edgeAttachment.plateId : targetAttachment.plateId;

          const mergedPlateId = tryMergePlates(leftPlateId, rightPlateId, shelf);
          if (mergedPlateId !== -1) {
            console.log(`tryFillEdgeGap: Successfully merged plates into ${mergedPlateId}`);
            return mergedPlateId;
          }
          console.log('tryFillEdgeGap: Plate merge failed');
          return -1;
        }
      }

      console.log(`tryFillEdgeGap: Creating new rod at X=${newRodX} to extend plate`);

      const minimalRodSKU = AVAILABLE_RODS.find(r => r.name === "1P");
      if (!minimalRodSKU) return -1;

      const newRodId = addRod({ x: newRodX, y: y }, minimalRodSKU.sku_id, shelf);

      // Try extending again with the new rod
      const successAfterNewRod = tryExtendPlate(edgeAttachment.plateId, extendDir, shelf);

      if (successAfterNewRod) {
        mergeColocatedRods(newRodX, shelf);

        // After successfully extending, check if there's an adjacent plate to merge with
        const extendedPlate = shelf.plates.get(edgeAttachment.plateId);
        if (extendedPlate) {
          const extendedRightmostRodId = extendedPlate.connections[extendedPlate.connections.length - 1];
          const extendedLeftmostRodId = extendedPlate.connections[0];

          // Check for adjacent plate on the right
          if (direction === 'right') {
            const rightmostRod = shelf.rods.get(extendedRightmostRodId);
            if (rightmostRod) {
              const nextRodId = findClosestRod(shelf, rightmostRod, Direction.Right);
              if (nextRodId !== undefined) {
                const nextRod = shelf.rods.get(nextRodId);
                if (nextRod) {
                  const nextAttachmentY = y - nextRod.position.y;
                  const nextAttachment = nextRod.attachmentPoints.find(ap => ap.y === nextAttachmentY);
                  if (nextAttachment && nextAttachment.plateId !== undefined) {
                    console.log(`tryFillEdgeGap: Found adjacent plate ${nextAttachment.plateId} to merge with`);
                    const mergedPlateId = tryMergePlates(edgeAttachment.plateId, nextAttachment.plateId, shelf);
                    if (mergedPlateId !== -1) {
                      console.log(`tryFillEdgeGap: Successfully merged into ${mergedPlateId}`);
                      return mergedPlateId;
                    }
                  }
                }
              }
            }
          }

          // Check for adjacent plate on the left
          if (direction === 'left') {
            const leftmostRod = shelf.rods.get(extendedLeftmostRodId);
            if (leftmostRod) {
              const nextRodId = findClosestRod(shelf, leftmostRod, Direction.Left);
              if (nextRodId !== undefined) {
                const nextRod = shelf.rods.get(nextRodId);
                if (nextRod) {
                  const nextAttachmentY = y - nextRod.position.y;
                  const nextAttachment = nextRod.attachmentPoints.find(ap => ap.y === nextAttachmentY);
                  if (nextAttachment && nextAttachment.plateId !== undefined) {
                    console.log(`tryFillEdgeGap: Found adjacent plate ${nextAttachment.plateId} to merge with`);
                    const mergedPlateId = tryMergePlates(nextAttachment.plateId, edgeAttachment.plateId, shelf);
                    if (mergedPlateId !== -1) {
                      console.log(`tryFillEdgeGap: Successfully merged into ${mergedPlateId}`);
                      return mergedPlateId;
                    }
                  }
                }
              }
            }
          }
        }

        return edgeAttachment.plateId;
      } else {
        // Extension still failed, remove the rod we just created
        removeRod(newRodId, shelf);
        return -1;
      }
    }
  }

  const plateConfig = calculateEdgeGapPlate(edgeRodId, y, direction, shelf);
  if (!plateConfig) {
    console.log('tryFillEdgeGap: Cannot calculate edge gap plate');
    return -1;
  }

  const STANDARD_GAP = 600;
  if (!edgeRod) {
    console.log('tryFillEdgeGap: Edge rod not found');
    return -1;
  }

  const newRodX = direction === 'left' ? edgeRod.position.x - STANDARD_GAP : edgeRod.position.x + STANDARD_GAP;

  // Check if we need to create a new rod (indicated by -1 in rodIds)
  const needsNewRod = plateConfig.rodIds.includes(-1);

  if (needsNewRod) {
    console.log(`tryFillEdgeGap: Creating new rod at X=${newRodX}, Y=${y}, direction=${direction}`);

    // Check if rod already exists at target position
    let targetRodId: number | undefined = undefined;
    shelf.rods.forEach((rod, rodId) => {
      if (Math.abs(rod.position.x - newRodX) < 1) {
        targetRodId = rodId;
      }
    });

    if (targetRodId !== undefined) {
      // Rod exists - try to extend it if needed
      const targetRod = shelf.rods.get(targetRodId)!;
      const attachmentY = y - targetRod.position.y;
      const hasAttachment = targetRod.attachmentPoints.some(ap => ap.y === attachmentY);

      if (!hasAttachment) {
        console.log('tryFillEdgeGap: Rod exists but missing attachment at Y, extending rod');
        const success = extendRodToHeight(targetRodId, y, shelf);
        if (!success) {
          console.log('tryFillEdgeGap: Failed to extend existing rod');
          return -1;
        }
      }

      // Use existing/extended rod
      const leftRodId = direction === 'left' ? targetRodId : edgeRodId;
      const rightRodId = direction === 'left' ? edgeRodId : targetRodId;
      return tryFillGapWithPlate(leftRodId, rightRodId, y, shelf);
    }

    // Create new rod
    const minimalRodSKU = AVAILABLE_RODS.find(r => r.name === "1P");
    if (!minimalRodSKU) {
      console.log('tryFillEdgeGap: No minimal rod SKU found');
      return -1;
    }

    const newRodId = addRod({ x: newRodX, y: y }, minimalRodSKU.sku_id, shelf);

    // Replace -1 placeholder with actual rod ID
    const actualRodIds = plateConfig.rodIds.map(id => id === -1 ? newRodId : id);
    const plateId = addPlate(plateConfig.y, plateConfig.sku_id, actualRodIds, shelf);

    if (plateId === -1) {
      console.log('tryFillEdgeGap: Failed to add plate, removing new rod');
      removeRod(newRodId, shelf);
      return -1;
    }

    // Try to merge colocated rods
    mergeColocatedRods(newRodX, shelf);

    return plateId;
  }

  // No new rod needed - just add the plate
  return addPlate(plateConfig.y, plateConfig.sku_id, plateConfig.rodIds, shelf);
}

export function extendRodToHeight(rodId: number, targetY: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) return false;

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) return false;

  // Calculate current rod top and bottom in world space
  const attachmentPositions = calculateAttachmentPositions(rodSKU);
  const currentBottom = rod.position.y + attachmentPositions[0];
  const currentTop = rod.position.y + attachmentPositions[attachmentPositions.length - 1];

  console.log(`extendRodToHeight: Current rod Y range: ${currentBottom} to ${currentTop}, target: ${targetY}`);

  // Check if target is already covered
  if (targetY >= currentBottom && targetY <= currentTop) {
    // Check if there's an attachment point exactly at targetY
    const hasAttachment = attachmentPositions.some(pos => rod.position.y + pos === targetY);
    return hasAttachment; // Already has attachment at this height
  }

  // Determine if we need to extend up or down
  if (targetY > currentTop) {
    // Extend upward
    const gap = targetY - currentTop;
    console.log(`extendRodToHeight: Need to extend upward by ${gap}mm`);

    // Try 200mm span first, then 300mm
    for (const span of [200, 300]) {
      if (Math.abs(gap - span) < 1) {
        // Find SKU with additional span
        const newSKU = AVAILABLE_RODS.find(sku => {
          if (sku.spans.length !== rodSKU.spans.length + 1) return false;
          // Check if it's the same pattern plus one more span
          for (let i = 0; i < rodSKU.spans.length; i++) {
            if (sku.spans[i] !== rodSKU.spans[i]) return false;
          }
          return sku.spans[sku.spans.length - 1] === span;
        });

        if (newSKU) {
          rod.sku_id = newSKU.sku_id;
          // Add new attachment point
          const newRelativeY = attachmentPositions[attachmentPositions.length - 1] + span;
          rod.attachmentPoints.push({ y: newRelativeY });
          console.log(`extendRodToHeight: Extended upward with ${span}mm span to SKU ${newSKU.name}`);
          return true;
        }
      }
    }
  } else {
    // Extend downward
    const gap = currentBottom - targetY;
    console.log(`extendRodToHeight: Need to extend downward by ${gap}mm`);

    // Try 200mm span first, then 300mm
    for (const span of [200, 300]) {
      if (Math.abs(gap - span) < 1) {
        // Find SKU with additional span at beginning
        const newSKU = AVAILABLE_RODS.find(sku => {
          if (sku.spans.length !== rodSKU.spans.length + 1) return false;
          // Check if it's one more span at the start plus the same pattern
          if (sku.spans[0] !== span) return false;
          for (let i = 0; i < rodSKU.spans.length; i++) {
            if (sku.spans[i + 1] !== rodSKU.spans[i]) return false;
          }
          return true;
        });

        if (newSKU) {
          // Adjust rod position downward to keep top fixed
          rod.position.y -= span;
          rod.sku_id = newSKU.sku_id;

          // Rebuild attachment points
          const newAttachmentPositions = calculateAttachmentPositions(newSKU);
          rod.attachmentPoints = newAttachmentPositions.map(y => ({ y }));

          // Re-attach plates (Y positions unchanged, but indices shift)
          shelf.plates.forEach((plate, plateId) => {
            if (plate.connections.includes(rodId)) {
              const attachmentY = plate.y - rod.position.y;
              const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
              if (attachmentIndex !== -1) {
                rod.attachmentPoints[attachmentIndex].plateId = plateId;
              }
            }
          });

          console.log(`extendRodToHeight: Extended downward with ${span}mm span to SKU ${newSKU.name}`);
          return true;
        }
      }
    }
  }

  console.log('extendRodToHeight: No matching SKU found for extension');
  return false;
}

export function mergeColocatedRods(x: number, shelf: Shelf): void {
  // Find all rods at X position (within 1mm tolerance)
  const colocatedRods: Array<[number, Rod]> = [];
  shelf.rods.forEach((rod, rodId) => {
    if (Math.abs(rod.position.x - x) < 1) {
      colocatedRods.push([rodId, rod]);
    }
  });

  if (colocatedRods.length <= 1) {
    console.log('mergeColocatedRods: Only one rod at this position, no merge needed');
    return;
  }

  console.log(`mergeColocatedRods: Found ${colocatedRods.length} rods at X=${x}`);

  // Collect all attachment Y positions (world space) from all rods
  const allAttachmentYs = new Set<number>();
  colocatedRods.forEach(([rodId, rod]) => {
    rod.attachmentPoints.forEach(ap => {
      allAttachmentYs.add(rod.position.y + ap.y);
    });
  });

  const sortedYs = Array.from(allAttachmentYs).sort((a, b) => a - b);
  console.log('mergeColocatedRods: All attachment heights:', sortedYs);

  // Calculate spans between attachment points
  const spans: number[] = [];
  for (let i = 0; i < sortedYs.length - 1; i++) {
    spans.push(sortedYs[i + 1] - sortedYs[i]);
  }

  // Find SKU that matches this span pattern
  const matchingSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== spans.length) return false;
    return sku.spans.every((span, i) => span === spans[i]);
  });

  if (!matchingSKU) {
    console.log('mergeColocatedRods: No SKU found matching combined pattern, leaving rods separate');
    return;
  }

  console.log(`mergeColocatedRods: Found matching SKU: ${matchingSKU.name}`);

  // Create merged rod at the lowest Y position
  const mergedRodY = sortedYs[0];
  const mergedRodId = addRod({ x, y: mergedRodY }, matchingSKU.sku_id, shelf);

  // Update all plate connections from old rods to merged rod
  shelf.plates.forEach((plate, plateId) => {
    for (let i = 0; i < plate.connections.length; i++) {
      const connectedRodId = plate.connections[i];
      const isOldRod = colocatedRods.some(([id]) => id === connectedRodId);

      if (isOldRod) {
        console.log(`mergeColocatedRods: Updating plate ${plateId} connection from rod ${connectedRodId} to ${mergedRodId}`);
        plate.connections[i] = mergedRodId;

        // Update merged rod's attachment point
        const mergedRod = shelf.rods.get(mergedRodId)!;
        const attachmentY = plate.y - mergedRod.position.y;
        const attachmentIndex = mergedRod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
        if (attachmentIndex !== -1) {
          mergedRod.attachmentPoints[attachmentIndex].plateId = plateId;
        }
      }
    }
  });

  // Delete old rods
  colocatedRods.forEach(([rodId]) => {
    console.log(`mergeColocatedRods: Deleting old rod ${rodId}`);
    shelf.rods.delete(rodId);
  });

  console.log('mergeColocatedRods: Merge complete');
}

export function findNextExtensionUp(rodId: number, spanToAdd: number, shelf: Shelf): number | undefined {
  const rod = shelf.rods.get(rodId);
  if (!rod) return undefined;

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) return undefined;

  // Search for SKU where newSpans = [...oldSpans, spanToAdd]
  const newSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== rodSKU.spans.length + 1) return false;
    // Check if it's the same pattern plus one more span
    for (let i = 0; i < rodSKU.spans.length; i++) {
      if (sku.spans[i] !== rodSKU.spans[i]) return false;
    }
    return sku.spans[sku.spans.length - 1] === spanToAdd;
  });

  return newSKU?.sku_id;
}

export function findNextExtensionDown(rodId: number, spanToAdd: number, shelf: Shelf): number | undefined {
  const rod = shelf.rods.get(rodId);
  if (!rod) return undefined;

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) return undefined;

  // Search for SKU where newSpans = [spanToAdd, ...oldSpans]
  const newSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== rodSKU.spans.length + 1) return false;
    // Check if it's one more span at the start plus the same pattern
    if (sku.spans[0] !== spanToAdd) return false;
    for (let i = 0; i < rodSKU.spans.length; i++) {
      if (sku.spans[i + 1] !== rodSKU.spans[i]) return false;
    }
    return true;
  });

  return newSKU?.sku_id;
}

export function findCommonExtension(rodIds: number[], direction: 'up' | 'down', shelf: Shelf): Map<number, { newSKU_id: number, spanToAdd: number }> | undefined {
  // Try 200mm span first, then 300mm
  for (const span of [200, 300]) {
    const extensionMap = new Map<number, { newSKU_id: number, spanToAdd: number }>();
    let allRodsCanExtend = true;

    for (const rodId of rodIds) {
      const newSKU_id = direction === 'up'
        ? findNextExtensionUp(rodId, span, shelf)
        : findNextExtensionDown(rodId, span, shelf);

      if (newSKU_id === undefined) {
        allRodsCanExtend = false;
        break;
      }

      extensionMap.set(rodId, { newSKU_id, spanToAdd: span });
    }

    if (allRodsCanExtend) {
      console.log(`findCommonExtension: All rods can extend ${direction} with ${span}mm span`);
      return extensionMap;
    }
  }

  console.log(`findCommonExtension: No common extension found for ${direction}`);
  return undefined;
}

export function extendRodUp(rodId: number, newSKU_id: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) return false;

  const oldSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  const newSKU = AVAILABLE_RODS.find(r => r.sku_id === newSKU_id);

  if (!oldSKU || !newSKU) return false;

  // Validate: newSKU.spans = [...oldSKU.spans, additionalSpan]
  if (newSKU.spans.length !== oldSKU.spans.length + 1) return false;
  for (let i = 0; i < oldSKU.spans.length; i++) {
    if (newSKU.spans[i] !== oldSKU.spans[i]) return false;
  }

  const additionalSpan = newSKU.spans[newSKU.spans.length - 1];

  // Update rod SKU
  rod.sku_id = newSKU_id;

  // Calculate new attachment position
  const oldAttachmentPositions = calculateAttachmentPositions(oldSKU);
  const newRelativeY = oldAttachmentPositions[oldAttachmentPositions.length - 1] + additionalSpan;

  // Add new attachment point
  rod.attachmentPoints.push({ y: newRelativeY });

  console.log(`extendRodUp: Extended rod ${rodId} upward with ${additionalSpan}mm span to SKU ${newSKU.name}`);
  return true;
}

export function extendRodDown(rodId: number, newSKU_id: number, shelf: Shelf): boolean {
  const rod = shelf.rods.get(rodId);
  if (!rod) return false;

  const oldSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  const newSKU = AVAILABLE_RODS.find(r => r.sku_id === newSKU_id);

  if (!oldSKU || !newSKU) return false;

  // Validate: newSKU.spans = [additionalSpan, ...oldSKU.spans]
  if (newSKU.spans.length !== oldSKU.spans.length + 1) return false;
  const additionalSpan = newSKU.spans[0];
  for (let i = 0; i < oldSKU.spans.length; i++) {
    if (newSKU.spans[i + 1] !== oldSKU.spans[i]) return false;
  }

  // Adjust rod position downward to keep top fixed in world space
  rod.position.y -= additionalSpan;

  // Update rod SKU
  rod.sku_id = newSKU_id;

  // Rebuild entire attachment points array using new SKU
  const newAttachmentPositions = calculateAttachmentPositions(newSKU);
  rod.attachmentPoints = newAttachmentPositions.map(y => ({ y }));

  // Re-attach plates (Y positions unchanged in world space, but attachment indices shift)
  shelf.plates.forEach((plate, plateId) => {
    if (plate.connections.includes(rodId)) {
      const attachmentY = plate.y - rod.position.y; // Calculate relative Y
      const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
      if (attachmentIndex !== -1) {
        rod.attachmentPoints[attachmentIndex].plateId = plateId;
      }
    }
  });

  console.log(`extendRodDown: Extended rod ${rodId} downward with ${additionalSpan}mm span to SKU ${newSKU.name}`);
  return true;
}

export function calculateExtensionGapPlate(rodIds: number[], y: number, direction: 'up' | 'down', requiredExtensions: Map<number, { newSKU_id: number, spanToAdd: number }>, shelf: Shelf): PlateConfig | undefined {
  if (rodIds.length < 2) return undefined;

  // Sort rods by X position
  const sortedRodIds = [...rodIds].sort((a, b) => {
    const rodA = shelf.rods.get(a);
    const rodB = shelf.rods.get(b);
    if (!rodA || !rodB) return 0;
    return rodA.position.x - rodB.position.x;
  });

  // For now, only handle 2-rod case (single plate)
  if (sortedRodIds.length !== 2) return undefined;

  const leftRodId = sortedRodIds[0];
  const rightRodId = sortedRodIds[1];

  const leftRod = shelf.rods.get(leftRodId);
  const rightRod = shelf.rods.get(rightRodId);

  if (!leftRod || !rightRod) return undefined;

  // Verify that extensions are provided for both rods
  if (!requiredExtensions.has(leftRodId) || !requiredExtensions.has(rightRodId)) {
    return undefined;
  }

  const gapDistance = rightRod.position.x - leftRod.position.x;
  const plateSKU = AVAILABLE_PLATES.find(p => {
    return p.spans.length === 3 && p.spans[1] === gapDistance;
  });

  if (!plateSKU) return undefined;

  return {
    sku_id: plateSKU.sku_id,
    rodIds: sortedRodIds,
    y: y
  };
}

export function tryFillExtensionGap(rodIds: number[], y: number, direction: 'up' | 'down', requiredExtensions: Map<number, { newSKU_id: number, spanToAdd: number }>, shelf: Shelf): number {
  const plateConfig = calculateExtensionGapPlate(rodIds, y, direction, requiredExtensions, shelf);
  if (!plateConfig) {
    console.log('tryFillExtensionGap: Cannot calculate extension gap plate');
    return -1;
  }

  console.log(`tryFillExtensionGap: Extending ${rodIds.length} rods ${direction} to create plate at Y=${y}`);

  // Extend all rods first
  for (const rodId of rodIds) {
    const extension = requiredExtensions.get(rodId);
    if (!extension) {
      console.log(`tryFillExtensionGap: No extension info for rod ${rodId}`);
      return -1;
    }

    const success = direction === 'up'
      ? extendRodUp(rodId, extension.newSKU_id, shelf)
      : extendRodDown(rodId, extension.newSKU_id, shelf);

    if (!success) {
      console.log(`tryFillExtensionGap: Failed to extend rod ${rodId}`);
      // TODO: Implement rollback mechanism
      return -1;
    }
  }

  // Add the plate using the calculated config
  const plateId = addPlate(plateConfig.y, plateConfig.sku_id, plateConfig.rodIds, shelf);
  if (plateId !== -1) {
    console.log(`tryFillExtensionGap: Successfully created plate ${plateId}`);
  }
  return plateId;
}

function ghostPlateExists(ghostPlates: GhostPlate[], candidate: GhostPlate): boolean {
  // For legal ghost plates: check by connections + Y position
  if (candidate.legal && candidate.connections) {
    const sortedCandidateRods = [...candidate.connections].sort((a, b) => a - b);

    return ghostPlates.some(existing => {
      if (!existing.legal || !existing.connections) return false;
      if (existing.position.y !== candidate.position.y) return false;

      const sortedExistingRods = [...existing.connections].sort((a, b) => a - b);

      // Check if rod arrays are equal
      if (sortedExistingRods.length !== sortedCandidateRods.length) return false;
      return sortedExistingRods.every((id, i) => id === sortedCandidateRods[i]);
    });
  }

  // For illegal ghost plates: check by position (approximate X + Y)
  // Two illegal ghosts are the same if they're at roughly the same position
  return ghostPlates.some(existing => {
    if (existing.legal) return false;
    if (Math.abs(existing.position.y - candidate.position.y) > 1) return false;
    if (Math.abs(existing.position.x - candidate.position.x) > 1) return false;
    return true;
  });
}

export function regenerateGhostPlates(shelf: Shelf): void {

  shelf.ghostPlates.length = 0

  // Iterate through each rod
  for (let [rodId, rod] of shelf.rods) {

    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    if (!rodSKU) continue;

    // Iterate through each attachment point, looking for extensions left or right
    for (const ap of rod.attachmentPoints) {
      const y = rod.position.y + ap.y;
      const plate = ap.plateId ? shelf.plates.get(ap.plateId) : undefined;

      let hasLeftPlate = false;
      let hasRightPlate = false;

      for (const plateRodId of plate?.connections ?? []) {
        const plateRod = shelf.rods.get(plateRodId)
        if (!plateRod) { continue; }
        if (plateRod.position.x < rod.position.x) {
          hasLeftPlate = true;
        } else if (plateRod.position.x > rod.position.x) {
          hasRightPlate = true;
        }
      }

      if (!hasLeftPlate) {
        const result = canAddPlateSegment(rodId, y, "left", shelf);
        const candidate: GhostPlate = result ? {
          sku_id: result.sku_id,
          connections: result.rodIds,
          position: {
            x: result.requiresNewRod ? result.requiresNewRod.x : rod.position.x - 300,
            y: result.y
          },
          legal: true,
          direction: 'left'
        } : {
          position: { x: rod.position.x - 300, y: y },
          legal: false,
          direction: 'left'
        };

        if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
          shelf.ghostPlates.push(candidate);
        }
      }

      if (!hasRightPlate) {
        const result = canAddPlateSegment(rodId, y, "right", shelf);
        const candidate: GhostPlate = result ? {
          sku_id: result.sku_id,
          connections: result.rodIds,
          position: {
            x: result.requiresNewRod ? result.requiresNewRod.x : rod.position.x + 300,
            y: result.y
          },
          legal: true,
          direction: 'right'
        } : {
          position: { x: rod.position.x + 300, y: y },
          legal: false,
          direction: 'right'
        };

        if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
          shelf.ghostPlates.push(candidate);
        }
      }
    }

    // TODO: Look for extension opportunities up/down
  }
}