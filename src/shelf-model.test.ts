import { createEmptyShelf, addRod, addPlate, canExtendPlate, extendPlate, canAddPlateSegment, Direction, AVAILABLE_PLATES, mergePlates, applyRodCreation } from './shelf-model.js';

// Wrapper to match old test API
function tryExtendPlate(plateId: number, direction: Direction, shelf: any): boolean {
  const result = canExtendPlate(plateId, direction, shelf);
  if (!result) return false;
  const [newSkuId, newConnections] = result;
  extendPlate(plateId, newSkuId, newConnections, shelf);
  return true;
}

import { test, testGroup, assertEquals, assertTrue, printResults } from './test-framework.js';

testGroup('Plate Addition Validation - Valid Plates', () => {
  test('670mm plate with 600mm gap should succeed', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const plateId = addPlate(0, 1, [rod1, rod2], shelf);

    assertTrue(plateId > 0, 'Plate ID should be positive');
    assertTrue(shelf.plates.has(plateId), 'Plate should exist in shelf');

    const plate = shelf.plates.get(plateId);
    assertEquals(plate?.sku_id, 1, 'Plate SKU should be 1 (670mm)');
  });

  test('1270mm plate with 600mm+600mm gaps should succeed', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);
    const plateId = addPlate(0, 3, [rod1, rod2, rod3], shelf);

    assertTrue(plateId > 0, 'Plate ID should be positive');
    const plate = shelf.plates.get(plateId);
    assertEquals(plate?.sku_id, 3, 'Plate SKU should be 3 (1270mm-double)');
  });

  test('1870mm plate with 600mm+600mm+600mm gaps should succeed', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);
    const rod4 = addRod({ x: 1800, y: 0 }, 1, shelf);
    const plateId = addPlate(0, 4, [rod1, rod2, rod3, rod4], shelf);

    assertTrue(plateId > 0, 'Plate ID should be positive');
    const plate = shelf.plates.get(plateId);
    assertEquals(plate?.sku_id, 4, 'Plate SKU should be 4 (1870mm)');
  });
});

testGroup('Plate Addition Validation - Invalid Plates (Non-existent SKUs)', () => {
  test('Plate with 500mm gap should fail (no SKU exists)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 500, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 for invalid spacing');
    assertEquals(shelf.plates.size, 0, 'No plate should be created');
  });

  test('Plate with 700mm gap should fail (no SKU exists)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 700, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 for invalid spacing');
  });

  test('Plate with 800mm gap should fail (no SKU exists)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 800, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 for invalid spacing');
  });

  test('Plate spanning 4 gaps (2400mm total) should fail (max is 3 spans)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);
    const rod4 = addRod({ x: 1800, y: 0 }, 1, shelf);
    const rod5 = addRod({ x: 2400, y: 0 }, 1, shelf);

    const longestPlateSKU = Math.max(...AVAILABLE_PLATES.map(p => p.sku_id));
    const plateId = addPlate(0, longestPlateSKU, [rod1, rod2, rod3, rod4, rod5], shelf);

    assertEquals(plateId, -1, 'Should return -1 for too many spans');
  });

  test('1270mm-single plate SKU (sku_id=2) with wrong spacing should fail', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 2, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 when SKU spans dont match rod spacing');
  });

  test('Wrong SKU: trying to use 670mm SKU for 1200mm span should fail', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2, rod3], shelf);

    assertEquals(plateId, -1, 'Should return -1 when SKU doesnt match rod count');
  });
});

testGroup('Plate Addition Validation - Invalid Configurations', () => {
  test('Single rod should fail (need at least 2)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1], shelf);

    assertEquals(plateId, -1, 'Should return -1 for single rod');
  });

  test('Misaligned rod heights should fail', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 100 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 when attachment points dont align');
  });

  test('Non-existent rod ID should fail', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, 999], shelf);

    assertEquals(plateId, -1, 'Should return -1 for non-existent rod');
  });

  test('Invalid plate SKU should fail', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 999, [rod1, rod2], shelf);

    assertEquals(plateId, -1, 'Should return -1 for invalid SKU');
  });
});

testGroup('Plate Extension Bug - Extending Beyond Available SKUs', () => {
  test('Cannot extend 1870mm plate (already maximum size)', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);
    const rod4 = addRod({ x: 1800, y: 0 }, 1, shelf);
    const rod5 = addRod({ x: 2400, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 4, [rod1, rod2, rod3, rod4], shelf);
    assertTrue(plateId > 0, 'Should create 1870mm plate');

    const initialSKU = shelf.plates.get(plateId)?.sku_id;
    const extendResult = tryExtendPlate(plateId, Direction.Right, shelf);

    assertEquals(extendResult, false, 'Should not extend beyond max plate size');
    assertEquals(shelf.plates.get(plateId)?.sku_id, initialSKU, 'Plate SKU should remain unchanged');
  });

  test('Cannot extend 670mm plate if no valid SKU exists for calculated spans', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1100, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 1, [rod1, rod2], shelf);
    assertTrue(plateId > 0, 'Should create 670mm plate');

    const initialSKU = shelf.plates.get(plateId)?.sku_id;
    const initialConnections = shelf.plates.get(plateId)?.connections.length;
    const extendResult = tryExtendPlate(plateId, Direction.Right, shelf);

    assertEquals(extendResult, false, 'Should not extend with invalid span (500mm)');
    assertEquals(shelf.plates.get(plateId)?.sku_id, initialSKU, 'Plate SKU should remain unchanged');
    assertEquals(shelf.plates.get(plateId)?.connections.length, initialConnections, 'Plate connections should remain unchanged');
  });

  test('Cannot extend at shelf edge without valid rod at standard distance', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 1, shelf);

    const plateId = addPlate(0, 3, [rod1, rod2, rod3], shelf);
    assertTrue(plateId > 0, 'Should create 1270mm plate');

    const initialSKU = shelf.plates.get(plateId)?.sku_id;
    const initialConnections = shelf.plates.get(plateId)?.connections.length;
    const extendResult = tryExtendPlate(plateId, Direction.Right, shelf);

    assertEquals(extendResult, false, 'Should not extend at edge without target rod');
    assertEquals(shelf.plates.get(plateId)?.sku_id, initialSKU, 'Plate SKU should remain unchanged');
    assertEquals(shelf.plates.get(plateId)?.connections.length, initialConnections, 'Plate connections should remain unchanged');
  });
});


printResults();
