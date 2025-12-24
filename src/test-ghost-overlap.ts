import { createEmptyShelf, addRod, regenerateGhostRods, getRodSKU } from './shelf-model.js';
import { getRodHeight } from './shelf-utils.js';

console.log('\n=== Testing Ghost Rod Overlap Behavior ===\n');

// Create a scenario where ghost rods would overlap with real rods
const shelf = createEmptyShelf();

// Add two 1P rods at X=0 with a 200mm gap
const rod1 = addRod({ x: 0, y: 0 }, 1, shelf);      // 1P at Y=0
const rod2 = addRod({ x: 0, y: 200 }, 1, shelf);    // 1P at Y=200

regenerateGhostRods(shelf);

console.log('Setup:');
console.log('  Two 1P rods at X=0 with 200mm gap');
console.log(`  Rod ${rod1}: 1P at (0, 0)`);
console.log(`  Rod ${rod2}: 1P at (0, 200)`);

console.log(`\nGhost rods generated: ${shelf.ghostRods.length}`);
if (shelf.ghostRods.length > 0) {
  const ghost = shelf.ghostRods[0];
  const sku = getRodSKU(ghost.sku_id);
  console.log(`  Ghost rod: ${sku?.name} spanning from (0, 0) to (0, 200)`);
  console.log(`  Height: ${getRodHeight(getRodSKU(ghost.sku_id)!)}mm`);
  console.log('');
  console.log('Visual behavior:');
  console.log('  - Ghost rod has radius 12mm (vs 14mm for real rods)');
  console.log('  - Ghost rod renders behind real rods (renderOrder = -1)');
  console.log('  - When ghost overlaps with real rods, real rods are visible');
  console.log('  - Clicking on overlapping area hits real rods first');
}

console.log('\nExpected interaction behavior:');
console.log('  1. Clicking rod1 or rod2 directly: operates on the real rod');
console.log('  2. Clicking the gap area: operates on the ghost rod');
console.log('  3. Real rods always take priority over ghost rods');
