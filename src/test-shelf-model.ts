import { createEmptyShelf, addRod, addPlate, canExtendPlate, extendPlate, removePlate, Direction, addOrExtendRod, AVAILABLE_RODS } from './shelf-model.js';

// Wrapper to match old test API
function tryExtendPlate(plateId: number, direction: Direction, shelf: any): boolean {
  const result = canExtendPlate(plateId, direction, shelf);
  if (!result) return false;
  const [newSkuId, newConnections] = result;
  extendPlate(plateId, newSkuId, newConnections, shelf);
  return true;
}

const failedTests: string[] = [];

function test(name: string, condition: boolean) {
  if (!condition) {
    failedTests.push(`❌ ${name}`);
  }
}

function testPlateValidation() {
  // Test 1: Valid 670mm plate (600mm span between rods)
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 1, shelf1);
  const rod2 = addRod({ x: 600, y: 0 }, 1, shelf1);
  const plate1 = addPlate(0, 1, [rod1, rod2], shelf1); // 670mm plate
  test('Valid 670mm plate', plate1 > 0);

  // Test 2: Invalid spacing for 670mm plate
  const shelf2 = createEmptyShelf();
  const rod3 = addRod({ x: 0, y: 0 }, 1, shelf2);
  const rod4 = addRod({ x: 500, y: 0 }, 1, shelf2); // Wrong distance
  const plate2 = addPlate(0, 1, [rod3, rod4], shelf2);
  test('Invalid spacing rejected', plate2 === -1);

  // Test 3: Valid 1270mm-double plate (600mm + 600mm spans)
  const shelf3 = createEmptyShelf();
  const rod5 = addRod({ x: 0, y: 0 }, 1, shelf3);
  const rod6 = addRod({ x: 600, y: 0 }, 1, shelf3);
  const rod7 = addRod({ x: 1200, y: 0 }, 1, shelf3);
  const plate3 = addPlate(0, 3, [rod5, rod6, rod7], shelf3); // 1270mm-double
  test('Valid 1270mm-double plate', plate3 > 0);

  // Test 4: Single rod (should fail)
  const shelf4 = createEmptyShelf();
  const rod8 = addRod({ x: 0, y: 0 }, 1, shelf4);
  const plate4 = addPlate(0, 1, [rod8], shelf4);
  test('Single rod rejected', plate4 === -1);
}

