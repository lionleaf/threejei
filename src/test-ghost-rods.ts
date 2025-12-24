import { createEmptyShelf, addRod, regenerateGhostRods, getRodSKU } from './shelf-model.js';

console.log('\n=== Testing Ghost Rod Generation ===\n');

// Test 1: Two rods at same X with 200mm gap should create ghost rod
const shelf1 = createEmptyShelf();
const rod1 = addRod({ x: 0, y: 0 }, 1, shelf1); // 1P at Y=0
const rod2 = addRod({ x: 0, y: 200 }, 1, shelf1); // 1P at Y=200 (200mm gap)

regenerateGhostRods(shelf1);

console.log('Test 1: Two 1P rods with 200mm gap');
console.log(`  Rod 1: ${getRodSKU(shelf1.rods.get(rod1)!.sku_id)!.name} at Y=${shelf1.rods.get(rod1)!.position.y}`);
console.log(`  Rod 2: ${getRodSKU(shelf1.rods.get(rod2)!.sku_id)!.name} at Y=${shelf1.rods.get(rod2)!.position.y}`);
console.log(`  Ghost rods generated: ${shelf1.ghostRods.length}`);

if (shelf1.ghostRods.length > 0) {
  const ghost = shelf1.ghostRods[0];
  console.log(`  Ghost rod SKU: ${getRodSKU(ghost.newSkuId)!.name}`);
  console.log(`  Bottom rod ID: ${ghost.bottomRodId}, Top rod ID: ${ghost.topRodId}`);
  console.log(`  Legal: ${ghost.legal}`);
  console.log(`  Expected: Should merge into 2P_2 (one 200mm span)`);
}
console.log('');

// Test 2: Two rods at same X with 300mm gap
const shelf2 = createEmptyShelf();
const rod3 = addRod({ x: 0, y: 0 }, 1, shelf2); // 1P at Y=0
const rod4 = addRod({ x: 0, y: 300 }, 1, shelf2); // 1P at Y=300 (300mm gap)

regenerateGhostRods(shelf2);

console.log('Test 2: Two 1P rods with 300mm gap');
console.log(`  Rod 3: ${getRodSKU(shelf2.rods.get(rod3)!.sku_id)!.name} at Y=${shelf2.rods.get(rod3)!.position.y}`);
console.log(`  Rod 4: ${getRodSKU(shelf2.rods.get(rod4)!.sku_id)!.name} at Y=${shelf2.rods.get(rod4)!.position.y}`);
console.log(`  Ghost rods generated: ${shelf2.ghostRods.length}`);

if (shelf2.ghostRods.length > 0) {
  const ghost = shelf2.ghostRods[0];
  console.log(`  Ghost rod SKU: ${getRodSKU(ghost.newSkuId)!.name}`);
  console.log(`  Bottom rod ID: ${ghost.bottomRodId}, Top rod ID: ${ghost.topRodId}`);
  console.log(`  Legal: ${ghost.legal}`);
  console.log(`  Expected: Should merge into 2P_3 (one 300mm span)`);
}
console.log('');

// Test 3: Rods at different X positions - should NOT create ghost rods
const shelf3 = createEmptyShelf();
const rod5 = addRod({ x: 0, y: 0 }, 1, shelf3); // 1P at X=0
const rod6 = addRod({ x: 600, y: 0 }, 1, shelf3); // 1P at X=600 (different X)

regenerateGhostRods(shelf3);

console.log('Test 3: Two rods at different X positions');
console.log(`  Rod 5: ${getRodSKU(shelf3.rods.get(rod5)!.sku_id)!.name} at X=${shelf3.rods.get(rod5)!.position.x}`);
console.log(`  Rod 6: ${getRodSKU(shelf3.rods.get(rod6)!.sku_id)!.name} at X=${shelf3.rods.get(rod6)!.position.x}`);
console.log(`  Ghost rods generated: ${shelf3.ghostRods.length}`);
console.log(`  Expected: 0 (rods not at same X position)`);
console.log('');

// Test 4: Three rods at same X - should create 2 ghost rods
const shelf4 = createEmptyShelf();
const rod7 = addRod({ x: 0, y: 0 }, 1, shelf4); // 1P at Y=0
const rod8 = addRod({ x: 0, y: 200 }, 1, shelf4); // 1P at Y=200
const rod9 = addRod({ x: 0, y: 400 }, 1, shelf4); // 1P at Y=400

regenerateGhostRods(shelf4);

console.log('Test 4: Three 1P rods at same X, consecutive 200mm gaps');
console.log(`  Rod 7: ${getRodSKU(shelf4.rods.get(rod7)!.sku_id)!.name} at Y=${shelf4.rods.get(rod7)!.position.y}`);
console.log(`  Rod 8: ${getRodSKU(shelf4.rods.get(rod8)!.sku_id)!.name} at Y=${shelf4.rods.get(rod8)!.position.y}`);
console.log(`  Rod 9: ${getRodSKU(shelf4.rods.get(rod9)!.sku_id)!.name} at Y=${shelf4.rods.get(rod9)!.position.y}`);
console.log(`  Ghost rods generated: ${shelf4.ghostRods.length}`);
console.log(`  Expected: 2 ghost rods (one for each consecutive pair)`);

if (shelf4.ghostRods.length > 0) {
  shelf4.ghostRods.forEach((ghost, i) => {
    console.log(`  Ghost ${i}: ${getRodSKU(ghost.newSkuId)!.name} (rods ${ghost.bottomRodId} + ${ghost.topRodId})`);
  });
}
console.log('');

console.log('=== Ghost Rod Tests Complete ===');
