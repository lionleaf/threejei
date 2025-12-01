import { createEmptyShelf, addRod, addPlate, canExtendPlate, extendPlate, canAddPlateSegment, Direction, AVAILABLE_PLATES, AVAILABLE_RODS, mergePlates, applyRodCreation, regenerateGhostPlates } from './shelf-model.js';

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

// ============================================================================
// Ghost Plate Generation Tests - Rod Operations
// ============================================================================

testGroup('Ghost Plate Generation - Rod Creation', () => {
  test('Simple rod creation at empty position generates correct ghost', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2 rod with one 200mm gap
    const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
    addPlate(0, 1, [rod1, rod2], shelf);

    regenerateGhostPlates(shelf);

    // Should have ghosts for extending plate up and down, which would create new plates
    let ghosts = shelf.ghostPlates.filter(g => g.legal && g.action === 'create');
    assertTrue(ghosts.length == 3, 'one empty spot with three possible plate locations');

    ghosts = shelf.ghostPlates.filter(g => g.legal);
    assertTrue(ghosts.length == 7);

    // Find a ghost that creates a new rod to the right
    const rightGhost = ghosts.find(g => g.midpointPosition.x > 600);
    assertTrue(rightGhost !== undefined, 'Should have ghost for new rod to the right');

    if (rightGhost && rightGhost.rodModifications && rightGhost.rodModifications.length > 0) {
      const rodMod = rightGhost.rodModifications[0];
      assertEquals(rodMod.type, 'create', 'Rod modification type should be create');
      assertTrue(rodMod.newSkuId !== undefined, 'Should have new SKU ID');
      assertTrue(rodMod.position.x > 600, 'New rod position should be to the right');
      assertEquals(rodMod.affectedRodIds?.length || 0, 0, 'Rod creation should not affect existing rods');
    }
  });
  test('Rod creation modification has correct SKU', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf); // 1P rod (minimal)
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    addPlate(0, 1, [rod1, rod2], shelf);

    regenerateGhostPlates(shelf);

    const createGhost = shelf.ghostPlates.find(g =>
      g.legal && g.action === 'create' && g.rodModifications && g.rodModifications.length > 0
    );

    if (createGhost && createGhost.rodModifications) {
      const rodMod = createGhost.rodModifications[0];
      assertTrue(rodMod.newSkuId === 1, 'New rod should be minimal 1P rod (sku_id=1)');
    }
  });

  test('Rod creation at standard gap (600mm) has correct position', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    addPlate(0, 1, [rod1, rod2], shelf);

    regenerateGhostPlates(shelf);

    const rightGhost = shelf.ghostPlates.find(g =>
      g.legal && g.action === 'create' && g.midpointPosition.x > 600
    );

    if (rightGhost && rightGhost.rodModifications) {
      const rodMod = rightGhost.rodModifications[0];
      assertEquals(rodMod.position.x, 1200, 'New rod should be at x=1200 (600mm right of rod2)');
    }
  });

  test('Multiple rod creation scenarios generate unique ghosts', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
    const rod3 = addRod({ x: 1200, y: 0 }, 2, shelf);
    addPlate(0, 1, [rod1, rod2], shelf);
    addPlate(0, 1, [rod2, rod3], shelf);

    regenerateGhostPlates(shelf);

    const createGhosts = shelf.ghostPlates.filter(g => g.legal && g.action === 'create');

    // Check for uniqueness by position
    const positions = createGhosts.map(g => `${g.midpointPosition.x},${g.midpointPosition.y}`);
    const uniquePositions = new Set(positions);
    assertEquals(positions.length, uniquePositions.size, 'All ghost positions should be unique');
  });

  test('Rod creation includes plate connection data', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);
    const rod2 = addRod({ x: 600, y: 0 }, 1, shelf);
    addPlate(0, 1, [rod1, rod2], shelf);

    regenerateGhostPlates(shelf);

    // With 1P rods (no extension possible), ghosts will be for creating/extending
    // Check that ANY ghost with rod modifications for creation exists
    const ghostsWithRodMods = shelf.ghostPlates.filter(g =>
      g.legal && g.rodModifications && g.rodModifications.length > 0
    );
    assertTrue(ghostsWithRodMods.length > 0, 'Should have ghosts with rod modifications');

    // Verify ghost plates have plate SKU and connections
    const ghostsWithConnections = shelf.ghostPlates.filter(g =>
      g.legal && g.sku_id !== undefined && g.connections !== undefined
    );
    assertTrue(ghostsWithConnections.length > 0, 'Should have ghosts with plate connections');
  });
});

