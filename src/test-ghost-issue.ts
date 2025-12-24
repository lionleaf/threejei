import { createEmptyShelf, addRod, addPlate, regenerateGhostRods, getRodSKU, regenerateGhostPlates } from './shelf-model.js';

console.log('\n=== Testing Ghost Rod Issue ===\n');

// Recreate the shelf from the user's description:
// r: [[0,4],[600,4],[1200,200,1]]
// This means:
//   [0, 4] - Rod at X=0, SKU=4 (3P_22)
//   [600, 4] - Rod at X=600, SKU=4 (3P_22)
//   [1200, 200, 1] - Rod at X=1200, Y=200, SKU=1 (1P)
//
// p: [[0,1,[0,1]],[200,3,[0,1,2]],[400,1,[0,1]]]
// This means:
//   [0, 1, [0,1]] - Plate at Y=0, SKU=1 (670mm), connecting rods 0,1
//   [200, 3, [0,1,2]] - Plate at Y=200, SKU=3 (1870mm), connecting rods 0,1,2
//   [400, 1, [0,1]] - Plate at Y=400, SKU=1 (670mm), connecting rods 0,1

const shelf = createEmptyShelf();
const rod0 = addRod({ x: 0, y: 0 }, 4, shelf);      // 3P_22 at X=0, Y=0
const rod1 = addRod({ x: 600, y: 0 }, 4, shelf);    // 3P_22 at X=600, Y=0
const rod2 = addRod({ x: 1200, y: 200 }, 1, shelf); // 1P at X=1200, Y=200

addPlate(0, 1, [rod0, rod1], shelf);        // 670mm plate at Y=0
addPlate(200, 3, [rod0, rod1, rod2], shelf); // 1870mm plate at Y=200
addPlate(400, 1, [rod0, rod1], shelf);       // 670mm plate at Y=400

console.log('Decoded shelf:');
console.log('Rods:');
for (const [rodId, rod] of shelf.rods) {
  const sku = getRodSKU(rod.sku_id);
  console.log(`  Rod ${rodId}: ${sku?.name} at (${rod.position.x}, ${rod.position.y})`);
  console.log(`    Attachment points: ${rod.attachmentPoints.map(ap => ap.y).join(', ')}`);
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
  const sku = getRodSKU(ghost.newSkuId);
  const bottomRod = shelf.rods.get(ghost.bottomRodId);
  const topRod = shelf.rods.get(ghost.topRodId);
  const bottomSKU = bottomRod ? getRodSKU(bottomRod.sku_id) : null;
  const topSKU = topRod ? getRodSKU(topRod.sku_id) : null;

  console.log(`\nGhost ${i}:`);
  console.log(`  Merging: Rod ${ghost.bottomRodId} (${bottomSKU?.name}) + Rod ${ghost.topRodId} (${topSKU?.name})`);
  console.log(`  Result: ${sku?.name} with spans [${sku?.spans}]`);
  console.log(`  Position: (${ghost.position.x}, ${ghost.position.y})`);
  console.log(`  Height: ${ghost.height}mm`);
  console.log(`  Legal: ${ghost.legal}`);

  if (bottomRod && topRod) {
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
  }
});

// Also check ghost plates for comparison
regenerateGhostPlates(shelf);
console.log(`\nFor comparison, found ${shelf.ghostPlates.length} ghost plates`);
