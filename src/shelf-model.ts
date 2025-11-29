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
export interface RodExtension {
  rodId: number;
  newSkuId: number;
}

// Rod creation plan - result of validation
export interface RodCreationPlan {
  action: 'create' | 'extend' | 'merge';
  position: Vec2f;
  // For 'create': sku for the new rod
  newSkuId?: number;
  // For 'extend': which rod to extend and what direction
  targetRodId?: number;
  direction?: 'up' | 'down';
  extendedSkuId?: number;
  // For 'merge': which rods to merge
  bottomRodId?: number;
  topRodId?: number;
  mergedSkuId?: number;
}

// Rod extension plan - result of validation
export interface RodExtensionPlan {
  rodId: number;
  direction: 'up' | 'down';
  newSkuId: number;
  addedSpan: number; // The span being added (200 or 300)
}

// Rod modification for ghost visualization
export interface RodModification {
  type: 'create' | 'extend' | 'merge';
  position: Vec2f;           // Where the rod is/will be
  newSkuId?: number;         // SKU for new rod or extended rod
  affectedRodIds?: number[]; // Rod(s) being modified
  visualHeight?: number;     // For extends: height of new segment only
  visualY?: number;          // For extends: Y position of new segment start
}

export interface GhostPlate {
  sku_id?: number; // ID to match with a PlateSKU
  connections?: number[]; // rodIds, attachmentIndex implicit by order (NO -1 placeholders after validation)
  midpointPosition: Vec2f; // Center position of the ghost plate segment
  legal: boolean;
  direction?: 'left' | 'right'; // For debugging: which direction was this ghost generated from
  action?: 'create' | 'extend' | 'merge' | 'extend_rod'; // What action to take when clicking this ghost
  existingPlateId?: number; // For extend/merge actions, which plate to modify
  targetPlateId?: number; // For merge actions, the second plate to merge with
  width?: number;
  newRodPosition?: Vec2f; // DEPRECATED - use rodModifications instead
  rodExtensions?: RodExtension[]; // DEPRECATED - use rodModifications instead
  extensionDirection?: 'up' | 'down'; // DEPRECATED - use rodModifications instead
  rodModifications?: RodModification[]; // All rod changes this ghost causes (validated, ready to apply)
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

export const DEFAULT_PLATE_SKU_ID: number = 1

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

function findClosestRod(shelf: Shelf, fromRodId: number, direction: Direction, yLevel: number): number | undefined {
  const fromRod = shelf.rods.get(fromRodId);
  if (!fromRod) return undefined;

  const rodEntries = Array.from(shelf.rods.entries())
    .filter(([rodId, rod]) => {
      if (rodId === fromRodId) return false;

      // Filter by direction
      const isInCorrectDirection = direction === Direction.Right ?
        rod.position.x > fromRod.position.x :
        rod.position.x < fromRod.position.x;
      if (!isInCorrectDirection) return false;

      // Filter by Y level - rod must have an attachment point at this level
      const topAttachmentY = rod.attachmentPoints.length > 0
        ? rod.position.y + rod.attachmentPoints[rod.attachmentPoints.length - 1].y
        : rod.position.y;
      if (rod.position.y > yLevel || topAttachmentY < yLevel) {
        return false; // Rod doesn't cross y level
      }

      // Check if attachment exists at this Y level
      return checkAttachmentExists(rodId, yLevel, shelf);
    })
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

/**
 * Validates whether a rod can be created/extended at the given position.
 * Returns a plan describing what action should be taken, or null if invalid.
 * This function performs NO mutations - it only validates and plans.
 */
export function validateRodCreation(position: Vec2f, shelf: Shelf): RodCreationPlan | null {
  const TOLERANCE = 1; // 1mm tolerance for floating point comparisons

  // Find all rods at the target X position
  const rodsAtX: Array<[number, Rod]> = [];
  for (const [rodId, rod] of shelf.rods) {
    if (Math.abs(rod.position.x - position.x) < TOLERANCE) {
      rodsAtX.push([rodId, rod]);
    }
  }

  // If no rods at this X, create a new minimal rod
  if (rodsAtX.length === 0) {
    return {
      action: 'create',
      position,
      newSkuId: 1 // 1P rod - single attachment point
    };
  }

  // Try to extend existing rods
  // Prefer upward extensions first, then downward
  const upwardCandidates: Array<[number, Rod]> = [];
  const downwardCandidates: Array<[number, Rod]> = [];

  for (const [rodId, rod] of rodsAtX) {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    if (!rodSKU) continue;

    // Check if attachment already exists at this position
    const relativeY = position.y - rod.position.y;
    const alreadyExists = rod.attachmentPoints.some(ap => Math.abs(ap.y - relativeY) < TOLERANCE);
    if (alreadyExists) {
      // Already has attachment - return a plan that won't do anything
      return {
        action: 'extend',
        position,
        targetRodId: rodId,
        direction: 'up',
        extendedSkuId: rod.sku_id // Same SKU, no actual change
      };
    }

    // Get current rod bounds
    const attachmentPositions = calculateAttachmentPositions(rodSKU);
    const absoluteTop = rod.position.y + attachmentPositions[attachmentPositions.length - 1];
    const absoluteBottom = rod.position.y + attachmentPositions[0];

    // Check if position overlaps with existing rod (illegal)
    if (position.y > absoluteBottom + TOLERANCE && position.y < absoluteTop - TOLERANCE) {
      continue; // Skip this rod - overlap is illegal
    }

    // Categorize as upward or downward extension candidate
    if (position.y > absoluteTop + TOLERANCE) {
      upwardCandidates.push([rodId, rod]);
    } else if (position.y < absoluteBottom - TOLERANCE) {
      downwardCandidates.push([rodId, rod]);
    }
  }

  // Try merging first
  for (const [bottomRodId, bottomRod] of upwardCandidates) {
    for (const [topRodId, topRod] of downwardCandidates) {
      const plan = validateMerge(bottomRodId, topRodId, position.y, shelf);
      if (plan !== null) {
        return plan;
      }
    }
  }

  // Then upward extensions
  for (const [rodId, rod] of upwardCandidates) {
    const plan = validateExtension(rodId, rod, position.y, 'up', shelf);
    if (plan !== null) {
      return plan;
    }
  }

  // Try downward extensions
  for (const [rodId, rod] of downwardCandidates) {
    const plan = validateExtension(rodId, rod, position.y, 'down', shelf);
    if (plan !== null) {
      return plan;
    }
  }

  // No valid extension found - create a new minimal rod
  return {
    action: 'create',
    position,
    newSkuId: 1 // 1P rod - single attachment point
  };
}

/**
 * Validates whether two rods can be merged with a new attachment point.
 * Returns a merge plan or null if not possible.
 */
function validateMerge(
  bottomRodId: number,
  topRodId: number,
  newAttachmentY: number,
  shelf: Shelf
): RodCreationPlan | null {
  const bottomRod = shelf.rods.get(bottomRodId);
  const topRod = shelf.rods.get(topRodId);
  if (bottomRod === undefined || topRod === undefined) {
    return null;
  }

  const TOLERANCE = 1;
  const bottomRodSKU = AVAILABLE_RODS.find(r => r.sku_id === bottomRod.sku_id);
  const topRodSKU = AVAILABLE_RODS.find(r => r.sku_id === topRod.sku_id);
  if (!bottomRodSKU || !topRodSKU) return null;

  // Get all existing attachment positions (absolute coordinates)
  const combinedAbsoluteYs = [
    ...bottomRod.attachmentPoints.map(ap => bottomRod.position.y + ap.y),
    newAttachmentY,
    ...topRod.attachmentPoints.map(ap => topRod.position.y + ap.y)
  ];

  // Calculate gaps between consecutive positions
  const gaps: number[] = [];
  for (let i = 0; i < combinedAbsoluteYs.length - 1; i++) {
    gaps.push(combinedAbsoluteYs[i + 1] - combinedAbsoluteYs[i]);
  }

  // Search for a matching SKU
  const matchingSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== gaps.length) return false;
    return sku.spans.every((span, i) => Math.abs(span - gaps[i]) < TOLERANCE);
  });

  if (!matchingSKU) return null;

  return {
    action: 'merge',
    position: { x: bottomRod.position.x, y: newAttachmentY },
    bottomRodId,
    topRodId,
    mergedSkuId: matchingSKU.sku_id
  };
}

