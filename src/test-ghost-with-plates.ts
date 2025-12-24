import { createEmptyShelf, addRod, addPlate, regenerateGhostRods, getRodSKU, mergeRods } from './shelf-model.js';

console.log('\n=== Testing Ghost Rods with Plates Attached ===\n');

// Create two rods at same X with plates attached
const shelf = createEmptyShelf();
const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);    // 2P_2 at Y=0 (has attachment at Y=0 and Y=200)
const rod2 = addRod({ x: 0, y: 400 }, 2, shelf);  // 2P_2 at Y=400 (has attachment at Y=400 and Y=600)
const rod3 = addRod({ x: 600, y: 0 }, 4, shelf);  // 3P_22 for connecting plates

// Add a plate at Y=0
addPlate(0, 1, [rod1, rod3], shelf);

console.log('Setup:');
console.log('Rods:');
for (const [rodId, rod] of shelf.rods) {
  const sku = getRodSKU(rod.sku_id);
  console.log(`  Rod ${rodId}: ${sku?.name} at (${rod.position.x}, ${rod.position.y})`);
  console.log(`    Attachment points (absolute Y): ${rod.attachmentPoints.map(ap => rod.position.y + ap.y)}`);
}

console.log('\nPlates:');
for (const [plateId, plate] of shelf.plates) {
  console.log(`  Plate ${plateId}: SKU ${plate.sku_id} at Y=${plate.y}, connections=[${plate.connections}]`);
}

// Regenerate ghost rods
console.log('\nRegenerating ghost rods...');
regenerateGhostRods(shelf);

console.log(`\nFound ${shelf.ghostRods.length} ghost rods:`);
shelf.ghostRods.forEach((ghost, i) => {
  const sku = getRodSKU(ghost.sku_id);
  const bottomRod = shelf.rods.get(ghost.bottomRodId)!;
  const topRod = shelf.rods.get(ghost.topRodId)!;
  const bottomSKU = getRodSKU(bottomRod.sku_id)!;
  const topSKU = getRodSKU(topRod.sku_id)!;

  console.log(`\nGhost ${i}:`);
  console.log(`  Merging: Rod ${ghost.bottomRodId} (${bottomSKU.name}) + Rod ${ghost.topRodId} (${topSKU.name})`);
  console.log(`  Result: ${sku?.name} with spans [${sku?.spans}]`);
  console.log(`  Legal: ${ghost.legal}`);

  // Show what attachment points would be combined
  const combinedYs = [
    ...bottomRod.attachmentPoints.map(ap => bottomRod.position.y + ap.y),
    ...topRod.attachmentPoints.map(ap => topRod.position.y + ap.y)
  ].sort((a, b) => a - b);

  const gaps = [];
  for (let j = 0; j < combinedYs.length - 1; j++) {
    gaps.push(combinedYs[j + 1] - combinedYs[j]);
  }

  console.log(`  Combined attachment Ys: [${combinedYs}]`);
  console.log(`  Gaps: [${gaps}]`);
  console.log(`  Expected: Should create 4P_223 (gaps [200, 200, 300])`);
});

// Test clicking the ghost rod
if (shelf.ghostRods.length > 0) {
  const ghost = shelf.ghostRods[0];
  console.log('\n--- Testing Ghost Rod Click ---');
  console.log('Before merge:');
  console.log(`  Rods: ${Array.from(shelf.rods.keys())}`);
  console.log(`  Plates: ${Array.from(shelf.plates.keys())}`);

  mergeRods(ghost.bottomRodId, ghost.topRodId, ghost.sku_id, shelf);

  console.log('\nAfter merge:');
  console.log(`  Rods: ${Array.from(shelf.rods.keys())}`);
  for (const [rodId, rod] of shelf.rods) {
    const sku = getRodSKU(rod.sku_id);
    console.log(`    Rod ${rodId}: ${sku?.name} at (${rod.position.x}, ${rod.position.y})`);
    console.log(`      Attachment points (absolute Y): ${rod.attachmentPoints.map(ap => rod.position.y + ap.y)}`);
    console.log(`      Plates at points: ${rod.attachmentPoints.map(ap => ap.plateId ?? 'none')}`);
  }

  console.log(`  Plates: ${Array.from(shelf.plates.keys())}`);
  for (const [plateId, plate] of shelf.plates) {
    console.log(`    Plate ${plateId}: at Y=${plate.y}, connections=[${plate.connections}]`);
  }
}