function testTryExtendPlate() {
  // Success scenarios (should return true when implemented)

  // Test 1: Extend 670mm plate right to 1270mm-double
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 1, shelf1);
  const rod2 = addRod({ x: 600, y: 0 }, 1, shelf1);
  const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf1); // Available rod to extend to
  const plate1 = addPlate(0, 1, [rod1, rod2], shelf1); // 670mm plate
  const originalSKU = shelf1.plates.get(plate1)?.sku_id;
  const extend1 = tryExtendPlate(plate1, Direction.Right, shelf1);
  const newSKU = shelf1.plates.get(plate1)?.sku_id;
  const stateUnchanged = originalSKU === newSKU;
  test('Extend right test', extend1 && !stateUnchanged);

  // Test 2: Extend 670mm plate left to 1270mm-double
  const shelf2 = createEmptyShelf();
  const rod4 = addRod({ x: 0, y: 0 }, 1, shelf2); // Available rod to extend to
  const rod5 = addRod({ x: 600, y: 0 }, 1, shelf2);
  const rod6 = addRod({ x: 1200, y: 0 }, 1, shelf2);
  const plate2 = addPlate(0, 1, [rod5, rod6], shelf2); // 670mm plate
  const originalSKU2 = shelf2.plates.get(plate2)?.sku_id;
  const extend2 = tryExtendPlate(plate2, Direction.Left, shelf2);
  const newSKU2 = shelf2.plates.get(plate2)?.sku_id;
  const stateUnchanged2 = originalSKU2 === newSKU2;
  test('Extend left test', extend2 && !stateUnchanged2);

  // Test 3: Extend 1270mm-double to 1870mm
  const shelf3 = createEmptyShelf();
  const rod7 = addRod({ x: 0, y: 0 }, 1, shelf3);
  const rod8 = addRod({ x: 600, y: 0 }, 1, shelf3);
  const rod9 = addRod({ x: 1200, y: 0 }, 1, shelf3);
  const rod10 = addRod({ x: 1800, y: 0 }, 1, shelf3); // Available rod to extend to
  const plate3 = addPlate(0, 3, [rod7, rod8, rod9], shelf3); // 1270mm-double
  const originalSKU3 = shelf3.plates.get(plate3)?.sku_id;
  const extend3 = tryExtendPlate(plate3, Direction.Right, shelf3);
  const newSKU3 = shelf3.plates.get(plate3)?.sku_id;
  const stateUnchanged3 = originalSKU3 === newSKU3;
  test('Extend to 1870mm test', extend3 && !stateUnchanged3);

  // Failure scenarios (should return false even when implemented)

  // Test 4: No rod available to extend to
  const shelf4 = createEmptyShelf();
  const rod11 = addRod({ x: 0, y: 0 }, 1, shelf4);
  const rod12 = addRod({ x: 600, y: 0 }, 1, shelf4);
  const plate4 = addPlate(0, 1, [rod11, rod12], shelf4); // No rod at x=1200
  const originalSKU4 = shelf4.plates.get(plate4)?.sku_id;
  const extend4 = tryExtendPlate(plate4, Direction.Right, shelf4);
  const newSKU4 = shelf4.plates.get(plate4)?.sku_id;
  const stateUnchanged4 = originalSKU4 === newSKU4;
  test('No target rod test', !extend4 && stateUnchanged4);

  // Test 5: Invalid plate ID
  const shelf5 = createEmptyShelf();
  const extend5 = tryExtendPlate(999, Direction.Right, shelf5); // Non-existent plate
  test('Invalid plate ID test', !extend5);

  // Test 6: No larger plate SKU available (already at max size)
  const shelf6 = createEmptyShelf();
  const rod13 = addRod({ x: 0, y: 0 }, 1, shelf6);
  const rod14 = addRod({ x: 600, y: 0 }, 1, shelf6);
  const rod15 = addRod({ x: 1200, y: 0 }, 1, shelf6);
  const rod16 = addRod({ x: 1800, y: 0 }, 1, shelf6);
  const plate6 = addPlate(0, 4, [rod13, rod14, rod15, rod16], shelf6); // 1870mm (max size)
  const originalSKU6 = shelf6.plates.get(plate6)?.sku_id;
  const extend6 = tryExtendPlate(plate6, Direction.Right, shelf6);
  const newSKU6 = shelf6.plates.get(plate6)?.sku_id;
  const stateUnchanged6 = originalSKU6 === newSKU6;
  test('Max size plate test', !extend6 && stateUnchanged6);
}