/**
 * Validates whether a rod can be extended in the given direction.
 * Returns an extension plan or null if not possible.
 */
function validateExtension(
  rodId: number,
  rod: Rod,
  newY: number,
  direction: 'up' | 'down',
  shelf: Shelf
): RodCreationPlan | null {
  const TOLERANCE = 1;
  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) return null;

  // Get all existing attachment positions (absolute coordinates)
  const existingAbsoluteYs = rod.attachmentPoints.map(ap => rod.position.y + ap.y);

  // Add the new position
  const allPositions = [...existingAbsoluteYs, newY].sort((a, b) => a - b);

  // Calculate gaps between consecutive positions
  const gaps: number[] = [];
  for (let i = 0; i < allPositions.length - 1; i++) {
    gaps.push(allPositions[i + 1] - allPositions[i]);
  }

  // Search for a matching SKU
  const matchingSKU = AVAILABLE_RODS.find(sku => {
    if (sku.spans.length !== gaps.length) return false;
    return sku.spans.every((span, i) => Math.abs(span - gaps[i]) < TOLERANCE);
  });

  if (!matchingSKU) return null;

  return {
    action: 'extend',
    position: rod.position,
    targetRodId: rodId,
    direction,
    extendedSkuId: matchingSKU.sku_id
  };
}

/**
 * Applies a pre-validated rod creation plan to the shelf.
 * This function performs mutations but NO validation.
 * Returns the ID of the created/modified rod.
 */
export function applyRodCreation(plan: RodCreationPlan, shelf: Shelf): number {
  switch (plan.action) {
    case 'create':
      return addRod(plan.position, plan.newSkuId!, shelf);

    case 'extend':
      const success = plan.direction === 'up'
        ? extendRodUp(plan.targetRodId!, plan.extendedSkuId!, shelf)
        : extendRodDown(plan.targetRodId!, plan.extendedSkuId!, shelf);
      return success ? plan.targetRodId! : -1;

    case 'merge':
      return mergeRods(plan.bottomRodId!, plan.topRodId!, plan.mergedSkuId!, shelf);

    default:
      return -1;
  }
}

/**
 * Add a rod at the given position, or extend an existing rod if one is nearby.
 * This is a convenience function that combines validation and application.
 * For ghost plate generation, use validateRodCreation() instead.
 */
export function addOrExtendRod(position: Vec2f, shelf: Shelf): number {
  const plan = validateRodCreation(position, shelf);
  if (plan === null) {
    // Validation failed - create minimal rod as fallback
    return addRod(position, 1, shelf);
  }
  return applyRodCreation(plan, shelf);
}

