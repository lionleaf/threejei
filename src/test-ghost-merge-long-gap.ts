import { createEmptyShelf, addRod, regenerateGhostRods, getRodSKU } from './shelf-model.js';

console.log('\n=== Testing Ghost Rod Merge Across Long Gap ===\n');

// Two 2P_2 rods (sku 2) positioned so their attachments match a 6P_22322 SKU
// 6P_22322 spans: [200,200,300,200,200] -> attachment Ys: 0,200,400,700,900,1100
// Place bottom 2P_2 at y=0 (attachments 0,200) and top 2P_2 at y=900 (attachments 900,1100)
const shelf = createEmptyShelf();
const rodA = addRod({ x: 0, y: 0 }, 2, shelf);   // 2P_2 at Y=0 (attachments 0,200)
const rodB = addRod({ x: 0, y: 900 }, 2, shelf); // 2P_2 at Y=900 (attachments 900,1100)

regenerateGhostRods(shelf);

console.log('Rods added:');
console.log(`  Rod A: ${getRodSKU(shelf.rods.get(rodA)!.sku_id)!.name} at Y=${shelf.rods.get(rodA)!.position.y}`);
console.log(`  Rod B: ${getRodSKU(shelf.rods.get(rodB)!.sku_id)!.name} at Y=${shelf.rods.get(rodB)!.position.y}`);
console.log(`Ghost rods generated: ${shelf.ghostRods.length}`);

if (shelf.ghostRods.length > 0) {
    const ghost = shelf.ghostRods[0];
    console.log(`  Ghost rod SKU: ${getRodSKU(ghost.sku_id)!.name} (sku_id=${ghost.sku_id})`);
    console.log(`  Bottom rod ID: ${ghost.bottomRodId}, Top rod ID: ${ghost.topRodId}`);
    console.log(`  Expected SKU: 6P_22322 (sku_id=13)`);
} else {
    console.log('  No ghost rods generated — test failed');
}

console.log('\n=== Test Complete ===');
