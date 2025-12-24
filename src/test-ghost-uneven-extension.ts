import { createEmptyShelf, addRod, addPlate, regenerateGhostPlates, getRodSKU } from './shelf-model.js';

console.log('\n=== Testing Ghost Extension with Uneven Rods ===\n');

// Recreate the shelf from the user's description:
// r: [[0,4],[600,4],[1200,200,1]]
// p: [[0,1,[0,1]],[200,3,[0,1,2]],[400,1,[0,1]]]

const shelf = createEmptyShelf();
const rod0 = addRod({ x: 0, y: 0 }, 4, shelf);      // 3P_22 at X=0, Y=0
const rod1 = addRod({ x: 600, y: 0 }, 4, shelf);    // 3P_22 at X=600, Y=0
const rod2 = addRod({ x: 1200, y: 200 }, 1, shelf); // 1P at X=1200, Y=200

addPlate(0, 1, [rod0, rod1], shelf);        // 670mm plate at Y=0
addPlate(200, 3, [rod0, rod1, rod2], shelf); // 1870mm plate at Y=200
addPlate(400, 1, [rod0, rod1], shelf);       // 670mm plate at Y=400

console.log('=== Rods ===');
for (const [rodId, rod] of shelf.rods) {
  const sku = getRodSKU(rod.sku_id);
  console.log(`Rod ${rodId}: ${sku?.name} at X=${rod.position.x}, Y=${rod.position.y}`);
  console.log(`  Attachment points (relative Y): [${rod.attachmentPoints.map(ap => ap.y)}]`);
  console.log(`  Attachment points (absolute Y): [${rod.attachmentPoints.map(ap => rod.position.y + ap.y)}]`);
  const topY = rod.position.y + (rod.attachmentPoints.length > 0
    ? rod.attachmentPoints[rod.attachmentPoints.length - 1].y
    : 0);
  console.log(`  Top of rod: Y=${topY}`);
}

console.log('\n=== Plates ===');
for (const [plateId, plate] of shelf.plates) {
  console.log(`Plate ${plateId}: SKU ${plate.sku_id} at Y=${plate.y}, connections=[${plate.connections}]`);
}

// Regenerate ghost plates
console.log('\n=== Regenerating Ghost Plates ===');
regenerateGhostPlates(shelf);

console.log(`\nFound ${shelf.ghostPlates.length} ghost plates:`);
for (let i = 0; i < shelf.ghostPlates.length; i++) {
  const ghost = shelf.ghostPlates[i];
  console.log(`\nGhost ${i}:`);
  console.log(`  Y=${ghost.midpointPosition.y}, X=${ghost.midpointPosition.x}`);
  console.log(`  Connections: [${ghost.connections}]`);
  console.log(`  Legal: ${ghost.legal}`);
  console.log(`  Action: ${ghost.action}`);

  if (ghost.rodModifications) {
    console.log(`  Rod Modifications:`);
    for (const mod of ghost.rodModifications) {
      const rod = mod.affectedRodIds ? shelf.rods.get(mod.affectedRodIds[0]) : undefined;
      const oldSKU = rod ? getRodSKU(rod.sku_id) : undefined;
      const newSKU = mod.newSkuId ? getRodSKU(mod.newSkuId) : undefined;

      console.log(`    ${mod.type} Rod ${mod.affectedRodIds} ${mod.direction}`);
      console.log(`      ${oldSKU?.name} -> ${newSKU?.name}`);
      console.log(`      Visual Y: ${mod.visualY}, Visual Height: ${mod.visualHeight}`);

      if (rod && mod.visualY !== undefined && mod.visualHeight !== undefined) {
        const extensionTop = mod.direction === 'up'
          ? mod.visualY + mod.visualHeight
          : rod.position.y + (rod.attachmentPoints.length > 0 ? rod.attachmentPoints[rod.attachmentPoints.length - 1].y : 0);
        console.log(`      Extension reaches Y=${extensionTop}`);
      }
    }
  }
}

console.log('\n=== Analysis ===');
console.log('Rod 0 and Rod 1 both have tops at Y=400');
console.log('The upward extension ghost should be at Y=600 (400 + 200mm extension)');
console.log('BOTH rod modifications should extend their rods to reach Y=600');
console.log('\nBug: The ghost Y position is calculated using only the LEFT rod\'s spanToAdd,');
console.log('     which can cause misalignment when rods have different heights.');