testGroup('Ghost Plate Generation - Rod Extension Upward', () => {

  test('New plate above existing rod', () => {
    const shelf = createEmptyShelf();
    const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: spans=[200]
    const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
    const rod3 = addRod({ x: 1200, y: 200 }, 1, shelf);
    addPlate(200, 3, [rod1, rod2, rod3], shelf); // Plate at top of rods
    addPlate(0, 1, [rod1, rod2], shelf); // Plate at bottom of rods

    regenerateGhostPlates(shelf);

    // Find ghost plate extending bottom plate to the right (from rod2 to rod3 at y=0)
    const extendRightGhost = shelf.ghostPlates.find(g =>
      g.legal && g.midpointPosition.y === 0 && g.connections?.includes(rod3)
    );

    assertTrue(extendRightGhost !== undefined, 'Should have ghost plate extending bottom plate to rod3');

    // Verify this ghost plate has rod modification to extend rod3 downwards
    if (extendRightGhost && extendRightGhost.rodModifications) {
      const rod3Mod = extendRightGhost.rodModifications.find(m =>
        m.affectedRodIds?.includes(rod3)
      );

      assertTrue(rod3Mod !== undefined, 'Should have modification for rod3');
      assertEquals(rod3Mod?.type, 'extend', 'Should be extend modification');
      assertEquals(rod3Mod?.direction, 'down', 'Should extend downwards');
      assertEquals(rod3Mod?.visualHeight, 200, 'Should extend rod3 down by 200mm');
      assertEquals(rod3Mod?.visualY, 0, 'Extension should start at y=0');
    }
  });

  test('No illegal ghost plates at misaligned rod attachment points', () => {
    const shelf = createEmptyShelf();

    // Create configuration from the picture with 3 rods at different heights
    // Rod 1 (left): Short rod starting at y=0
    const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: two points at y=0, y=200

    // Rod 2 (middle): Tall rod with multiple points
    const rod2 = addRod({ x: 600, y: 0 }, 4, shelf); // 4P_223: points at y=0, y=200, y=400, y=700

    // Rod 3 (right): Tall rod at different alignment
    const rod3 = addRod({ x: 1200, y: 100 }, 4, shelf); // 4P_223: points at y=100, y=300, y=500, y=800

    // Add some plates to create the configuration
    addPlate(0, 1, [rod1, rod2], shelf); // Bottom plate between rod1 and rod2 at y=0
    addPlate(200, 1, [rod1, rod2], shelf); // Plate at y=200
    addPlate(700, 1, [rod2, rod3], shelf); // Top plate (rod2 at 700, rod3 at 800 needs extension)

    regenerateGhostPlates(shelf);

    // Get actual rod data
    const rod2Data = shelf.rods.get(rod2)!;

    // The bug: Ghosts are being generated that include a rod at a height
    // where that rod has NO attachment point. This is illegal!

    // Get rod2's absolute attachment Y positions
    const rod2AbsoluteYs = rod2Data.attachmentPoints.map(ap => rod2Data.position.y + ap.y);

    // Find ghosts involving rod2 at heights where rod2 has no attachment point
    const illegalGhosts = shelf.ghostPlates.filter(g => {
      if (!g.legal || !g.connections?.includes(rod2)) return false;
      const ghostY = g.midpointPosition.y;
      // Check if rod2 has an attachment at this height (within tolerance)
      const hasAttachment = rod2AbsoluteYs.some(y => Math.abs(y - ghostY) < 1);
      return !hasAttachment;
    });

    assertTrue(illegalGhosts.length === 0, `Should NOT have ghost plates involving rod2 at heights where rod2 has no attachment (found ${illegalGhosts.length})`);
  });

  //   test('Single rod extend up 200mm has correct modification data', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: spans=[200]
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf); // Plate at top of rods
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Look for ghost above current plate that would extend rods
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > 200 && g.rodModifications && g.rodModifications.length > 0
  //     );
  // 
  //     assertTrue(extendGhost !== undefined, 'Should have upward extension ghost');
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend');
  //       assertTrue(rodMod !== undefined, 'Should have extend modification');
  // 
  //       if (rodMod) {
  //         assertEquals(rodMod.type, 'extend', 'Modification type should be extend');
  //         assertEquals(rodMod.direction, 'up', 'Extension direction should be up');
  //         assertTrue(rodMod.newSkuId !== undefined, 'Should have new SKU');
  //         assertTrue(rodMod.visualHeight !== undefined && rodMod.visualHeight > 0,
  //           'Should have positive visual height');
  //         assertTrue(rodMod.visualY !== undefined, 'Should have visual Y position');
  //         assertTrue(rodMod.affectedRodIds !== undefined && rodMod.affectedRodIds.length > 0,
  //           'Should affect at least one rod');
  //       }
  //     }
  //   });
  // 
  //   test('Rod extend up progresses SKU correctly (2P_2 -> 3P_22)', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: sku_id=2, spans=[200]
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > 200 && g.rodModifications
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend');
  //       if (rodMod) {
  //         // 2P_2 extended up by 200mm should become 3P_22 (sku_id=4)
  //         assertEquals(rodMod.newSkuId, 4, 'Extended SKU should be 3P_22 (sku_id=4)');
  //       }
  //     }
  //   });
  // 
  //   test('Rod extend up with 300mm gap uses correct SKU (2P_2 -> 3P_23)', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Look for ghost 300mm above (if it exists)
  //     const extendGhost300 = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y === 500 && g.rodModifications
  //     );
  // 
  //     if (extendGhost300 && extendGhost300.rodModifications) {
  //       const rodMod = extendGhost300.rodModifications.find(m => m.type === 'extend');
  //       if (rodMod) {
  //         // 2P_2 extended up by 300mm should become 3P_23 (sku_id=5)
  //         assertEquals(rodMod.newSkuId, 5, 'Extended SKU should be 3P_23 (sku_id=5)');
  //       }
  //     }
  //   });
  // 
  //   test('Paired rods extend up together with multiple modifications', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf); // 2P_2
  //     addPlate(200, 1, [rod1, rod2], shelf); // Plate connecting both at top
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > 200 && g.rodModifications && g.rodModifications.length >= 2
  //     );
  // 
  //     assertTrue(extendGhost !== undefined, 'Should have ghost extending both rods');
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const extendMods = extendGhost.rodModifications.filter(m => m.type === 'extend');
  //       assertEquals(extendMods.length, 2, 'Should have 2 rod extension modifications');
  // 
  //       extendMods.forEach(mod => {
  //         assertEquals(mod.direction, 'up', 'Both extensions should be upward');
  //         assertTrue(mod.affectedRodIds !== undefined && mod.affectedRodIds.length === 1,
  //           'Each modification should affect exactly one rod');
  //       });
  //     }
  //   });
  // 
  //   test('Extension visual positioning is correct', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2, top at y=200
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > 200 && g.rodModifications
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend');
  //       if (rodMod) {
  //         assertTrue(rodMod.visualY !== undefined && rodMod.visualY >= 200,
  //           'Visual Y should be at or above current top (200)');
  //         assertTrue(rodMod.visualHeight !== undefined, 'Should have visual height');
  // 
  //         // visualHeight should match the added span
  //         const expectedHeight = rodMod.visualHeight;
  //         assertTrue(expectedHeight === 200 || expectedHeight === 300,
  //           'Visual height should be 200mm or 300mm');
  //       }
  //     }
  //   });
  // 
  //   test('Cannot extend beyond maximum available SKU', () => {
  //     const shelf = createEmptyShelf();
  //     // Create rods with maximum attachment points
  //     const maxRodSKU = AVAILABLE_RODS[AVAILABLE_RODS.length - 1]; // 7P_322322
  //     const rod1 = addRod({ x: 0, y: 0 }, maxRodSKU.sku_id, shelf);
  //     const rod2 = addRod({ x: 600, y: 0 }, maxRodSKU.sku_id, shelf);
  // 
  //     // Get the top attachment point
  //     const topY = maxRodSKU.spans.reduce((sum, span) => sum + span, 0);
  //     addPlate(topY, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Should not have any upward extension ghosts above this plate
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > topY &&
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'extend' && m.direction === 'up')
  //     );
  // 
  //     assertEquals(extendGhost, undefined, 'Should not have upward extension ghost for maximum rod');
  //   });
  // });
  // 
  // testGroup('Ghost Plate Generation - Rod Extension Downward', () => {
  //   test('Single rod extend down 200mm has correct modification data', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 200 }, 2, shelf); // 2P_2 starting at y=200
  //     const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf); // Plate at bottom of rods
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Look for ghost below current plate
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y < 200 && g.rodModifications && g.rodModifications.length > 0
  //     );
  // 
  //     assertTrue(extendGhost !== undefined, 'Should have downward extension ghost');
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend');
  //       assertTrue(rodMod !== undefined, 'Should have extend modification');
  // 
  //       if (rodMod) {
  //         assertEquals(rodMod.type, 'extend', 'Modification type should be extend');
  //         assertEquals(rodMod.direction, 'down', 'Extension direction should be down');
  //         assertTrue(rodMod.visualY !== undefined && rodMod.visualY < 200,
  //           'Visual Y should be below current bottom (200)');
  //       }
  //     }
  //   });
  // 
  //   test('Rod extend down progresses SKU correctly', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 200 }, 2, shelf); // 2P_2
  //     const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y < 200 && g.rodModifications
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend' && m.direction === 'down');
  //       if (rodMod) {
  //         // 2P_2 extended down should become 3P_22 or 3P_32 depending on span
  //         const newSKU = AVAILABLE_RODS.find(r => r.sku_id === rodMod.newSkuId);
  //         assertTrue(newSKU !== undefined, 'New SKU should exist');
  //         assertTrue(newSKU?.spans.length === 2, 'New SKU should have 2 spans (3 points)');
  //       }
  //     }
  //   });
  // 
  //   test('Paired rods extend down together', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 200 }, 2, shelf);
  //     const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y < 200 && g.rodModifications && g.rodModifications.length >= 2
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const extendMods = extendGhost.rodModifications.filter(m => m.type === 'extend');
  //       assertTrue(extendMods.length >= 2, 'Should have at least 2 rod extension modifications');
  // 
  //       extendMods.forEach(mod => {
  //         assertEquals(mod.direction, 'down', 'Extensions should be downward');
  //       });
  //     }
  //   });
  // 
  //   test('Downward extension visual segment appears below rod', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 200 }, 2, shelf);
  //     const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y < 200 && g.rodModifications
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend' && m.direction === 'down');
  //       if (rodMod && rodMod.visualY !== undefined && rodMod.visualHeight !== undefined) {
  //         // For downward extension, visualY should be below the current rod bottom
  //         // and visualY + visualHeight should not exceed the current bottom
  //         assertTrue(rodMod.visualY < 200, 'Visual segment should start below current bottom');
  //         assertTrue(rodMod.visualHeight > 0, 'Visual height should be positive');
  //       }
  //     }
  //   });
  // 
  //   test('Rod position adjustment for downward extension is understood', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 200 }, 2, shelf); // 2P_2
  //     const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
  //     addPlate(200, 1, [rod1, rod2], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const extendGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y < 200 && g.rodModifications
  //     );
  // 
  //     if (extendGhost && extendGhost.rodModifications) {
  //       const rodMod = extendGhost.rodModifications.find(m => m.type === 'extend' && m.direction === 'down');
  //       assertTrue(rodMod !== undefined, 'Should have downward extension modification');
  // 
  //       // The modification should indicate that the rod position will change
  //       // (rod.position.y decreases when extending down to keep top fixed)
  //       assertTrue(rodMod?.affectedRodIds !== undefined && rodMod.affectedRodIds.length > 0,
  //         'Should track which rods are affected');
  //     }
  //   });
  // });
  // 
  // testGroup('Ghost Plate Generation - Rod Merging', () => {
  //   test('Merge two rods with 200mm gap produces correct modification', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: ends at y=200
  //     const rod2 = addRod({ x: 0, y: 400 }, 2, shelf); // 2P_2: starts at y=400
  //     // 200mm gap between rods (200 to 400)
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Look for merge ghost in the gap - may be at various Y positions
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.midpointPosition.y > 200 && g.midpointPosition.y < 400 &&
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     // If merge ghost exists, validate its structure
  //     // (merge ghost generation requires specific conditions that may not be met with just two isolated rods)
  //     if (mergeGhost && mergeGhost.rodModifications) {
  //       const mergeMod = mergeGhost.rodModifications.find(m => m.type === 'merge');
  // 
  //       if (mergeMod) {
  //         assertEquals(mergeMod.type, 'merge', 'Modification type should be merge');
  //         assertTrue(mergeMod.newSkuId !== undefined, 'Should have merged SKU');
  //         assertTrue(mergeMod.affectedRodIds !== undefined && mergeMod.affectedRodIds.length === 2,
  //           'Should affect exactly 2 rods');
  // 
  //         // Merged SKU should have 4 spans total (2P_2 + gap + 2P_2)
  //         const mergedSKU = AVAILABLE_RODS.find(r => r.sku_id === mergeMod.newSkuId);
  //         assertTrue(mergedSKU !== undefined, 'Merged SKU should exist');
  //         if (mergedSKU) {
  //           assertTrue(mergedSKU.spans.length >= 3, 'Merged rod should have at least 3 spans');
  //         }
  //       }
  //     }
  //   });
  // 
  //   test('Merge with 300mm gap produces correct SKU', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2: [200]
  //     const rod2 = addRod({ x: 0, y: 500 }, 2, shelf); // 2P_2: [200], starts at 500
  //     // 300mm gap between rods
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.midpointPosition.y > 200 && g.midpointPosition.y < 500 &&
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     if (mergeGhost && mergeGhost.rodModifications) {
  //       const mergeMod = mergeGhost.rodModifications.find(m => m.type === 'merge');
  //       if (mergeMod) {
  //         // Merged pattern should be [200, 300, 200]
  //         const mergedSKU = AVAILABLE_RODS.find(r => r.sku_id === mergeMod.newSkuId);
  //         assertTrue(mergedSKU !== undefined, 'Merged SKU should exist');
  // 
  //         // Could be 4P_232 or similar depending on gap calculation
  //         assertTrue(mergedSKU?.spans.length === 3, 'Merged rod should have 3 spans');
  //       }
  //     }
  //   });
  // 
  //   test('Merge with mixed span patterns creates correct combined SKU', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 3, shelf); // 2P_3: [300]
  //     const rod2 = addRod({ x: 0, y: 500 }, 2, shelf); // 2P_2: [200], starts at 500
  //     // 200mm gap between rods (300 to 500)
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.midpointPosition.y > 300 && g.midpointPosition.y < 500 &&
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     if (mergeGhost && mergeGhost.rodModifications) {
  //       const mergeMod = mergeGhost.rodModifications.find(m => m.type === 'merge');
  //       if (mergeMod) {
  //         // Merged pattern should be [300, 200, 200]
  //         const mergedSKU = AVAILABLE_RODS.find(r => r.sku_id === mergeMod.newSkuId);
  //         assertTrue(mergedSKU !== undefined, 'Merged SKU should exist for mixed pattern');
  //       }
  //     }
  //   });
  // 
  //   test('Merged rod positioning is correct', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);
  //     const rod2 = addRod({ x: 0, y: 400 }, 2, shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     if (mergeGhost && mergeGhost.rodModifications) {
  //       const mergeMod = mergeGhost.rodModifications.find(m => m.type === 'merge');
  //       if (mergeMod) {
  //         // Merged rod should be positioned at bottom rod's position
  //         assertEquals(mergeMod.position.y, 0, 'Merged rod should start at bottom rod position');
  //         assertEquals(mergeMod.position.x, 0, 'Merged rod should maintain X position');
  //       }
  //     }
  //   });
  // 
  //   test('Invalid merge gap does not produce legal ghost', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // ends at 200
  //     const rod2 = addRod({ x: 0, y: 450 }, 2, shelf); // starts at 450
  //     // 250mm gap - not a standard gap (should be 200 or 300)
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Should not have a legal merge ghost with 250mm gap
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.legal && g.midpointPosition.y > 200 && g.midpointPosition.y < 450 &&
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     // This might exist as illegal ghost, or not exist at all - both are acceptable
  //     if (mergeGhost) {
  //       assertEquals(mergeGhost.legal, false, 'Ghost with invalid gap should not be legal');
  //     }
  //   });
  // 
  //   test('Merge modification affects both rods', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);
  //     const rod2 = addRod({ x: 0, y: 400 }, 2, shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const mergeGhost = shelf.ghostPlates.find(g =>
  //       g.rodModifications && g.rodModifications.some(m => m.type === 'merge')
  //     );
  // 
  //     if (mergeGhost && mergeGhost.rodModifications) {
  //       const mergeMod = mergeGhost.rodModifications.find(m => m.type === 'merge');
  //       if (mergeMod && mergeMod.affectedRodIds) {
  //         assertEquals(mergeMod.affectedRodIds.length, 2, 'Merge should affect both rods');
  //         assertTrue(mergeMod.affectedRodIds.includes(1), 'Should include first rod ID');
  //         assertTrue(mergeMod.affectedRodIds.includes(2), 'Should include second rod ID');
  //       }
  //     }
  //   });
  // });
  // 
  // testGroup('Ghost Plate Generation - Edge Cases & Validation', () => {
  //   test('Ghost positions are unique (no duplicates)', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf);
  //     const rod3 = addRod({ x: 1200, y: 0 }, 2, shelf);
  //     addPlate(0, 1, [rod1, rod2], shelf);
  //     addPlate(0, 1, [rod2, rod3], shelf);
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     const positions = shelf.ghostPlates.map(g =>
  //       `${g.midpointPosition.x},${g.midpointPosition.y}`
  //     );
  //     const uniquePositions = new Set(positions);
  // 
  //     assertEquals(positions.length, uniquePositions.size,
  //       'All ghost plate positions should be unique');
  //   });
  // 
  //   test('Complex shelf generates all expected ghost types', () => {
  //     const shelf = createEmptyShelf();
  //     const rod1 = addRod({ x: 0, y: 0 }, 2, shelf); // 2P_2
  //     const rod2 = addRod({ x: 600, y: 0 }, 2, shelf); // 2P_2
  //     const rod3 = addRod({ x: 1200, y: 400 }, 2, shelf); // 2P_2 at different height
  //     addPlate(200, 1, [rod1, rod2], shelf); // Plate connecting rod1 and rod2
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Should have various ghost types
  //     const hasCreateGhost = shelf.ghostPlates.some(g =>
  //       g.legal && g.action === 'create'
  //     );
  //     const hasExtendGhost = shelf.ghostPlates.some(g =>
  //       g.legal && g.rodModifications && g.rodModifications.some(m => m.type === 'extend')
  //     );
  // 
  //     assertTrue(hasCreateGhost, 'Should have at least one create ghost');
  //     assertTrue(hasExtendGhost, 'Should have at least one extend ghost');
  //   });
  // 
  //   test('Empty shelf with no rods has no ghosts', () => {
  //     const shelf = createEmptyShelf();
  //     regenerateGhostPlates(shelf);
  // 
  //     assertEquals(shelf.ghostPlates.length, 0,
  //       'Empty shelf should have no ghost plates');
  //   });
  // 
  //   test('Shelf with single isolated rod has appropriate ghosts', () => {
  //     const shelf = createEmptyShelf();
  //     addRod({ x: 0, y: 0 }, 1, shelf); // Single 1P rod
  // 
  //     regenerateGhostPlates(shelf);
  // 
  //     // Single isolated rod with no plates should not generate ghosts
  //     // (need at least 2 rods and a plate to create extension/creation ghosts)
  //     assertEquals(shelf.ghostPlates.length, 0,
  //       'Single rod with no plates should have no ghosts');
  //   });
});


printResults();
