// Simple test runner that can execute our TypeScript-like code in Node.js
import fs from 'fs';

// Import our modules by reading and evaluating the files
const testFrameworkCode = fs.readFileSync('./test-framework.ts', 'utf8')
  .replace(/export \{[^}]+\};?/g, '') // Remove export statements
  .replace(/interface [^{]+\{[^}]+\}/g, ''); // Remove interfaces

const shelfModelsCode = fs.readFileSync('./shelf-models.ts', 'utf8')
  .replace(/export /g, '') // Remove export keywords
  .replace(/interface [^{]+\{[^}]+\}/gs, '') // Remove interfaces (multiline)
  .replace(/export const /g, 'const ');

// Evaluate the code to make functions available
eval(testFrameworkCode);
eval(shelfModelsCode);

// Now run our tests
const testRunner = new TestRunner();

testRunner.test('calculateRodHeight - single gap', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "2P_2");
  const height = calculateRodHeight(pattern);
  expect(height).toBe(20);
});

testRunner.test('calculateRodHeight - multiple gaps', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "3P_23");
  const height = calculateRodHeight(pattern);
  expect(height).toBe(50); // 20 + 30
});

testRunner.test('calculateAttachmentPositions - simple pattern', () => {
  const pattern = AVAILABLE_ROD_PATTERNS.find(p => p.id === "3P_22");
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
  
  const rod = shelf.rods.get(rodId);
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
  
  const plate = shelf.plates.get(plateId);
  expect(plate.size).toBe(670);
  expect(plate.connections).toHaveLength(2);
  expect(plate.connections[0][0]).toBe(rod1);
  expect(plate.connections[1][0]).toBe(rod2);
});

testRunner.test('findElementAtCursor - finds rod', () => {
  const shelf = createEmptyShelf();
  const rodId = addRod({ x: 300, z: 0 }, "3P_22", shelf);
  
  const result = findElementAtCursor({ x: 300, y: 20 }, shelf);
  
  expect(result).toBeTruthy();
  expect(result.type).toBe('rod');
  expect(result.id).toBe(rodId);
  expect(result.attachmentIndex).toBe(1); // closest to y=20
});

testRunner.run();