function testAttachmentPointBug() {
  // Test 1: Extension fails wrongfully because it checks wrong attachment point

  // Create rods with multiple attachment points (3P_22 = 3 attachment points)
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 4, shelf1);    // 3P_22 rod
  const rod2 = addRod({ x: 600, y: 0 }, 4, shelf1);  // 3P_22 rod
  const rod3 = addRod({ x: 1200, y: 0 }, 4, shelf1); // 3P_22 rod (target)

  // Manually create a plate at attachment level 1 (not 0) between rod1 and rod2
  const plateId1 = shelf1.metadata.nextId++;
  const rodObj1 = shelf1.rods.get(rod1)!;
  const rodObj2 = shelf1.rods.get(rod2)!;
  const plateY1 = rodObj1.attachmentPoints[1].y; // Get Y coordinate from attachment point 1
  shelf1.plates.set(plateId1, { sku_id: 1, connections: [rod1, rod2], y: plateY1 });

  // Manually set plate connections at attachment point index 1
  rodObj1.attachmentPoints[1].plateId = plateId1;
  rodObj2.attachmentPoints[1].plateId = plateId1;

  // Occupy attachment point 0 on rod3 with a different plate
  const dummyPlateId = shelf1.metadata.nextId++;
  const rodObj3 = shelf1.rods.get(rod3)!;
  const dummyPlateY = rodObj3.attachmentPoints[0].y; // Get Y coordinate from attachment point 0
  shelf1.plates.set(dummyPlateId, { sku_id: 1, connections: [rod3], y: dummyPlateY });
  rodObj3.attachmentPoints[0].plateId = dummyPlateId;

  // Try to extend plate1 to rod3 - this should succeed because attachment point 1 is free
  // But the bug will make it fail because it only checks attachment point 0
  const extendResult = tryExtendPlate(plateId1, Direction.Right, shelf1);
  test('Extension should succeed with correct attachment point', extendResult);

  // Test 2: Extension succeeds wrongfully because it checks wrong attachment point
  const shelf2 = createEmptyShelf();
  const rod4 = addRod({ x: 0, y: 0 }, 4, shelf2);    // 3P_22 rod
  const rod5 = addRod({ x: 600, y: 0 }, 4, shelf2);  // 3P_22 rod
  const rod6 = addRod({ x: 1200, y: 0 }, 4, shelf2); // 3P_22 rod (target)

  // Create a plate at attachment level 1 between rod4 and rod5
  const plateId2 = shelf2.metadata.nextId++;
  const rodObj4 = shelf2.rods.get(rod4)!;
  const rodObj5 = shelf2.rods.get(rod5)!;
  const rodObj6 = shelf2.rods.get(rod6)!;
  const plateY2 = rodObj4.attachmentPoints[1].y; // Get Y coordinate from attachment point 1
  shelf2.plates.set(plateId2, { sku_id: 1, connections: [rod4, rod5], y: plateY2 });

  rodObj4.attachmentPoints[1].plateId = plateId2;
  rodObj5.attachmentPoints[1].plateId = plateId2;

  // Occupy attachment point 1 on rod6 (the CORRECT level) with another plate
  const blockingPlateId = shelf2.metadata.nextId++;
  const blockingPlateY = rodObj6.attachmentPoints[1].y; // Get Y coordinate from attachment point 1
  shelf2.plates.set(blockingPlateId, { sku_id: 1, connections: [rod6], y: blockingPlateY });
  rodObj6.attachmentPoints[1].plateId = blockingPlateId;

  // Leave attachment point 0 free on rod6
  // Try to extend plate2 to rod6 - this should FAIL because attachment point 1 is occupied
  // But the bug will make it succeed because it only checks attachment point 0 (which is free)
  const extendResult2 = tryExtendPlate(plateId2, Direction.Right, shelf2);
  test('Extension should fail when correct attachment point occupied', !extendResult2);
}

// Basic tests
const shelf = createEmptyShelf();
test('Empty shelf creation', shelf.rods.size === 0);
addRod({ x: 0, y: 0 }, 1, shelf);
test('Add rod', shelf.rods.size === 1);

// Run all test suites
testPlateValidation();
testTryExtendPlate();
testAttachmentPointBug();
testRemovePlate();
testAddOrExtendRod();

// Test removePlate function
function testRemovePlate() {
  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
  const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
  const plateId = addPlate(0, 1, [rod1, rod2], shelf);

  // Verify plate exists
  test('Plate created successfully', shelf.plates.has(plateId));

  // Remove the plate
  const removeResult = removePlate(plateId, shelf);
  test('Remove plate returns true', removeResult);
  test('Plate removed from shelf', !shelf.plates.has(plateId));

  // Verify rod connections are cleaned up
  const rodObj1 = shelf.rods.get(rod1)!;
  const rodObj2 = shelf.rods.get(rod2)!;
  test('Rod1 attachment point cleared', rodObj1.attachmentPoints[0].plateId === undefined);
  test('Rod2 attachment point cleared', rodObj2.attachmentPoints[0].plateId === undefined);

  // Test removing non-existent plate
  const removeInvalid = removePlate(999, shelf);
  test('Remove non-existent plate returns false', !removeInvalid);
}


