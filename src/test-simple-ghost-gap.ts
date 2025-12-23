/**
 * Simple test case for ghost plate with short rod in the middle
 *
 * Configuration:
 * Rod0 at X=0: 3P_22 (attachment points at 0, 200, 400)
 * Rod1 at X=600: 1P (attachment point at 0 only)
 * Rod2 at X=1200: 3P_22 (attachment points at 0, 200, 400)
 *
 * Plates:
 * - Plate at Y=0 connecting Rod0-Rod1
 * - Plate at Y=0 connecting Rod1-Rod2
 *
 * Expected ghost plates:
 * - At Y=200 between Rod0-Rod2 (spanning 1200mm)
 *   This should either:
 *   a) Suggest extending Rod1 from 1P to 3P_22
 *   b) Show as invalid with a message explaining why
 */

import { createEmptyShelf, addRod, addPlate, regenerateGhostPlates, getRodSKU } from './shelf-model.js';

console.log('=== Simple Ghost Gap Test ===\n');

const shelf = createEmptyShelf();

// Create rods
const rod0 = addRod({ x: 0, y: 0 }, 4, shelf);      // 3P_22
const rod1 = addRod({ x: 600, y: 0 }, 1, shelf);    // 1P
const rod2 = addRod({ x: 1200, y: 0 }, 4, shelf);   // 3P_22

console.log('Created rods:');
console.log(`  Rod ${rod0}: 3P_22 at X=0 (attachments at Y=0, 200, 400)`);
console.log(`  Rod ${rod1}: 1P at X=600 (attachment at Y=0 only)`);
console.log(`  Rod ${rod2}: 3P_22 at X=1200 (attachments at Y=0, 200, 400)\n`);

// Add plates at Y=0
addPlate(0, 1, [rod0, rod1], shelf);
addPlate(0, 1, [rod1, rod2], shelf);

console.log('Added plates at Y=0\n');

// Regenerate ghosts
regenerateGhostPlates(shelf);

console.log(`Generated ${shelf.ghostPlates.length} ghost plates\n`);

// Check for ghosts at Y=200 between Rod0 and Rod2
const y200Ghosts = shelf.ghostPlates.filter(g =>
  Math.abs(g.midpointPosition.y - 200) < 1 &&
  Math.abs(g.midpointPosition.x - 600) < 100 // Between X=0 and X=1200
);

console.log(`Ghost plates near Y=200, X=600 region:`);
y200Ghosts.forEach((ghost, idx) => {
  const rodIds = ghost.connections || [];
  const rodsStr = rodIds.map(id => {
    const r = shelf.rods.get(id);
    const sku = r ? getRodSKU(r.sku_id) : undefined;
    return `Rod${id}(${sku?.name || 'Unknown'})`;
  }).join(', ');

  console.log(`\n  Ghost: ${ghost.legal ? '✓ LEGAL' : '✗ INVALID'}`);
  console.log(`    Position: Y=${ghost.midpointPosition.y}, X=${ghost.midpointPosition.x}`);
  console.log(`    Connections: [${rodsStr}]`);
  console.log(`    Width: ${ghost.width}mm`);

  if (ghost.rodModifications && ghost.rodModifications.length > 0) {
    console.log(`    Rod Modifications:`);
    ghost.rodModifications.forEach(mod => {
      const newSKU = getRodSKU(mod.newSkuId!);
      if (mod.type === 'create') {
        console.log(`      - CREATE rod at X=${mod.position.x}: ${newSKU?.name || 'Unknown'}`);
      } else if (mod.type === 'extend') {
        const affectedRod = shelf.rods.get(mod.affectedRodIds![0]);
        const oldSKU = affectedRod ? getRodSKU(affectedRod.sku_id) : undefined;
        console.log(`      - EXTEND rod ${mod.affectedRodIds![0]} (${oldSKU?.name}) → ${newSKU?.name}`);
      }
    });
  }

  if (!ghost.legal) {
    if (rodIds.length === 0) {
      console.log(`    ⚠️  No valid rod connections found`);
      console.log(`    💡 This gap needs Rod1 (1P at X=600) to be extended to have an attachment at Y=200`);
    }
  }
});

// All ghost plates for reference
console.log('\n\nAll Ghost Plates:');
shelf.ghostPlates.forEach((ghost, idx) => {
  const rodIds = ghost.connections || [];
  console.log(`  ${idx}: Y=${ghost.midpointPosition.y}, X=${ghost.midpointPosition.x}, legal=${ghost.legal}, rods=[${rodIds.join(',')}]`);
});

console.log('\n=== Analysis ===');
console.log('The ghost at Y=200, X=600 should either:');
console.log('  1. Be marked LEGAL with a rod modification to extend Rod1 from 1P to 3P_22');
console.log('  2. Be marked INVALID with a clear message explaining why\n');

const hasValidGhostAt200 = y200Ghosts.some(g => g.legal && g.rodModifications && g.rodModifications.length > 0);
const hasInvalidGhostAt200 = y200Ghosts.some(g => !g.legal);

if (hasValidGhostAt200) {
  console.log('✓ Found LEGAL ghost with rod modifications - GOOD!');
} else if (hasInvalidGhostAt200) {
  console.log('⚠️  Found INVALID ghost without rod modifications');
  console.log('   This is the issue - the ghost should suggest extending Rod1');
} else {
  console.log('❓ No ghost found at Y=200 - unexpected');
}

console.log('\n=== Test Complete ===');