// Merges two rods into a single rod with a new attachment point
// The bottom rod is kept and updated, the top rod is removed
// All plates from both rods are transferred to the merged rod
function mergeRods(
  bottomRodId: number,
  topRodId: number,
  newSkuId: number,
  shelf: Shelf
): number {
  const bottomRod = shelf.rods.get(bottomRodId);
  const topRod = shelf.rods.get(topRodId);
  if (!bottomRod || !topRod) return -1;

  const newSKU = AVAILABLE_RODS.find(r => r.sku_id === newSkuId);
  if (!newSKU) return -1;

  // Update the bottom rod with the new SKU
  bottomRod.sku_id = newSkuId;

  // Rebuild attachment points for the merged rod
  bottomRod.attachmentPoints = [];
  const positions = calculateAttachmentPositions(newSKU);
  for (const y of positions) {
    bottomRod.attachmentPoints.push({ y });
  }

  // Re-attach all plates that were connected to either rod
  shelf.plates.forEach((plate, plateId) => {
    if (plate.connections.includes(bottomRodId) || plate.connections.includes(topRodId)) {
      // Update plate connections - replace topRodId with bottomRodId
      plate.connections = plate.connections.map(rodId =>
        rodId === topRodId ? bottomRodId : rodId
      );

      // Re-attach plate to the merged rod at the correct attachment point
      const attachmentY = plate.y - bottomRod.position.y;
      const attachmentIndex = bottomRod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
      if (attachmentIndex !== -1) {
        bottomRod.attachmentPoints[attachmentIndex].plateId = plateId;
      }
    }
  });

  // Remove the top rod from the shelf
  shelf.rods.delete(topRodId);

  return bottomRodId;
}

// Resolve rod connections by replacing -1 placeholders with actual rod IDs
// Creates new rods as needed using addOrExtendRod
export function resolveRodConnections(
  connections: number[],
  newRodPosition: Vec2f | undefined,
  shelf: Shelf
): number[] {
  return connections.map((rodId: number) => {
    if (rodId === -1 && newRodPosition) {
      const newRodId = addOrExtendRod(newRodPosition, shelf);
      return newRodId;
    }
    return rodId;
  });
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

  // Track which rods need to be shortened after plate removal
  const rodsToShorten: { rodId: number; isTop: boolean }[] = [];

  // Remove plate connections from all connected rods
  for (const rodId of plate.connections) {
    const rod = shelf.rods.get(rodId);
    if (rod) {
      const attachmentIndex = findAttachmentPointByY(rod, plate.y - rod.position.y);
      if (attachmentIndex !== undefined) {
        const attachmentPoint = rod.attachmentPoints[attachmentIndex];
        if (attachmentPoint.plateId === plateId) {
          attachmentPoint.plateId = undefined;

          // Check if this was at the top or bottom of the rod
          const isTop = attachmentIndex === rod.attachmentPoints.length - 1;
          const isBottom = attachmentIndex === 0;

          if (isTop || isBottom) {
            rodsToShorten.push({ rodId, isTop });
          }
        } else {
          console.warn("Rod missing expected plate connection");
        }
      }
    }
  }

  // Remove the plate from the shelf
  shelf.plates.delete(plateId);

  // Now shorten rods that had plates at their ends
  for (const { rodId, isTop } of rodsToShorten) {
    shortenRodFromEnd(rodId, isTop, shelf);
  }

  return true;
}

