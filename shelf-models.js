const AVAILABLE_ROD_PATTERNS = [
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

const AVAILABLE_PLATE_SPECS = [
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

const CONSTANTS = {
  ROD_HORIZONTAL_SPACING: 600,
  PLATE_EFFECTIVE_SPAN: 600,
  PLATE_END_PADDING: 35,
  PLATE_MID_PADDING: 70
};

function calculateRodHeight(pattern) {
  return pattern.gaps.reduce((sum, gap) => sum + gap, 0);
}

function calculateAttachmentPositions(pattern) {
  const positions = [0];
  let currentPosition = 0;
  
  for (const gap of pattern.gaps) {
    currentPosition += gap;
    positions.push(currentPosition);
  }
  
  return positions;
}

function calculateRodBounds(rod) {
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

function calculatePlateBounds(plate, rods) {
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

function isPointInBounds(cursor, bounds) {
  if (Array.isArray(bounds.y)) {
    return Math.abs(cursor.x - bounds.x) < bounds.width / 2 &&
           cursor.y >= bounds.y[0] && cursor.y <= bounds.y[1];
  } else {
    return cursor.x >= bounds.x[0] && cursor.x <= bounds.x[1] &&
           Math.abs(cursor.y - bounds.y) < bounds.height / 2;
  }
}

function findClosestAttachment(cursorY, attachmentPoints) {
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

function findElementAtCursor(cursor, shelf) {
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

function updateSpatialIndex(shelf) {
  shelf.spatialIndex.rodColumns.clear();
  shelf.spatialIndex.plateLevels.clear();
  
  for (const [rodId, rod] of shelf.rods) {
    const x = Math.round(rod.position.x / CONSTANTS.ROD_HORIZONTAL_SPACING) * CONSTANTS.ROD_HORIZONTAL_SPACING;
    if (!shelf.spatialIndex.rodColumns.has(x)) {
      shelf.spatialIndex.rodColumns.set(x, []);
    }
    shelf.spatialIndex.rodColumns.get(x).push(rodId);
  }
  
  for (const [plateId, plate] of shelf.plates) {
    const y = Math.round(plate.bounds.y / 10) * 10;
    if (!shelf.spatialIndex.plateLevels.has(y)) {
      shelf.spatialIndex.plateLevels.set(y, []);
    }
    shelf.spatialIndex.plateLevels.get(y).push(plateId);
  }
}

function updateRodPattern(rodId, newPattern, shelf) {
  const rod = shelf.rods.get(rodId);
  if (!rod) return;
  
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === newPattern);
  if (!pattern) return;
  
  rod.pattern = newPattern;
  rod.attachmentPoints = calculateAttachmentPositions(pattern).map(y => ({ y, plateId: undefined }));
  rod.bounds = calculateRodBounds(rod);
  
  const affectedPlates = [];
  for (const [plateId, plate] of shelf.plates) {
    const hasConnection = plate.connections.some(([id]) => id === rodId);
    if (hasConnection) {
      affectedPlates.push(plateId);
    }
  }
  
  affectedPlates.forEach(plateId => {
    const plate = shelf.plates.get(plateId);
    try {
      plate.bounds = calculatePlateBounds(plate, shelf.rods);
    } catch {
      shelf.plates.delete(plateId);
    }
  });
  
  updateSpatialIndex(shelf);
}

function addRod(position, pattern, shelf) {
  const rodId = `rod-${shelf.metadata.nextId++}`;
  const rodPattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === pattern);
  
  if (!rodPattern) throw new Error(`Invalid rod pattern: ${pattern}`);
  
  const attachmentPoints = calculateAttachmentPositions(rodPattern).map(y => ({ y, plateId: undefined }));
  const rodData = {
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

function addPlate(startRodId, endRodId, attachmentLevel, plateSize, shelf) {
  const startRod = shelf.rods.get(startRodId);
  const endRod = shelf.rods.get(endRodId);
  
  if (!startRod || !endRod) return null;
  
  // Find all rods that this plate will span across
  const startX = startRod.position.x;
  const endX = endRod.position.x;
  
  // Get all rods between start and end (inclusive)
  const spanningRods = [];
  for (const [rodId, rodData] of shelf.rods) {
    const rodX = rodData.position.x;
    if (rodX >= Math.min(startX, endX) && rodX <= Math.max(startX, endX)) {
      spanningRods.push({ id: rodId, data: rodData, x: rodX });
    }
  }
  
  // Sort by X position
  spanningRods.sort((a, b) => a.x - b.x);
  
  // Check that all required rods exist and have attachment points
  const connections = [];
  for (const rod of spanningRods) {
    const attachmentIndex = rod.data.attachmentPoints.findIndex(p => p.y === attachmentLevel);
    if (attachmentIndex === -1) {
      console.warn(`Rod ${rod.id} doesn't have attachment point at ${attachmentLevel}cm`);
      return null;
    }
    
    // Check if attachment point is already occupied
    if (rod.data.attachmentPoints[attachmentIndex].plateId) {
      console.warn(`Rod ${rod.id} attachment point already occupied by plate ${rod.data.attachmentPoints[attachmentIndex].plateId}`);
      return null;
    }
    
    connections.push([rod.id, attachmentIndex]);
  }
  
  const plateId = `plate-${shelf.metadata.nextId++}`;
  
  const plateData = {
    size: plateSize,
    connections: connections,
    bounds: { x: [0, 0], y: 0, width: 0, height: 20 }
  };
  
  try {
    plateData.bounds = calculatePlateBounds(plateData, shelf.rods);
  } catch {
    return null;
  }
  
  // Mark all attachment points as occupied
  for (const [rodId, attachmentIndex] of connections) {
    const rod = shelf.rods.get(rodId);
    rod.attachmentPoints[attachmentIndex].plateId = plateId;
  }
  
  shelf.plates.set(plateId, plateData);
  updateSpatialIndex(shelf);
  
  return plateId;
}

function removePlate(plateId, shelf) {
  const plateData = shelf.plates.get(plateId);
  if (!plateData) return false;
  
  // Clear all attachment point references
  for (const [rodId, attachmentIndex] of plateData.connections) {
    const rod = shelf.rods.get(rodId);
    if (rod && rod.attachmentPoints[attachmentIndex]) {
      rod.attachmentPoints[attachmentIndex].plateId = null;
    }
  }
  
  // Remove plate from shelf
  shelf.plates.delete(plateId);
  updateSpatialIndex(shelf);
  
  return true;
}

function createEmptyShelf() {
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

function listRequiredComponents(shelf) {
  const componentCounts = new Map();
  
  // Count rods by pattern
  for (const [rodId, rod] of shelf.rods) {
    const key = `rod-${rod.pattern}`;
    componentCounts.set(key, (componentCounts.get(key) || 0) + 1);
  }
  
  // Count plates by size
  for (const [plateId, plate] of shelf.plates) {
    const key = `plate-${plate.size}mm`;
    componentCounts.set(key, (componentCounts.get(key) || 0) + 1);
  }
  
  // Convert to sorted array
  return Array.from(componentCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([component, quantity]) => ({ component, quantity }));
}

function serializeShelfToString(shelf) {
  const rodEntries = Array.from(shelf.rods.entries())
    .sort((a, b) => a[1].position.x - b[1].position.x);
  
  const rodStrings = rodEntries.map(([rodId, rodData]) => {
    const attachmentStrings = rodData.attachmentPoints.map(point => {
      if (point.plateId) {
        const plate = shelf.plates.get(point.plateId);
        return plate ? plate.size.toString() : '*';
      }
      return '*';
    });
    
    return `${rodData.position.x}:${rodData.pattern}[${attachmentStrings.join(',')}]`;
  });
  
  return rodStrings.join(' ');
}

function parseShelfFromString(shelfString) {
  const shelf = createEmptyShelf();
  
  if (!shelfString.trim()) {
    return shelf;
  }
  
  const rodStrings = shelfString.trim().split(' ');
  const plateConnections = [];
  
  // First pass: create rods and track plate requirements
  for (const rodString of rodStrings) {
    const match = rodString.match(/^(\d+):([^[]+)\[([^\]]*)\]$/);
    if (!match) {
      throw new Error(`Invalid rod format: ${rodString}`);
    }
    
    const [, xPos, pattern, attachmentsStr] = match;
    const x = parseInt(xPos);
    const attachments = attachmentsStr ? attachmentsStr.split(',') : [];
    
    // Validate pattern exists
    const rodPattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === pattern);
    if (!rodPattern) {
      throw new Error(`Unknown rod pattern: ${pattern}`);
    }
    
    // Create rod
    const rodId = addRod({ x, z: 0 }, pattern, shelf);
    
    // Track plates needed
    attachments.forEach((attachment, index) => {
      if (attachment !== '*') {
        const plateSize = parseInt(attachment);
        if (isNaN(plateSize)) {
          throw new Error(`Invalid plate size: ${attachment}`);
        }
        
        plateConnections.push({
          rodId,
          attachmentIndex: index,
          plateSize,
          level: shelf.rods.get(rodId).attachmentPoints[index].y
        });
      }
    });
  }
  
  // Second pass: create plates by matching connections at same level
  const processedConnections = new Set();
  
  for (let i = 0; i < plateConnections.length; i++) {
    if (processedConnections.has(i)) continue;
    
    const conn1 = plateConnections[i];
    
    // Find matching connection at same level
    for (let j = i + 1; j < plateConnections.length; j++) {
      if (processedConnections.has(j)) continue;
      
      const conn2 = plateConnections[j];
      
      if (conn1.level === conn2.level && conn1.plateSize === conn2.plateSize) {
        // Create plate between these two connections
        const rod1 = shelf.rods.get(conn1.rodId);
        const rod2 = shelf.rods.get(conn2.rodId);
        
        // Ensure rod1 is to the left of rod2
        const [leftConn, rightConn] = rod1.position.x < rod2.position.x 
          ? [conn1, conn2] : [conn2, conn1];
        
        const plateId = addPlate(leftConn.rodId, rightConn.rodId, leftConn.level, leftConn.plateSize, shelf);
        
        if (plateId) {
          processedConnections.add(i);
          processedConnections.add(j);
          break;
        }
      }
    }
  }
  
  // Check for unmatched plate connections
  const unmatchedConnections = plateConnections.filter((_, index) => !processedConnections.has(index));
  if (unmatchedConnections.length > 0) {
    const unmatched = unmatchedConnections.map(conn => 
      `${conn.plateSize}mm at level ${conn.level}cm`
    ).join(', ');
    throw new Error(`Unmatched plate connections: ${unmatched}`);
  }
  
  return shelf;
}

function validateShelfConfiguration(shelf) {
  const errors = [];
  
  // Check if shelf is empty
  if (shelf.rods.size === 0) {
    return { valid: true, errors: [], warnings: ['Shelf has no components'] };
  }
  
  // Validate each plate connection
  for (const [plateId, plate] of shelf.plates) {
    // Check if plate has exactly 2 connections
    if (plate.connections.length !== 2) {
      errors.push(`Plate ${plateId} has ${plate.connections.length} connections, expected 2`);
      continue;
    }
    
    const [startConnection, endConnection] = plate.connections;
    const startRod = shelf.rods.get(startConnection[0]);
    const endRod = shelf.rods.get(endConnection[0]);
    
    // Check if connected rods exist
    if (!startRod) {
      errors.push(`Plate ${plateId} references non-existent rod ${startConnection[0]}`);
      continue;
    }
    if (!endRod) {
      errors.push(`Plate ${plateId} references non-existent rod ${endConnection[0]}`);
      continue;
    }
    
    // Check if attachment points exist
    if (startConnection[1] >= startRod.attachmentPoints.length) {
      errors.push(`Plate ${plateId} references invalid attachment point on rod ${startConnection[0]}`);
      continue;
    }
    if (endConnection[1] >= endRod.attachmentPoints.length) {
      errors.push(`Plate ${plateId} references invalid attachment point on rod ${endConnection[0]}`);
      continue;
    }
    
    // Check if attachment points are at same vertical level
    const startY = startRod.attachmentPoints[startConnection[1]].y;
    const endY = endRod.attachmentPoints[endConnection[1]].y;
    if (startY !== endY) {
      errors.push(`Plate ${plateId} connects attachment points at different levels: ${startY}cm vs ${endY}cm`);
    }
    
    // Check if horizontal spacing matches plate specification
    const horizontalDistance = Math.abs(endRod.position.x - startRod.position.x);
    const plateSpec = AVAILABLE_PLATE_SPECS.find(spec => spec.length === plate.size);
    if (plateSpec) {
      const expectedDistance = plateSpec.spans * CONSTANTS.ROD_HORIZONTAL_SPACING;
      if (horizontalDistance !== expectedDistance) {
        errors.push(`Plate ${plateId} (${plate.size}mm) spans ${horizontalDistance}mm but should span ${expectedDistance}mm`);
      }
    } else {
      errors.push(`Plate ${plateId} has invalid size ${plate.size}mm`);
    }
  }
  
  // Check for valid rod patterns
  for (const [rodId, rod] of shelf.rods) {
    const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === rod.pattern);
    if (!pattern) {
      errors.push(`Rod ${rodId} has invalid pattern: ${rod.pattern}`);
      continue;
    }
    
    // Check if attachment points match pattern
    const expectedPositions = calculateAttachmentPositions(pattern);
    if (rod.attachmentPoints.length !== expectedPositions.length) {
      errors.push(`Rod ${rodId} has ${rod.attachmentPoints.length} attachment points, expected ${expectedPositions.length}`);
      continue;
    }
    
    for (let i = 0; i < expectedPositions.length; i++) {
      if (rod.attachmentPoints[i].y !== expectedPositions[i]) {
        errors.push(`Rod ${rodId} attachment point ${i} at ${rod.attachmentPoints[i].y}cm, expected ${expectedPositions[i]}cm`);
      }
    }
  }
  
  // Warnings
  const warnings = [];
  
  // Check for unused attachment points
  let totalAttachmentPoints = 0;
  let usedAttachmentPoints = 0;
  for (const [rodId, rod] of shelf.rods) {
    totalAttachmentPoints += rod.attachmentPoints.length;
    usedAttachmentPoints += rod.attachmentPoints.filter(point => point.plateId).length;
  }
  
  if (usedAttachmentPoints < totalAttachmentPoints * 0.3) {
    warnings.push(`Only ${Math.round(usedAttachmentPoints/totalAttachmentPoints*100)}% of attachment points are used`);
  }
  
  // Check for structural stability (need at least 2 rods for any plates)
  if (shelf.plates.size > 0 && shelf.rods.size < 2) {
    errors.push('Plates require at least 2 rods for support');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export { 
  AVAILABLE_ROD_PATTERNS,
  AVAILABLE_PLATE_SPECS,
  CONSTANTS,
  calculateRodHeight,
  calculateAttachmentPositions,
  createEmptyShelf,
  addRod,
  addPlate,
  removePlate,
  updateRodPattern,
  findElementAtCursor,
  listRequiredComponents,
  validateShelfConfiguration,
  serializeShelfToString,
  parseShelfFromString
};