const AVAILABLE_ROD_PATTERNS = [
  { id: "1P", attachmentPoints: 1, gaps: [] },
  { id: "2P_2", attachmentPoints: 2, gaps: [200] },
  { id: "2P_3", attachmentPoints: 2, gaps: [300] },
  { id: "3P_22", attachmentPoints: 3, gaps: [200, 200] },
  { id: "3P_23", attachmentPoints: 3, gaps: [200, 300] },
  { id: "3P_32", attachmentPoints: 3, gaps: [300, 200] },
  { id: "4P_223", attachmentPoints: 4, gaps: [200, 200, 300] },
  { id: "4P_232", attachmentPoints: 4, gaps: [200, 300, 200] },
  { id: "4P_322", attachmentPoints: 4, gaps: [300, 200, 200] },
  { id: "5P_2232", attachmentPoints: 5, gaps: [200, 200, 300, 200] },
  { id: "5P_2322", attachmentPoints: 5, gaps: [200, 300, 200, 200] },
  { id: "5P_3223", attachmentPoints: 5, gaps: [300, 200, 200, 300] },
  { id: "6P_22322", attachmentPoints: 6, gaps: [200, 200, 300, 200, 200] },
  { id: "6P_32232", attachmentPoints: 6, gaps: [300, 200, 200, 300, 200] },
  { id: "7P_322322", attachmentPoints: 7, gaps: [300, 200, 200, 300, 200, 200] }
];

const AVAILABLE_PLATE_SPECS = [
  {
    length: 670,
    spans: [35, 600, 35],
  },
  {
    length: 1270,
    spans: [35, 1200, 35],
  },
  {
    length: 1270,
    spans: [35, 600, 600, 35],
  },
  {
    length: 1870,
    spans: [35, 600, 600, 600, 35],
  }
];

function createEmptyShelf() {
  return {
    rods: new Map(),
    plates: new Map(),
    metadata: {
    }
  };
}

function calculateRodHeight(pattern) {
  return pattern.gaps.reduce((sum, gap) => sum + gap, 0);
}

function findClosestAttachment(cursorY, attachmentPoints) {
  // TODO
}

function findElementAtCursor(cursor, shelf) {
  // TODO
}

function addRod(position, pattern, shelf) {
  // TODO
}

function addPlate(startRodId, endRodId, attachmentLevel, plateSize, shelf) {
  // TODO
}

function removePlate(plateId, shelf) {
  // TODO
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

function validateShelfConfiguration(shelf) {
  // TODO
}

export { 
  createEmptyShelf
  // TODO
};