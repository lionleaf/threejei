import { TestRunner, expect } from './test-framework.js';
import { 
  createEmptyShelf, 
  addRod, 
  addPlate, 
  updateRodPattern,
  findElementAtCursor,
  calculateAttachmentPositions,
  calculateRodHeight,
  AVAILABLE_ROD_PATTERNS,
  AVAILABLE_PLATE_SPECS,
  CONSTANTS
} from './shelf-models.js';

const testRunner = new TestRunner();

testRunner.test('calculateRodHeight - single gap', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "2P_2")!;
  const height = calculateRodHeight(pattern);
  expect(height).toBe(20);
});

testRunner.test('calculateRodHeight - multiple gaps', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "3P_23")!;
  const height = calculateRodHeight(pattern);
  expect(height).toBe(50); // 20 + 30
});

testRunner.test('calculateAttachmentPositions - simple pattern', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "3P_22")!;
  const positions = calculateAttachmentPositions(pattern);
  expect(positions).toEqual([0, 20, 40]);
});

testRunner.test('createEmptyShelf - initializes correctly', () => {
  const shelf = createEmptyShelf();
  expect(shelf.rods.size).toBe(0);
  expect(shelf.plates.size).toBe(0);
  expect(shelf.metadata.nextId).toBe(1);
});

testRunner.test('addRod - creates rod with correct properties', () => {
  const shelf = createEmptyShelf();
  const rodId = addRod({ x: 0, z: 0 }, "3P_22", shelf);
  
  expect(shelf.rods.size).toBe(1);
  expect(shelf.rods.has(rodId)).toBeTruthy();
  
  const rod = shelf.rods.get(rodId)!;
  expect(rod.pattern).toBe("3P_22");
  expect(rod.position.x).toBe(0);
  expect(rod.attachmentPoints).toHaveLength(3);
  expect(rod.attachmentPoints[0].y).toBe(0);
  expect(rod.attachmentPoints[1].y).toBe(20);
  expect(rod.attachmentPoints[2].y).toBe(40);
});

testRunner.test('addPlate - creates plate between two rods', () => {
  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, z: 0 }, "3P_22", shelf);
  const rod2 = addRod({ x: 600, z: 0 }, "3P_22", shelf);
  
  const plateId = addPlate(rod1, rod2, 20, 670, shelf);
  
  expect(plateId).toBeTruthy();
  expect(shelf.plates.size).toBe(1);
  
  const plate = shelf.plates.get(plateId!)!;
  expect(plate.size).toBe(670);
  expect(plate.connections).toHaveLength(2);
  expect(plate.connections[0][0]).toBe(rod1);
  expect(plate.connections[1][0]).toBe(rod2);
});

testRunner.test('addPlate - fails with invalid attachment level', () => {
  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, z: 0 }, "2P_2", shelf);
  const rod2 = addRod({ x: 600, z: 0 }, "2P_2", shelf);
  
  const plateId = addPlate(rod1, rod2, 50, 670, shelf); // 50cm level doesn't exist
  
  expect(plateId).toBe(null);
  expect(shelf.plates.size).toBe(0);
});

testRunner.test('updateRodPattern - changes pattern and updates attachments', () => {
  const shelf = createEmptyShelf();
  const rodId = addRod({ x: 0, z: 0 }, "2P_2", shelf);
  
  const rodBefore = shelf.rods.get(rodId)!;
  expect(rodBefore.attachmentPoints).toHaveLength(2);
  
  updateRodPattern(rodId, "3P_23", shelf);
  
  const rodAfter = shelf.rods.get(rodId)!;
  expect(rodAfter.pattern).toBe("3P_23");
  expect(rodAfter.attachmentPoints).toHaveLength(3);
  expect(rodAfter.attachmentPoints[0].y).toBe(0);
  expect(rodAfter.attachmentPoints[1].y).toBe(20);
  expect(rodAfter.attachmentPoints[2].y).toBe(50);
});

testRunner.test('findElementAtCursor - finds rod', () => {
  const shelf = createEmptyShelf();
  const rodId = addRod({ x: 300, z: 0 }, "3P_22", shelf);
  
  const result = findElementAtCursor({ x: 300, y: 20 }, shelf);
  
  expect(result).toBeTruthy();
  expect(result!.type).toBe('rod');
  expect(result!.id).toBe(rodId);
  expect(result!.attachmentIndex).toBe(1); // closest to y=20
});

testRunner.test('findElementAtCursor - finds plate', () => {
  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, z: 0 }, "3P_22", shelf);
  const rod2 = addRod({ x: 600, z: 0 }, "3P_22", shelf);
  const plateId = addPlate(rod1, rod2, 20, 670, shelf);
  
  const result = findElementAtCursor({ x: 300, y: 20 }, shelf);
  
  expect(result).toBeTruthy();
  expect(result!.type).toBe('plate');
  expect(result!.id).toBe(plateId!);
});

testRunner.test('findElementAtCursor - returns null for empty space', () => {
  const shelf = createEmptyShelf();
  
  const result = findElementAtCursor({ x: 500, y: 100 }, shelf);
  
  expect(result).toBe(null);
});

testRunner.run();