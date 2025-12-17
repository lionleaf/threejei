import { createEmptyShelf, addRod, addPlate, regenerateGhostPlates } from './shelf-model.js';

/**
 * Test for ghost plate collision detection.
 *
 * This test reproduces a bug where ghost plates are suggested at positions
 * that would intersect with existing rod bodies at positions without attachment points.
 *
 * Configuration:
 * - Rods 0-1: x=0,600 y=-300 (5P_3223: attachment points at -300, 0, 200, 400, 700)
 * - Rods 2-3: x=1200,1800 y=-200 (4P_223: attachment points at -200, 0, 200, 500)
 * - Plates at various heights connecting both rod pairs
 *
 * Expected bug:
 * - Ghost plate suggested at y=500 between rods 0-1
 * - This is INVALID because rods 0-1 have no attachment point at y=500
 * - The ghost plate would pass through the rod body without a connection
 */
function testGhostPlateCollision() {
  console.log('=== Testing Ghost Plate Collision Detection ===\n');

  const shelf = createEmptyShelf();

  // Create the shelf configuration
  console.log('Creating shelf with mixed rod patterns...');

  // Left pair: 5P_3223 rods at y=-300
  const rod0 = addRod({ x: 0, y: -300 }, 13, shelf);      // sku_id 13 = 5P_3223
  const rod1 = addRod({ x: 600, y: -300 }, 13, shelf);    // sku_id 13 = 5P_3223

  // Right pair: 4P_223 rods at y=-200
  const rod2 = addRod({ x: 1200, y: -200 }, 7, shelf);    // sku_id 7 = 4P_223
  const rod3 = addRod({ x: 1800, y: -200 }, 7, shelf);    // sku_id 7 = 4P_223

  console.log('Rods created:');
  console.log(`  Rod ID ${rod0} (x=0, y=-300, 5P_3223): attachment points at -300, 0, 200, 400, 700`);
  console.log(`  Rod ID ${rod1} (x=600, y=-300, 5P_3223): attachment points at -300, 0, 200, 400, 700`);
  console.log(`  Rod ID ${rod2} (x=1200, y=-200, 4P_223): attachment points at -200, 0, 200, 500`);
  console.log(`  Rod ID ${rod3} (x=1800, y=-200, 4P_223): attachment points at -200, 0, 200, 500\n`);

  // Add plates on left pair (rods 0-1)
  addPlate(0, 1, [rod0, rod1], shelf);      // y=0 (valid: both have attachment)
  addPlate(200, 1, [rod0, rod1], shelf);    // y=200 (valid: both have attachment)
  addPlate(400, 1, [rod0, rod1], shelf);    // y=400 (valid: both have attachment)
  addPlate(-300, 1, [rod0, rod1], shelf);   // y=-300 (valid: both have attachment)
  addPlate(700, 1, [rod0, rod1], shelf);    // y=700 (valid: both have attachment)

  // Add plates on right pair (rods 2-3)
  addPlate(200, 1, [rod2, rod3], shelf);    // y=200 (valid: both have attachment)
  addPlate(0, 1, [rod2, rod3], shelf);      // y=0 (valid: both have attachment)
  addPlate(-200, 1, [rod2, rod3], shelf);   // y=-200 (valid: both have attachment)
  addPlate(500, 1, [rod2, rod3], shelf);    // y=500 (valid: both have attachment)

  console.log('Plates added at valid attachment points\n');

  // Regenerate ghost plates
  regenerateGhostPlates(shelf);

  console.log(`Generated ${shelf.ghostPlates.length} ghost plates\n`);

  // Check for problematic ghost plates between rods 0-1 (5P_3223 at x=0,600)
  // These rods have attachment points ONLY at: -300, 0, 200, 400, 700
  // Any ghost plate at a different Y position would pass through the rod without connecting
  let foundInvalidGhost = false;
  const validAttachmentYs = [-300, 0, 200, 400, 700]; // For 5P_3223 rods at y=-300

  shelf.ghostPlates.forEach((ghost, index) => {
    const rodIds = ghost.connections || [];
    const y = ghost.midpointPosition.y;
    const x = ghost.midpointPosition.x;

    // Check if this is a ghost plate between the left pair of rods (x=0,600, midpoint=300)
    if (Math.abs(x - 300) < 1) {
      // Check if this Y position is NOT at a valid attachment point
      const isValidY = validAttachmentYs.some(validY => Math.abs(y - validY) < 1);

      if (!isValidY && rodIds.includes(rod0) && rodIds.includes(rod1)) {
        console.log(`❌ FOUND INVALID GHOST PLATE (index ${index}):`);
        console.log(`   Position: x=${x}, y=${y}`);
        console.log(`   Connecting rods: ${rodIds.join(', ')}`);
        console.log(`   Legal: ${ghost.legal}`);
        console.log(`   Problem: Rods ${rod0} and ${rod1} (5P_3223 at x=0,600) have NO attachment point at y=${y}`);
        console.log(`   Valid attachment points: ${validAttachmentYs.join(', ')}`);
        console.log(`   This ghost plate would pass through the rod body without connecting!\n`);
        foundInvalidGhost = true;
      }
    }
  });

  // Print all ghost plates for debugging
  console.log('All ghost plates:');
  shelf.ghostPlates.forEach((ghost, index) => {
    const rodIds = ghost.connections || [];
    const xPos = ghost.midpointPosition.x;
    console.log(`  ${index}: y=${ghost.midpointPosition.y}, x=${xPos}, rods=[${rodIds.join(', ')}], legal=${ghost.legal}`);
  });
  console.log('');

  // Test assertion
  if (foundInvalidGhost) {
    console.log('❌ TEST FAILED: Found ghost plate at y=500 between rods without attachment points');
    console.log('   Expected: No ghost plate should be suggested at y=500 for rods 0-1');
    console.log('   Actual: Ghost plate incorrectly suggested at invalid position\n');
    return false;
  } else {
    console.log('✓ TEST PASSED: No invalid ghost plate at y=500 between rods 0-1');
    console.log('  Ghost plate validation correctly prevented invalid placement\n');
    return true;
  }
}

// Run the test
const passed = testGhostPlateCollision();
console.log('=== Test Complete ===');
if (!passed) {
  throw new Error('Test failed');
}