// Test addOrExtendRod function - rod merging behavior
function testAddOrExtendRod() {
  // Test 1: Adding a rod between two existing rods should merge them
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 1, shelf1); // 1P at Y=0
  const rod2 = addRod({ x: 0, y: 400 }, 1, shelf1); // 1P at Y=400

  // Add at Y=200 - should merge rod1 and rod2 into a single rod
  const resultRodId = addOrExtendRod({ x: 0, y: 200 }, shelf1);

  // Should return rod1 (the merged rod)
  test('Merge returns existing rod ID', resultRodId === rod1);
  // Original rod2 should be deleted
  test('Original upper rod should be deleted after merge', !shelf1.rods.has(rod2));
  // Only one rod should remain
  test('Only one rod after merging three', shelf1.rods.size === 1);

  // The merged rod should have 3 attachment points
  const mergedRod = shelf1.rods.get(resultRodId);
  test('Merged rod has 3 attachment points', mergedRod?.attachmentPoints.length === 3);

  // The merged rod should be 3P_22 (spans: [200, 200])
  const mergedSKU = AVAILABLE_RODS.find(r => r.sku_id === mergedRod?.sku_id);
  test('Merged rod is 3P_22', mergedSKU?.name === '3P_22');

  // Test 2: Extending rod below upward
  const shelf2 = createEmptyShelf();
  const rod3 = addRod({ x: 0, y: 0 }, 1, shelf2); // 1P at Y=0

  // Add at Y=200 - should extend rod3 upward
  const resultRodId2 = addOrExtendRod({ x: 0, y: 200 }, shelf2);

  test('Extension returns existing rod ID', resultRodId2 === rod3);
  test('Only one rod after extension', shelf2.rods.size === 1);

  const extendedRod = shelf2.rods.get(resultRodId2);
  test('Extended rod has 2 attachment points', extendedRod?.attachmentPoints.length === 2);

  // Test 3: Extending rod above downward
  const shelf3 = createEmptyShelf();
  const rod4 = addRod({ x: 0, y: 300 }, 1, shelf3); // 1P at Y=300

  // Add at Y=0 - should extend rod4 downward
  const resultRodId3 = addOrExtendRod({ x: 0, y: 0 }, shelf3);

  test('Downward extension returns existing rod ID', resultRodId3 === rod4);
  test('Only one rod after downward extension', shelf3.rods.size === 1);

  const extendedRodDown = shelf3.rods.get(resultRodId3);
  test('Downward extended rod has 2 attachment points', extendedRodDown?.attachmentPoints.length === 2);
  // Rod position should be adjusted downward
  test('Rod position adjusted after downward extension', extendedRodDown?.position.y === 0);

  // Test 4: No merging when gap is invalid (not 200 or 300mm)
  const shelf4 = createEmptyShelf();
  const rod5 = addRod({ x: 0, y: 0 }, 1, shelf4); // 1P at Y=0
  const rod6 = addRod({ x: 0, y: 500 }, 1, shelf4); // 1P at Y=500

  // Add at Y=250 - gap to rod5 is 250mm, gap to rod6 is 250mm (both invalid)
  const resultRodId4 = addOrExtendRod({ x: 0, y: 250 }, shelf4);

  // Should create a new rod
  test('New rod created when gaps invalid', resultRodId4 !== rod5 && resultRodId4 !== rod6);
  test('Three rods after adding with invalid gaps', shelf4.rods.size === 3);
}

// Print results
if (failedTests.length === 0) {
  console.log('All tests passed! ✅');
} else {
  console.log(`${failedTests.length} test(s) failed:`);
  failedTests.forEach(failure => console.log(failure));
}