import { createEmptyShelf, addRod, addPlate, tryExtendPlate, Direction } from './shelf-model.ts';

function testPlateValidation() {
  // Test 1: Valid 670mm plate (600mm span between rods)
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, z: 0 }, 1, shelf1);
  const rod2 = addRod({ x: 600, z: 0 }, 1, shelf1);
  const plate1 = addPlate(1, [rod1, rod2], shelf1); // 670mm plate
  console.log(plate1 > 0 ? '✅ Valid 670mm plate' : '❌ Valid 670mm plate failed');

  // Test 2: Invalid spacing for 670mm plate
  const shelf2 = createEmptyShelf();
  const rod3 = addRod({ x: 0, z: 0 }, 1, shelf2);
  const rod4 = addRod({ x: 500, z: 0 }, 1, shelf2); // Wrong distance
  const plate2 = addPlate(1, [rod3, rod4], shelf2);
  console.log(plate2 === -1 ? '✅ Invalid spacing rejected' : '❌ Invalid spacing not rejected');

  // Test 3: Valid 1270mm-double plate (600mm + 600mm spans)
  const shelf3 = createEmptyShelf();
  const rod5 = addRod({ x: 0, z: 0 }, 1, shelf3);
  const rod6 = addRod({ x: 600, z: 0 }, 1, shelf3);
  const rod7 = addRod({ x: 1200, z: 0 }, 1, shelf3);
  const plate3 = addPlate(3, [rod5, rod6, rod7], shelf3); // 1270mm-double
  console.log(plate3 > 0 ? '✅ Valid 1270mm-double plate' : '❌ Valid 1270mm-double failed');

  // Test 4: Single rod (should fail)
  const shelf4 = createEmptyShelf();
  const rod8 = addRod({ x: 0, z: 0 }, 1, shelf4);
  const plate4 = addPlate(1, [rod8], shelf4);
  console.log(plate4 === -1 ? '✅ Single rod rejected' : '❌ Single rod not rejected');
}

function testTryExtendPlate() {
  // Success scenarios (should return true when implemented)

  // Test 1: Extend 670mm plate right to 1270mm-double
  const shelf1 = createEmptyShelf();
  const rod1 = addRod({ x: 0, z: 0 }, 1, shelf1);
  const rod2 = addRod({ x: 600, z: 0 }, 1, shelf1);
  const rod3 = addRod({ x: 1200, z: 0 }, 1, shelf1); // Available rod to extend to
  const plate1 = addPlate(1, [rod1, rod2], shelf1); // 670mm plate
  const originalSKU = shelf1.plates.get(plate1)?.sku_id;
  const extend1 = tryExtendPlate(plate1, Direction.Right, shelf1);
  const newSKU = shelf1.plates.get(plate1)?.sku_id;
  const stateUnchanged = originalSKU === newSKU;
  console.log(extend1 && !stateUnchanged ? '✅ Extend right test passed' : '❌ Extend right test failed');

  // Test 2: Extend 670mm plate left to 1270mm-double
  const shelf2 = createEmptyShelf();
  const rod4 = addRod({ x: 0, z: 0 }, 1, shelf2); // Available rod to extend to
  const rod5 = addRod({ x: 600, z: 0 }, 1, shelf2);
  const rod6 = addRod({ x: 1200, z: 0 }, 1, shelf2);
  const plate2 = addPlate(1, [rod5, rod6], shelf2); // 670mm plate
  const originalSKU2 = shelf2.plates.get(plate2)?.sku_id;
  const extend2 = tryExtendPlate(plate2, Direction.Left, shelf2);
  const newSKU2 = shelf2.plates.get(plate2)?.sku_id;
  const stateUnchanged2 = originalSKU2 === newSKU2;
  console.log(extend2 && !stateUnchanged2 ? '✅ Extend left test passed' : '❌ Extend left test failed');

  // Test 3: Extend 1270mm-double to 1870mm
  const shelf3 = createEmptyShelf();
  const rod7 = addRod({ x: 0, z: 0 }, 1, shelf3);
  const rod8 = addRod({ x: 600, z: 0 }, 1, shelf3);
  const rod9 = addRod({ x: 1200, z: 0 }, 1, shelf3);
  const rod10 = addRod({ x: 1800, z: 0 }, 1, shelf3); // Available rod to extend to
  const plate3 = addPlate(3, [rod7, rod8, rod9], shelf3); // 1270mm-double
  const originalSKU3 = shelf3.plates.get(plate3)?.sku_id;
  const extend3 = tryExtendPlate(plate3, Direction.Right, shelf3);
  const newSKU3 = shelf3.plates.get(plate3)?.sku_id;
  const stateUnchanged3 = originalSKU3 === newSKU3;
  console.log(extend3 && !stateUnchanged3 ? '✅ Extend to 1870mm test passed' : '❌ Extend to 1870mm test failed');

  // Failure scenarios (should return false even when implemented)

  // Test 4: No rod available to extend to
  const shelf4 = createEmptyShelf();
  const rod11 = addRod({ x: 0, z: 0 }, 1, shelf4);
  const rod12 = addRod({ x: 600, z: 0 }, 1, shelf4);
  const plate4 = addPlate(1, [rod11, rod12], shelf4); // No rod at x=1200
  const originalSKU4 = shelf4.plates.get(plate4)?.sku_id;
  const extend4 = tryExtendPlate(plate4, Direction.Right, shelf4);
  const newSKU4 = shelf4.plates.get(plate4)?.sku_id;
  const stateUnchanged4 = originalSKU4 === newSKU4;
  console.log(!extend4 && stateUnchanged4 ? '✅ No target rod test passed' : '❌ No target rod test failed');

  // Test 5: Invalid plate ID
  const shelf5 = createEmptyShelf();
  const extend5 = tryExtendPlate(999, Direction.Right, shelf5); // Non-existent plate
  console.log(!extend5 ? '✅ Invalid plate ID test passed' : '❌ Invalid plate ID test failed');

  // Test 6: No larger plate SKU available (already at max size)
  const shelf6 = createEmptyShelf();
  const rod13 = addRod({ x: 0, z: 0 }, 1, shelf6);
  const rod14 = addRod({ x: 600, z: 0 }, 1, shelf6);
  const rod15 = addRod({ x: 1200, z: 0 }, 1, shelf6);
  const rod16 = addRod({ x: 1800, z: 0 }, 1, shelf6);
  const plate6 = addPlate(4, [rod13, rod14, rod15, rod16], shelf6); // 1870mm (max size)
  const originalSKU6 = shelf6.plates.get(plate6)?.sku_id;
  const extend6 = tryExtendPlate(plate6, Direction.Right, shelf6);
  const newSKU6 = shelf6.plates.get(plate6)?.sku_id;
  const stateUnchanged6 = originalSKU6 === newSKU6;
  console.log(!extend6 && stateUnchanged6 ? '✅ Max size plate test passed' : '❌ Max size plate test failed');
}

const shelf = createEmptyShelf();
console.log(shelf.rods.size === 0 ? '✅ Test passed' : '❌ Test failed');
addRod({ x: 0, z: 0 }, 1, shelf);
console.log(shelf.rods.size === 1 ? '✅ addRod test passed' : '❌ addRod test failed');
testPlateValidation();
testTryExtendPlate();