// Shorten a rod by removing empty segments from the top or bottom
function shortenRodFromEnd(rodId: number, fromTop: boolean, shelf: Shelf): void {
  const rod = shelf.rods.get(rodId);
  if (!rod) return;

  const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!rodSKU) return;

  // Find the first/last attachment point with a plate
  let firstPlateIndex = -1;
  let lastPlateIndex = -1;

  for (let i = 0; i < rod.attachmentPoints.length; i++) {
    if (rod.attachmentPoints[i].plateId !== undefined) {
      if (firstPlateIndex === -1) firstPlateIndex = i;
      lastPlateIndex = i;
    }
  }

  // If no plates remain, don't shorten (rod will be removed if needed elsewhere)
  if (firstPlateIndex === -1) return;

  if (fromTop) {
    // Calculate segments to remove from top
    const segmentsToRemove = (rod.attachmentPoints.length - 1) - lastPlateIndex;
    if (segmentsToRemove <= 0) return;

    const newSpans = rodSKU.spans.slice(0, rodSKU.spans.length - segmentsToRemove);
    const newRodSKU = AVAILABLE_RODS.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newRodSKU) return;

    rod.sku_id = newRodSKU.sku_id;
    rod.attachmentPoints = [];
    const positions = calculateAttachmentPositions(newRodSKU);
    for (const y of positions) {
      rod.attachmentPoints.push({ y });
    }

    // Re-attach remaining plates
    shelf.plates.forEach((plate, pId) => {
      if (plate.connections.includes(rodId)) {
        const attachmentY = plate.y - rod.position.y;
        const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
        if (attachmentIndex !== -1) {
          rod.attachmentPoints[attachmentIndex].plateId = pId;
        }
      }
    });
  } else {
    // Calculate segments to remove from bottom
    const segmentsToRemove = firstPlateIndex;
    if (segmentsToRemove <= 0) return;

    const newSpans = rodSKU.spans.slice(segmentsToRemove);
    const newRodSKU = AVAILABLE_RODS.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, i) => span === newSpans[i]);
    });

    if (!newRodSKU) return;

    // Calculate Y adjustment
    const totalAdjustment = rodSKU.spans.slice(0, segmentsToRemove).reduce((sum, span) => sum + span, 0);
    rod.position.y += totalAdjustment;
    rod.sku_id = newRodSKU.sku_id;

    rod.attachmentPoints = [];
    const positions = calculateAttachmentPositions(newRodSKU);
    for (const y of positions) {
      rod.attachmentPoints.push({ y });
    }

    // Re-attach remaining plates
    shelf.plates.forEach((plate, pId) => {
      if (plate.connections.includes(rodId)) {
        const attachmentY = plate.y - rod.position.y;
        const attachmentIndex = rod.attachmentPoints.findIndex(ap => ap.y === attachmentY);
        if (attachmentIndex !== -1) {
          rod.attachmentPoints[attachmentIndex].plateId = pId;
        }
      }
    });
  }
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
    const rightmostRodId = plate.connections[plate.connections.length - 1];
    const rightmostRod = connectedRods[connectedRods.length - 1];
    const targetRodId = findClosestRod(shelf, rightmostRodId, Direction.Right, plate.y);
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
    const leftmostRodId = plate.connections[0];
    const leftmostRod = connectedRods[0];
    const targetRodId = findClosestRod(shelf, leftmostRodId, Direction.Left, plate.y);
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
  const targetAttachmentY = plate.y - targetRod.position.y; // Convert to relative Y
  const targetAttachmentIndex = findAttachmentPointByY(targetRod, targetAttachmentY);
  if (targetAttachmentIndex === undefined) {
    // TODO: Call to function to see if we can swap the rod with a different SKU without moving any other plates
    // And if we can, we should make sure to only change the rod SKU once we know the plate extension succeeds

    // For now we don't handle this case:
    return undefined;
  }

  const targetAttachmentPoint = targetRod.attachmentPoints[targetAttachmentIndex];
  if (targetAttachmentPoint.plateId !== undefined) {
    // TODO: Call to function that tries to merge the two plates
    return undefined; // Return undefined for now
  }

  // Find plate SKU that exactly matches the new span pattern
  const targetSKU = AVAILABLE_PLATES.find(sku => {
    if (sku.spans.length !== newSpans.length) return false;
    return sku.spans.every((span, index) => span === newSpans[index]);
  });
  if (!targetSKU) return undefined; // No plate available for this span pattern


  return [targetSKU.sku_id, newConnections];
}

export function extendPlate(plateId: number, newSkuId: number, newConnections: number[], shelf: Shelf) {
  const plate = shelf.plates.get(plateId);
  if (!plate) return undefined;

  plate.sku_id = newSkuId;
  plate.connections = newConnections;

  for (const rodId of newConnections) {
    const rod = shelf.rods.get(rodId)
    if (rod === undefined) {
      console.error("Unexpected invalid rod Id: ", rodId)
      return
    }

    const attachmentIndex = findAttachmentPointByY(rod, plate.y - rod.position.y)
    if (attachmentIndex === undefined) {
      console.error("Unexpected missing attachment for rod Id: ", rodId)
      return;
    }

    if (rod.attachmentPoints[attachmentIndex]) {
      rod.attachmentPoints[attachmentIndex].plateId = plateId;
    }

  }
}

