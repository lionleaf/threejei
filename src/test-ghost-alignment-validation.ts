import { createEmptyShelf, addRod, addPlate, regenerateGhostPlates, getRodSKU } from './shelf-model.js';

console.log('\n=== Testing Ghost Extension Alignment Validation ===\n');

// This test verifies that ghost plates for rod extensions are only created
// when BOTH rods extend to the same Y coordinate.

// Configuration:
// - Rod 0 at X=0, Y=0: 3P_22 (heights: 0, 200, 400)
// - Rod 1 at X=600, Y=0: 3P_22 (heights: 0, 200, 400)
// - Rod 2 at X=1200, Y=200: 1P (height: 200)
//
// If Rod 0 and Rod 1 both extend upward by 300mm:
//   - Rod 0: 400 + 300 = 700 ✓
//   - Rod 1: 400 + 300 = 700 ✓
//   - Result: Valid ghost at Y=700
//
// If Rod 1 and Rod 2 both extend upward by 300mm:
//   - Rod 1: 400 + 300 = 700
//   - Rod 2: 200 + 300 = 500
//   - Result: NO ghost (misaligned by 200mm) ✗

const shelf = createEmptyShelf();
const rod0 = addRod({ x: 0, y: 0 }, 4, shelf);      // 3P_22
const rod1 = addRod({ x: 600, y: 0 }, 4, shelf);    // 3P_22
const rod2 = addRod({ x: 1200, y: 200 }, 1, shelf); // 1P

addPlate(0, 1, [rod0, rod1], shelf);
addPlate(200, 3, [rod0, rod1, rod2], shelf);
addPlate(400, 1, [rod0, rod1], shelf);

regenerateGhostPlates(shelf);

// Find rod extension ghosts
const extensionGhosts = shelf.ghostPlates.filter(g => g.action === 'extend_rod');

console.log(`Found ${extensionGhosts.length} rod extension ghosts:\n`);

for (const ghost of extensionGhosts) {
  const rodIds = ghost.connections ?? [];
  const mods = ghost.rodModifications ?? [];

  console.log(`Ghost at Y=${ghost.midpointPosition.y}, X=${ghost.midpointPosition.x}`);
  console.log(`  Connecting rods: [${rodIds.join(', ')}]`);

  for (const mod of mods) {
    if (mod.type !== 'extend' || !mod.affectedRodIds || mod.affectedRodIds.length === 0) continue;

    const rodId = mod.affectedRodIds[0];
    const rod = shelf.rods.get(rodId);
    if (!rod) continue;

    const oldSKU = getRodSKU(rod.sku_id);
    const newSKU = mod.newSkuId ? getRodSKU(mod.newSkuId) : undefined;

    const extensionY = mod.direction === 'up'
      ? (mod.visualY ?? 0) + (mod.visualHeight ?? 0)
      : (mod.visualY ?? 0);

    console.log(`  Rod ${rodId} (${oldSKU?.name} -> ${newSKU?.name}):`);
    console.log(`    Extends ${mod.direction} to Y=${extensionY}`);
  }

  // Validate alignment
  const extensionYs = mods
    .filter(m => m.type === 'extend')
    .map(m => {
      return m.direction === 'up'
        ? (m.visualY ?? 0) + (m.visualHeight ?? 0)
        : (m.visualY ?? 0);
    });

  const allAligned = extensionYs.every(y => Math.abs(y - extensionYs[0]) < 1);
  console.log(`  ✓ All extensions aligned: ${allAligned ? 'YES' : 'NO'}\n`);
}

// Validate expectations
console.log('=== Validation ===');

// Should have ghost between Rod 0 and Rod 1 (both at same height)
const rod01Ghost = extensionGhosts.find(g =>
  g.connections?.includes(rod0) && g.connections?.includes(rod1)
);

if (rod01Ghost) {
  console.log('✓ Found valid ghost between Rod 0 and Rod 1 (aligned at Y=400)');
} else {
  console.log('✗ MISSING: Expected ghost between Rod 0 and Rod 1');
}

// Should NOT have ghost between Rod 1 and Rod 2 (different heights)
const rod12Ghost = extensionGhosts.find(g =>
  g.connections?.includes(rod1) && g.connections?.includes(rod2)
);

if (rod12Ghost) {
  console.log('✗ INVALID: Found ghost between Rod 1 and Rod 2 (misaligned: Y=400 vs Y=200)');
  console.log('   This ghost should not exist because the extensions reach different heights!');
} else {
  console.log('✓ Correctly rejected misaligned ghost between Rod 1 and Rod 2');
}

console.log('\nTest complete!');
