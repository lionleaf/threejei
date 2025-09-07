export interface RodPattern {
  id: string;
  attachmentPoints: number;
  gaps: number[];
}

export interface PlateSpec {
  length: number;
  spans: number;
  description: string;
}

export interface Bounds {
  x: number;
  y: [number, number];
  width: number;
}

export interface PlateBounds {
  x: [number, number];
  y: number;
  width: number;
  height: number;
}

export interface AttachmentPoint {
  y: number;
  plateId?: string;
}

export interface RodData {
  pattern: string;
  position: { x: number; z: number };
  attachmentPoints: AttachmentPoint[];
  bounds: Bounds;
}

export interface PlateData {
  size: number;
  connections: [rodId: string, attachmentIndex: number][];
  bounds: PlateBounds;
}

export interface SpatialIndex {
  rodColumns: Map<number, string[]>;
  plateLevels: Map<number, string[]>;
}

export interface InteractiveShelf {
  rods: Map<string, RodData>;
  plates: Map<string, PlateData>;
  spatialIndex: SpatialIndex;
  metadata: {
    totalWidth: number;
    totalHeight: number;
    nextId: number;
  };
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface SelectionResult {
  type: 'rod' | 'plate';
  id: string;
  attachmentIndex?: number;
}

export const AVAILABLE_ROD_PATTERNS: RodPattern[] = [
  { id: "1P", attachmentPoints: 1, gaps: [] },
  { id: "2P_2", attachmentPoints: 2, gaps: [20] },
  { id: "2P_3", attachmentPoints: 2, gaps: [30] },
  { id: "3P_22", attachmentPoints: 3, gaps: [20, 20] },
  { id: "3P_23", attachmentPoints: 3, gaps: [20, 30] },
  { id: "3P_32", attachmentPoints: 3, gaps: [30, 20] },
  { id: "4P_223", attachmentPoints: 4, gaps: [20, 20, 30] },
  { id: "4P_232", attachmentPoints: 4, gaps: [20, 30, 20] },
  { id: "4P_322", attachmentPoints: 4, gaps: [30, 20, 20] },
  { id: "5P_2232", attachmentPoints: 5, gaps: [20, 20, 30, 20] },
  { id: "5P_2322", attachmentPoints: 5, gaps: [20, 30, 20, 20] },
  { id: "5P_3223", attachmentPoints: 5, gaps: [30, 20, 20, 30] },
  { id: "6P_22322", attachmentPoints: 6, gaps: [20, 20, 30, 20, 20] },
  { id: "6P_32232", attachmentPoints: 6, gaps: [30, 20, 20, 30, 20] },
  { id: "7P_322322", attachmentPoints: 7, gaps: [30, 20, 20, 30, 20, 20] }
];

export const AVAILABLE_PLATE_SPECS: PlateSpec[] = [
  { 
    length: 670, 
    spans: 1, 
    description: "35mm + 600mm + 35mm" 
  },
  { 
    length: 1270, 
    spans: 2, 
    description: "35mm + 600mm + 70mm + 600mm + 35mm" 
  },
  { 
    length: 1870, 
    spans: 3, 
    description: "35mm + 600mm + 70mm + 600mm + 70mm + 600mm + 35mm" 
  }
];

export const CONSTANTS = {
  ROD_HORIZONTAL_SPACING: 600,
  PLATE_EFFECTIVE_SPAN: 600,
  PLATE_END_PADDING: 35,
  PLATE_MID_PADDING: 70
} as const;

export function calculateRodHeight(pattern: RodPattern): number {
  return pattern.gaps.reduce((sum, gap) => sum + gap, 0);
}

export function calculateAttachmentPositions(pattern: RodPattern): number[] {
  const positions = [0];
  let currentPosition = 0;
  
  for (const gap of pattern.gaps) {
    currentPosition += gap;
    positions.push(currentPosition);
  }
  
  return positions;
}

export function calculateRodBounds(rod: RodData): Bounds {
  const minY = 0;
  const maxY = rod.attachmentPoints.length > 0 
    ? Math.max(...rod.attachmentPoints.map(p => p.y))
    : 0;
  
  return {
    x: rod.position.x,
    y: [minY, maxY],
    width: 20
  };
}

export function calculatePlateBounds(plate: PlateData, rods: Map<string, RodData>): PlateBounds {
  if (plate.connections.length < 2) {
    throw new Error("Plate must have at least 2 connections");
  }
  
  const startConnection = plate.connections[0];
  const endConnection = plate.connections[plate.connections.length - 1];
  
  const startRod = rods.get(startConnection[0]);
  const endRod = rods.get(endConnection[0]);
  
  if (!startRod || !endRod) {
    throw new Error("Connected rods not found");
  }
  
  const startPoint = startRod.attachmentPoints[startConnection[1]];
  const endPoint = endRod.attachmentPoints[endConnection[1]];
  
  return {
    x: [Math.min(startRod.position.x, endRod.position.x), Math.max(startRod.position.x, endRod.position.x)],
    y: startPoint.y,
    width: Math.abs(endRod.position.x - startRod.position.x),
    height: 20
  };
}

export function isPointInBounds(cursor: CursorPosition, bounds: Bounds | PlateBounds): boolean {
  if ('y' in bounds && Array.isArray(bounds.y)) {
    const rodBounds = bounds as Bounds;
    return Math.abs(cursor.x - rodBounds.x) < rodBounds.width / 2 &&
           cursor.y >= rodBounds.y[0] && cursor.y <= rodBounds.y[1];
  } else {
    const plateBounds = bounds as PlateBounds;
    return cursor.x >= plateBounds.x[0] && cursor.x <= plateBounds.x[1] &&
           Math.abs(cursor.y - plateBounds.y) < plateBounds.height / 2;
  }
}

export function findElementAtCursor(cursor: CursorPosition, shelf: InteractiveShelf): SelectionResult | null {
  const tolerance = 30;
  
  for (const [plateId, plate] of shelf.plates) {
    if (isPointInBounds(cursor, plate.bounds)) {
      return { type: 'plate', id: plateId };
    }
  }
  
  for (const [rodId, rod] of shelf.rods) {
    if (isPointInBounds(cursor, rod.bounds)) {
      const closestAttachmentIndex = findClosestAttachment(cursor.y, rod.attachmentPoints);
      return { type: 'rod', id: rodId, attachmentIndex: closestAttachmentIndex };
    }
  }
  
  return null;
}

function findClosestAttachment(cursorY: number, attachmentPoints: AttachmentPoint[]): number {
  let closestIndex = 0;
  let minDistance = Math.abs(cursorY - attachmentPoints[0].y);
  
  for (let i = 1; i < attachmentPoints.length; i++) {
    const distance = Math.abs(cursorY - attachmentPoints[i].y);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

export function updateRodPattern(rodId: string, newPattern: string, shelf: InteractiveShelf): void {
  const rod = shelf.rods.get(rodId);
  if (!rod) return;
  
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === newPattern);
  if (!pattern) return;
  
  const oldAttachments = rod.attachmentPoints;
  rod.pattern = newPattern;
  rod.attachmentPoints = calculateAttachmentPositions(pattern).map(y => ({ y, plateId: undefined }));
  rod.bounds = calculateRodBounds(rod);
  
  const affectedPlates: string[] = [];
  for (const [plateId, plate] of shelf.plates) {
    const hasConnection = plate.connections.some(([id]) => id === rodId);
    if (hasConnection) {
      affectedPlates.push(plateId);
    }
  }
  
  affectedPlates.forEach(plateId => {
    const plate = shelf.plates.get(plateId)!;
    try {
      plate.bounds = calculatePlateBounds(plate, shelf.rods);
    } catch {
      shelf.plates.delete(plateId);
    }
  });
  
  updateSpatialIndex(shelf);
}

export function addRod(position: { x: number; z: number }, pattern: string, shelf: InteractiveShelf): string {
  const rodId = `rod-${shelf.metadata.nextId++}`;
  const rodPattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === pattern);
  
  if (!rodPattern) throw new Error(`Invalid rod pattern: ${pattern}`);
  
  const attachmentPoints = calculateAttachmentPositions(rodPattern).map(y => ({ y, plateId: undefined }));
  const rodData: RodData = {
    pattern,
    position,
    attachmentPoints,
    bounds: { x: position.x, y: [0, 0], width: 20 }
  };
  
  rodData.bounds = calculateRodBounds(rodData);
  shelf.rods.set(rodId, rodData);
  updateSpatialIndex(shelf);
  
  return rodId;
}

export function addPlate(startRodId: string, endRodId: string, attachmentLevel: number, plateSize: number, shelf: InteractiveShelf): string | null {
  const startRod = shelf.rods.get(startRodId);
  const endRod = shelf.rods.get(endRodId);
  
  if (!startRod || !endRod) return null;
  
  const startAttachmentIndex = startRod.attachmentPoints.findIndex(p => p.y === attachmentLevel);
  const endAttachmentIndex = endRod.attachmentPoints.findIndex(p => p.y === attachmentLevel);
  
  if (startAttachmentIndex === -1 || endAttachmentIndex === -1) return null;
  
  const plateId = `plate-${shelf.metadata.nextId++}`;
  
  const plateData: PlateData = {
    size: plateSize,
    connections: [
      [startRodId, startAttachmentIndex],
      [endRodId, endAttachmentIndex]
    ],
    bounds: { x: [0, 0], y: 0, width: 0, height: 20 }
  };
  
  try {
    plateData.bounds = calculatePlateBounds(plateData, shelf.rods);
  } catch {
    return null;
  }
  
  startRod.attachmentPoints[startAttachmentIndex].plateId = plateId;
  endRod.attachmentPoints[endAttachmentIndex].plateId = plateId;
  
  shelf.plates.set(plateId, plateData);
  updateSpatialIndex(shelf);
  
  return plateId;
}

function updateSpatialIndex(shelf: InteractiveShelf): void {
  shelf.spatialIndex.rodColumns.clear();
  shelf.spatialIndex.plateLevels.clear();
  
  for (const [rodId, rod] of shelf.rods) {
    const x = Math.round(rod.position.x / CONSTANTS.ROD_HORIZONTAL_SPACING) * CONSTANTS.ROD_HORIZONTAL_SPACING;
    if (!shelf.spatialIndex.rodColumns.has(x)) {
      shelf.spatialIndex.rodColumns.set(x, []);
    }
    shelf.spatialIndex.rodColumns.get(x)!.push(rodId);
  }
  
  for (const [plateId, plate] of shelf.plates) {
    const y = Math.round(plate.bounds.y / 10) * 10;
    if (!shelf.spatialIndex.plateLevels.has(y)) {
      shelf.spatialIndex.plateLevels.set(y, []);
    }
    shelf.spatialIndex.plateLevels.get(y)!.push(plateId);
  }
}

export function createEmptyShelf(): InteractiveShelf {
  return {
    rods: new Map(),
    plates: new Map(),
    spatialIndex: {
      rodColumns: new Map(),
      plateLevels: new Map()
    },
    metadata: {
      totalWidth: 0,
      totalHeight: 0,
      nextId: 1
    }
  };
}