// Apply a merge operation directly - assumes all parameters are valid
export function mergePlates(
  leftPlateId: number,
  rightPlateId: number,
  newSkuId: number,
  newConnections: number[],
  shelf: Shelf
): number {
  const leftPlate = shelf.plates.get(leftPlateId);
  if (!leftPlate) return -1;

  removePlate(rightPlateId, shelf);
  leftPlate.sku_id = newSkuId;
  leftPlate.connections = newConnections;

  for (const rodId of newConnections) {
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

// Check if two plates can be merged and return the merge parameters
export function canMergePlates(leftPlateId: number, rightPlateId: number, shelf: Shelf): { sku_id: number, connections: number[] } | undefined {
  const leftPlate = shelf.plates.get(leftPlateId);
  const rightPlate = shelf.plates.get(rightPlateId);

  if (!leftPlate || !rightPlate) return undefined;
  if (leftPlate.y !== rightPlate.y) return undefined;

  const leftSKU = AVAILABLE_PLATES.find(p => p.sku_id === leftPlate.sku_id);
  const rightSKU = AVAILABLE_PLATES.find(p => p.sku_id === rightPlate.sku_id);
  if (!leftSKU || !rightSKU) return undefined;

  const leftRightmostRodId = leftPlate.connections[leftPlate.connections.length - 1];
  const rightLeftmostRodId = rightPlate.connections[0];

  const leftRightmostRod = shelf.rods.get(leftRightmostRodId);
  const rightLeftmostRod = shelf.rods.get(rightLeftmostRodId);

  if (!leftRightmostRod || !rightLeftmostRod) return undefined;

  let combinedRods: number[];
  let mergedSpans: number[];

  if (leftRightmostRodId === rightLeftmostRodId) {
    combinedRods = [...leftPlate.connections, ...rightPlate.connections.slice(1)];
    mergedSpans = [
      ...leftSKU.spans.slice(0, -1),
      ...rightSKU.spans.slice(1)
    ];
  } else {
    combinedRods = [...leftPlate.connections, ...rightPlate.connections];
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

  if (!mergedSKU) return undefined;

  return { sku_id: mergedSKU.sku_id, connections: combinedRods };
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
    const removedRodId = plate.connections[0];
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

    // Update plate in-place (don't delete and recreate - that causes rod shortening issues)
    // First, clear the attachment point on the removed rod
    const removedRod = shelf.rods.get(removedRodId);
    if (removedRod) {
      const attachmentIndex = findAttachmentPointByY(removedRod, plate.y - removedRod.position.y);
      if (attachmentIndex !== undefined) {
        removedRod.attachmentPoints[attachmentIndex].plateId = undefined;
      }
      // Shorten the removed rod since it no longer has a plate at this end
      const isTop = attachmentIndex === removedRod.attachmentPoints.length - 1;
      const isBottom = attachmentIndex === 0;
      if (isTop || isBottom) {
        shortenRodFromEnd(removedRodId, isTop, shelf);
      }
    }

    // Update the plate with new SKU and connections
    plate.sku_id = newSKU.sku_id;
    plate.connections = newRods;

    console.log('removeSegmentFromPlate: Left edge removed, plate updated:', plateId);
    return true;
  }

  // Case B: Remove right edge segment
  if (segmentIndex === numSegments - 1) {
    console.log('removeSegmentFromPlate: Removing right edge segment');
    const removedRodId = plate.connections[plate.connections.length - 1];
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

    // Update plate in-place (don't delete and recreate - that causes rod shortening issues)
    // First, clear the attachment point on the removed rod
    const removedRod = shelf.rods.get(removedRodId);
    if (removedRod) {
      const attachmentIndex = findAttachmentPointByY(removedRod, plate.y - removedRod.position.y);
      if (attachmentIndex !== undefined) {
        removedRod.attachmentPoints[attachmentIndex].plateId = undefined;
      }
      // Shorten the removed rod since it no longer has a plate at this end
      const isTop = attachmentIndex === removedRod.attachmentPoints.length - 1;
      const isBottom = attachmentIndex === 0;
      if (isTop || isBottom) {
        shortenRodFromEnd(removedRodId, isTop, shelf);
      }
    }

    // Update the plate with new SKU and connections
    plate.sku_id = newSKU.sku_id;
    plate.connections = newRods;

    console.log('removeSegmentFromPlate: Right edge removed, plate updated:', plateId);
    return true;
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

  // Update the original plate to become the left plate (preserves plateId)
  // First, clear attachment points on rods that will move to the right plate
  for (const rodId of rightRods) {
    const rod = shelf.rods.get(rodId);
    if (rod) {
      const attachmentIndex = findAttachmentPointByY(rod, plate.y - rod.position.y);
      if (attachmentIndex !== undefined) {
        rod.attachmentPoints[attachmentIndex].plateId = undefined;
      }
    }
  }

  // Update the left plate in-place
  plate.sku_id = leftSKU.sku_id;
  plate.connections = leftRods;

  // Create a new plate for the right portion
  const rightPlateId = addPlate(plate.y, rightSKU.sku_id, rightRods, shelf);

  console.log('removeSegmentFromPlate: Split complete, left plate:', plateId, 'right plate:', rightPlateId);
  return rightPlateId !== -1;
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
  targetPlateId?: number; // For merge actions, the second plate to merge with
  requiresNewRod?: { x: number; y: number };
  requiresExtension?: Map<number, ExtensionInfo>;
  segmentWidth: number; // Width of the segment being added (distance between rods)
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

export function canAddPlateSegment(rodId: number, y: number, direction: Direction, shelf: Shelf): PlateSegmentResult | undefined {
  const STANDARD_GAP = 600;
  const rod = shelf.rods.get(rodId);
  if (!rod) return undefined;

  if (!checkAttachmentExists(rodId, y, shelf)) return undefined;

  const sourcePlateId = getAttachmentPlateId(rodId, y, shelf);
  const targetRodId = findClosestRod(shelf, rodId, direction, y);

  // Check if there's a rod at the other end
  if (targetRodId !== undefined) {

    // TODO: If the target rod can't be reached by a plate,
    // also consider if a fresh plate with a new rod can fit in between
    // e.g. if it's 10 meters to the next rod, we should just treat it a new plate

    // Is there a plate attached to the other rod?
    const targetPlateId = getAttachmentPlateId(targetRodId, y, shelf);


    // Check if there's a matching height attachment point
    if (!checkAttachmentExists(targetRodId, y, shelf)) return undefined;


    if (sourcePlateId !== undefined && sourcePlateId === targetPlateId) {
      // Segment is already covered
      return undefined;
    }

    const leftRodId = direction === 'left' ? targetRodId : rodId;
    const rightRodId = direction === 'left' ? rodId : targetRodId;
    const leftRod = shelf.rods.get(leftRodId)!;
    const rightRod = shelf.rods.get(rightRodId)!;
    const gapDistance = rightRod.position.x - leftRod.position.x;
    const plateSKU = findPlateForGap(gapDistance);
    if (!plateSKU) return undefined;


    if (sourcePlateId !== undefined && targetPlateId !== undefined) {
      // Plate on both ends - check if merge is possible
      const leftPlateId = direction === 'left' ? targetPlateId : sourcePlateId;
      const rightPlateId = direction === 'left' ? sourcePlateId : targetPlateId;
      const mergeParams = canMergePlates(leftPlateId, rightPlateId, shelf);
      if (!mergeParams) return undefined;

      return {
        sku_id: mergeParams.sku_id,
        rodIds: mergeParams.connections,
        y: y,
        action: 'merge',
        existingPlateId: leftPlateId,
        targetPlateId: rightPlateId,
        segmentWidth: gapDistance
      };
    }

    if (sourcePlateId !== undefined && targetPlateId === undefined) {
      const extendInfo = canExtendPlate(sourcePlateId, direction, shelf);
      if (!extendInfo) return undefined;
      const [sku_id, newConnections] = extendInfo;
      // Extend the plate that exist on current rod
      return {
        existingPlateId: sourcePlateId,
        sku_id: sku_id,
        rodIds: newConnections,
        y: y,
        action: 'extend',
        segmentWidth: gapDistance
      };
    }

    if (sourcePlateId === undefined && targetPlateId !== undefined) {
      // Extend plate that exists on target rod (opposite direction)
      const oppositeDirection = direction === 'left' ? Direction.Right : Direction.Left;
      const extendInfo = canExtendPlate(targetPlateId, oppositeDirection, shelf);
      if (!extendInfo) return undefined;
      const [sku_id, newConnections] = extendInfo;
      return {
        sku_id: sku_id,
        rodIds: newConnections,
        y: y,
        action: 'extend',
        existingPlateId: targetPlateId,
        segmentWidth: gapDistance
      };
    }

    if (sourcePlateId === undefined && targetPlateId === undefined) {
      // Create a new plate as both rods don't have a plate
      return {
        sku_id: plateSKU.sku_id,
        rodIds: [leftRodId, rightRodId],
        y: y,
        action: 'create',
        segmentWidth: gapDistance
      };
    }
  }


  // No rod on the other end (TODO: Or rod too far away)

  const defaultPlateSku = AVAILABLE_PLATES.find(p => p.sku_id === DEFAULT_PLATE_SKU_ID);;

  const defaultPlateGapWidth = defaultPlateSku?.spans[1]
  if (defaultPlateGapWidth === undefined || !defaultPlateSku) {
    console.error("Default plate ill defined!!! No gap")
    return undefined;
  }

  const targetX = direction === 'left'
    ? rod.position.x - defaultPlateGapWidth
    : rod.position.x + defaultPlateGapWidth

  if (sourcePlateId !== undefined) {
    // Get the existing plate's connections and add the new rod
    const existingPlate = shelf.plates.get(sourcePlateId);
    if (!existingPlate) return undefined;

    const existingSKU = AVAILABLE_PLATES.find(p => p.sku_id === existingPlate.sku_id);
    if (!existingSKU) return undefined;

    // Calculate new spans for the extended plate
    const newSpans: number[] = [];
    if (direction === 'left') {
      // Add new segment at the beginning
      newSpans.push(PLATE_PADDING_MM); // Start padding
      newSpans.push(defaultPlateGapWidth); // New gap
      newSpans.push(...existingSKU.spans.slice(1)); // Skip old start padding
    } else {
      // Add new segment at the end
      newSpans.push(...existingSKU.spans.slice(0, -1)); // Skip old end padding
      newSpans.push(defaultPlateGapWidth); // New gap
      newSpans.push(PLATE_PADDING_MM); // End padding
    }

    // Find plate SKU that matches the new span pattern
    const targetSKU = AVAILABLE_PLATES.find(sku => {
      if (sku.spans.length !== newSpans.length) return false;
      return sku.spans.every((span, index) => span === newSpans[index]);
    });
    if (!targetSKU) return undefined; // No plate available for this span pattern

    const newConnections = direction === 'left'
      ? [-1, ...existingPlate.connections]
      : [...existingPlate.connections, -1];

    return {
      sku_id: targetSKU.sku_id,
      rodIds: newConnections,
      y: y,
      action: 'extend',
      existingPlateId: sourcePlateId,
      requiresNewRod: { x: targetX, y: y },
      segmentWidth: defaultPlateGapWidth
    };
  }

  return {
    sku_id: defaultPlateSku.sku_id,
    rodIds: direction === 'left' ? [-1, rodId] : [rodId, -1],
    y: y,
    action: 'create',
    requiresNewRod: { x: targetX, y: y },
    segmentWidth: defaultPlateGapWidth
  };
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

/**
 * Validates whether a rod can be extended in the given direction.
 * Returns an extension plan or null if not possible.
 * This function performs NO mutations - it only validates and plans.
 */
export function validateRodExtension(
  rodId: number,
  direction: 'up' | 'down',
  shelf: Shelf
): RodExtensionPlan | null {
  const rod = shelf.rods.get(rodId);
  if (!rod) return null;

  const oldSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
  if (!oldSKU) return null;

  // Try 200mm span first, then 300mm
  for (const span of [200, 300]) {
    // Build expected spans for new SKU
    const expectedSpans = direction === 'up'
      ? [...oldSKU.spans, span]
      : [span, ...oldSKU.spans];

    // Find matching SKU
    const newSKU = AVAILABLE_RODS.find(sku => {
      if (sku.spans.length !== expectedSpans.length) return false;
      return sku.spans.every((s, i) => s === expectedSpans[i]);
    });

    if (newSKU) {
      return {
        rodId,
        direction,
        newSkuId: newSKU.sku_id,
        addedSpan: span
      };
    }
  }

  return null; // No valid extension found
}

/**
 * Applies a pre-validated rod extension plan to the shelf.
 * This function performs mutations but NO validation.
 * Returns true if successful, false otherwise.
 */
export function applyRodExtension(plan: RodExtensionPlan, shelf: Shelf): boolean {
  return plan.direction === 'up'
    ? extendRodUp(plan.rodId, plan.newSkuId, shelf)
    : extendRodDown(plan.rodId, plan.newSkuId, shelf);
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

function ghostPlateExists(ghostPlates: GhostPlate[], candidate: GhostPlate): boolean {
  // For legal ghost plates: check by connections + Y position
  // Note: Don't sort connections - order matters (left rod vs right rod)
  if (candidate.legal && candidate.connections) {
    return ghostPlates.some(existing => {
      if (!existing.legal || !existing.connections) return false;
      if (existing.midpointPosition.y !== candidate.midpointPosition.y) return false;

      // Check if rod arrays are equal (order matters)
      if (existing.connections.length !== candidate.connections!.length) return false;
      return existing.connections.every((id, i) => id === candidate.connections![i]);
    });
  }

  // For illegal ghost plates: check by position (approximate X + Y)
  // Two illegal ghosts are the same if they're at roughly the same position
  return ghostPlates.some(existing => {
    if (existing.legal) return false;
    if (Math.abs(existing.midpointPosition.y - candidate.midpointPosition.y) > 1) return false;
    if (Math.abs(existing.midpointPosition.x - candidate.midpointPosition.x) > 1) return false;
    return true;
  });
}

/**
 * Converts PlateSegmentResult into validated rod modifications and resolves rod IDs.
 * Returns updated connections array (no -1 placeholders) and rodModifications array.
 */
function validateAndPrepareRodModifications(
  result: PlateSegmentResult,
  shelf: Shelf
): { connections: number[], rodModifications: RodModification[] } | null {
  const rodModifications: RodModification[] = [];
  const connections: number[] = [];

  // Process requiresNewRod
  if (result.requiresNewRod) {
    const plan = validateRodCreation(result.requiresNewRod, shelf);
    if (!plan) return null; // Cannot create rod - ghost is invalid

    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === plan.newSkuId!);
    if (!rodSKU) return null;

    rodModifications.push({
      type: plan.action,
      position: result.requiresNewRod,
      newSkuId: plan.newSkuId,
      affectedRodIds: plan.action === 'merge'
        ? [plan.bottomRodId!, plan.topRodId!]
        : plan.action === 'extend'
        ? [plan.targetRodId!]
        : []
    });

    // Determine the rod ID that will exist after applying the plan
    const resultingRodId = plan.action === 'create'
      ? shelf.metadata.nextId // New rod will get this ID
      : plan.action === 'merge'
      ? plan.bottomRodId! // Merge keeps bottom rod
      : plan.targetRodId!; // Extend keeps the rod

    // Replace -1 with the resulting rod ID
    connections.push(...result.rodIds.map(id => id === -1 ? resultingRodId : id));
  } else {
    // No new rod needed
    connections.push(...result.rodIds);
  }

  // Process requiresExtension
  if (result.requiresExtension) {
    for (const [rodId, extensionInfo] of result.requiresExtension) {
      const rod = shelf.rods.get(rodId);
      if (!rod) return null;

      // Determine direction from the extensionInfo
      // This is a bit tricky - we need to figure out if it's extending up or down
      // For now, let's try both and see which one matches
      const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
      if (!rodSKU) return null;

      const newSKU = AVAILABLE_RODS.find(r => r.sku_id === extensionInfo.newSKU_id);
      if (!newSKU) return null;

      // Determine direction by comparing SKU spans
      let direction: 'up' | 'down';
      if (newSKU.spans.length === rodSKU.spans.length + 1) {
        // Check if new span is at the end (up) or beginning (down)
        const spansMatch = rodSKU.spans.every((span, i) => {
          // Check if it matches upward extension pattern
          return newSKU.spans[i] === span;
        });
        direction = spansMatch ? 'up' : 'down';
      } else {
        return null; // Invalid extension
      }

      // Calculate visual properties for the extension
      const attachmentPositions = calculateAttachmentPositions(rodSKU);
      const newAttachmentPositions = calculateAttachmentPositions(newSKU);

      const visualHeight = extensionInfo.spanToAdd;
      const visualY = direction === 'up'
        ? rod.position.y + attachmentPositions[attachmentPositions.length - 1]
        : rod.position.y - extensionInfo.spanToAdd;

      rodModifications.push({
        type: 'extend',
        position: rod.position,
        newSkuId: extensionInfo.newSKU_id,
        affectedRodIds: [rodId],
        visualHeight,
        visualY
      });
    }
  }

  return { connections, rodModifications };
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
        const result = canAddPlateSegment(rodId, y, Direction.Left, shelf);
        let candidate: GhostPlate;

        if (result) {
          // Validate and prepare rod modifications
          const validated = validateAndPrepareRodModifications(result, shelf);

          if (validated) {
            const segmentWidth = result.segmentWidth;
            candidate = {
              sku_id: result.sku_id,
              connections: validated.connections, // Resolved rod IDs (no -1)
              midpointPosition: {
                x: rod.position.x - segmentWidth / 2,
                y: result.y
              },
              legal: true,
              direction: 'left',
              action: result.action,
              existingPlateId: result.existingPlateId,
              targetPlateId: result.targetPlateId,
              width: segmentWidth,
              rodModifications: validated.rodModifications.length > 0 ? validated.rodModifications : undefined
            };
          } else {
            // Validation failed - mark as illegal
            const defaultWidth = 600;
            candidate = {
              midpointPosition: { x: rod.position.x - defaultWidth / 2, y: y },
              legal: false,
              direction: 'left',
              width: defaultWidth
            };
          }
        } else {
          const defaultWidth = 600;
          candidate = {
            midpointPosition: { x: rod.position.x - defaultWidth / 2, y: y },
            legal: false,
            direction: 'left',
            width: defaultWidth
          };
        }

        if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
          shelf.ghostPlates.push(candidate);
        }
      }

      if (!hasRightPlate) {
        const result = canAddPlateSegment(rodId, y, Direction.Right, shelf);
        let candidate: GhostPlate;

        if (result) {
          // Validate and prepare rod modifications
          const validated = validateAndPrepareRodModifications(result, shelf);

          if (validated) {
            const segmentWidth = result.segmentWidth;
            candidate = {
              sku_id: result.sku_id,
              connections: validated.connections, // Resolved rod IDs (no -1)
              midpointPosition: {
                x: rod.position.x + segmentWidth / 2,
                y: result.y
              },
              legal: true,
              direction: 'right',
              action: result.action,
              existingPlateId: result.existingPlateId,
              targetPlateId: result.targetPlateId,
              width: segmentWidth,
              rodModifications: validated.rodModifications.length > 0 ? validated.rodModifications : undefined
            };
          } else {
            // Validation failed - mark as illegal
            const defaultWidth = 600;
            candidate = {
              midpointPosition: { x: rod.position.x + defaultWidth / 2, y: y },
              legal: false,
              direction: 'right',
              width: defaultWidth
            };
          }
        } else {
          const defaultWidth = 600;
          candidate = {
            midpointPosition: { x: rod.position.x + defaultWidth / 2, y: y },
            legal: false,
            direction: 'right',
            width: defaultWidth
          };
        }

        if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
          shelf.ghostPlates.push(candidate);
        }
      }
    }

    // Check for rod extension opportunities (above/below current rod)
    // Only check for the rod to the right to avoid duplicates
    const STANDARD_GAP = 600;
    const defaultPlateSku = AVAILABLE_PLATES.find(p => p.sku_id === DEFAULT_PLATE_SKU_ID);
    if (!defaultPlateSku) continue;

    // Find adjacent rod to the right at standard gap
    let rightRodId: number | undefined;
    let rightRod: Rod | undefined;
    for (const [candidateId, candidateRod] of shelf.rods) {
      if (candidateRod.position.x === rod.position.x + STANDARD_GAP) {
        rightRodId = candidateId;
        rightRod = candidateRod;
        break;
      }
    }

    if (rightRodId === undefined || rightRod === undefined) continue;

    // Calculate top and bottom Y levels for both rods
    const leftTopY = rod.position.y + (rod.attachmentPoints.length > 0
      ? rod.attachmentPoints[rod.attachmentPoints.length - 1].y
      : 0);
    const rightTopY = rightRod.position.y + (rightRod.attachmentPoints.length > 0
      ? rightRod.attachmentPoints[rightRod.attachmentPoints.length - 1].y
      : 0);
    const shelfTopY = Math.min(leftTopY, rightTopY);

    const leftBottomY = rod.position.y;
    const rightBottomY = rightRod.position.y;
    const shelfBottomY = Math.max(leftBottomY, rightBottomY);

    const upExtension = findCommonExtension([rodId, rightRodId], 'up', shelf);
    if (upExtension) {
      const spanToAdd = upExtension.get(rodId)!.spanToAdd;
      const newY = shelfTopY + spanToAdd;
      const centerX = (rod.position.x + rightRod.position.x) / 2;

      const rodModifications: RodModification[] = [];
      for (const [extRodId, ext] of upExtension.entries()) {
        const extRod = shelf.rods.get(extRodId);
        if (!extRod) continue;

        const extRodSKU = AVAILABLE_RODS.find(r => r.sku_id === extRod.sku_id);
        if (!extRodSKU) continue;

        const attachmentPositions = calculateAttachmentPositions(extRodSKU);
        const visualHeight = ext.spanToAdd;
        const visualY = extRod.position.y + attachmentPositions[attachmentPositions.length - 1];

        rodModifications.push({
          type: 'extend',
          position: extRod.position,
          newSkuId: ext.newSKU_id,
          affectedRodIds: [extRodId],
          visualHeight,
          visualY
        });
      }

      const candidate: GhostPlate = {
        sku_id: defaultPlateSku.sku_id,
        connections: [rodId, rightRodId],
        midpointPosition: { x: centerX, y: newY },
        legal: true,
        action: 'extend_rod',
        width: STANDARD_GAP,
        rodModifications
      };

      if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
        shelf.ghostPlates.push(candidate);
      }
    }

    // Check downward extension
    const downExtension = findCommonExtension([rodId, rightRodId], 'down', shelf);
    if (downExtension) {
      const spanToAdd = downExtension.get(rodId)!.spanToAdd;
      const newY = shelfBottomY - spanToAdd;
      const centerX = (rod.position.x + rightRod.position.x) / 2;

      const rodModifications: RodModification[] = [];
      for (const [extRodId, ext] of downExtension.entries()) {
        const extRod = shelf.rods.get(extRodId);
        if (!extRod) continue;

        const visualHeight = ext.spanToAdd;
        const visualY = extRod.position.y - ext.spanToAdd;

        rodModifications.push({
          type: 'extend',
          position: extRod.position,
          newSkuId: ext.newSKU_id,
          affectedRodIds: [extRodId],
          visualHeight,
          visualY
        });
      }

      const candidate: GhostPlate = {
        sku_id: defaultPlateSku.sku_id,
        connections: [rodId, rightRodId],
        midpointPosition: { x: centerX, y: newY },
        legal: true,
        action: 'extend_rod',
        width: STANDARD_GAP,
        rodModifications
      };

      if (!ghostPlateExists(shelf.ghostPlates, candidate)) {
        shelf.ghostPlates.push(candidate);
      }
    }

  }
}