/**
 * Test for the ghost plate validation fix for non-standard gaps
 * Issue: Ghost plates at 900mm and 1500mm showing as illegal when they should be legal with rod creation fallback
 */

import { createEmptyShelf, addRod, canAddPlateSegment, Direction, regenerateGhostPlates } from './shelf-model.js';
import { decodeShelfFromJSON } from './shelf-encoding.js';

console.log('=== Testing Ghost Plate Fix for Non-Standard Gaps ===\n');

// Test 1: Simple case - gap that requires intermediate rod
console.log('Test 1: 900mm gap between rods (should fallback to rod creation)');
const shelf1 = createEmptyShelf();
const rod1 = addRod({ x: 0, y: 0 }, 4, shelf1);    // 3P_23 rod
const rod2 = addRod({ x: 900, y: 0 }, 4, shelf1);  // 3P_23 rod
const rod1Data = shelf1.rods.get(rod1);
const rod2Data = shelf1.rods.get(rod2);

console.log(`  Rod 1 at X=0: ${rod1Data?.attachmentPoints.length} attachment points`);
console.log(`  Rod 2 at X=900: ${rod2Data?.attachmentPoints.length} attachment points`);

// Test canAddPlateSegment from rod1 towards rod2
const result1 = canAddPlateSegment(rod1, 0, Direction.Right, shelf1);
console.log(`  canAddPlateSegment(rod1→rod2): ${result1 ? 'SUCCESS' : 'FAILED'}`);

if (result1) {
  console.log(`    SKU ID: ${result1.sku_id}`);
  console.log(`    Rod IDs: [${result1.rodIds.join(', ')}]`);
  console.log(`    Action: ${result1.action}`);
  console.log(`    Segment Width: ${result1.segmentWidth}mm`);
  console.log(`    Rod Creation Plan: ${result1.rodCreationPlan ? 'YES' : 'NO'}`);
  if (result1.rodCreationPlan) {
    console.log(`      Plan Type: ${result1.rodCreationPlan.action}`);
    console.log(`      Target Position: X=${result1.rodCreationPlan.position.x}, Y=${result1.rodCreationPlan.position.y}`);
  }
} else {
  console.log('  ❌ FAILED - This should succeed with rod creation fallback!');
}

// Test 2: Generate ghost plates and verify they show as legal
console.log('\nTest 2: Ghost plate generation for 900mm gap');
regenerateGhostPlates(shelf1);
console.log(`  Generated ${shelf1.ghostPlates.length} ghost plates`);

const ghostsAt900 = shelf1.ghostPlates.filter(g => 
  Math.abs(g.midpointPosition.x - 450) < 50 // Around midpoint of 900mm gap
);

console.log(`  Ghosts near X=450 (midpoint of 900mm gap): ${ghostsAt900.length}`);
ghostsAt900.forEach((ghost, idx) => {
  console.log(`    Ghost ${idx}: ${ghost.legal ? '✅ LEGAL' : '❌ ILLEGAL'}`);
  console.log(`      Position: X=${ghost.midpointPosition.x}, Y=${ghost.midpointPosition.y}`);
  console.log(`      Width: ${ghost.width}mm`);
  console.log(`      Rod Modifications: ${ghost.rodModifications?.length || 0}`);
  if (ghost.rodModifications?.length) {
    ghost.rodModifications.forEach(mod => {
      console.log(`        ${mod.type} rod at X=${mod.position.x}`);
    });
  }
});

// Test 3: User's specific shelf configuration
console.log('\nTest 3: User\'s shelf configuration');
const userShelfJSON = '{"v":2,"r":[[0,4],[600,4],[1800,4],[2400,4]],"p":[[0,1,[0,1]],[200,1,[0,1]],[400,1,[0,1]],[200,1,[2,3]],[400,1,[2,3]],[0,1,[2,3]]]}';
const userShelf = decodeShelfFromJSON(userShelfJSON);

console.log('  User shelf loaded. Rod positions:');
const sortedRods = Array.from(userShelf.rods.entries())
  .sort(([_a, rodA], [_b, rodB]) => rodA.position.x - rodB.position.x);

sortedRods.forEach(([rodId, rod]) => {
  console.log(`    Rod ${rodId}: X=${rod.position.x}, Y=${rod.position.y}`);
});

// Test gap between rod at 600 and rod at 1800 (1200mm gap)
const rodAt600 = sortedRods.find(([_, rod]) => rod.position.x === 600)?.[0];
const rodAt1800 = sortedRods.find(([_, rod]) => rod.position.x === 1800)?.[0];

if (rodAt600 !== undefined && rodAt1800 !== undefined) {
  console.log(`\n  Testing gap from rod at 600 to rod at 1800 (1200mm gap)`);
  
  // Check if rod at 1800 has attachment at Y=400
  const rodAt1800Data = userShelf.rods.get(rodAt1800);
  if (rodAt1800Data) {
    const hasAttachment = rodAt1800Data.attachmentPoints.some(ap => 
      Math.abs(rodAt1800Data.position.y + ap.y - 400) < 1
    );
    console.log(`    Rod at 1800 has attachment at Y=400: ${hasAttachment}`);
    console.log(`    Rod at 1800 attachments: [${rodAt1800Data.attachmentPoints.map(ap => rodAt1800Data.position.y + ap.y).join(', ')}]`);
  }
  
  const result3 = canAddPlateSegment(rodAt600, 400, Direction.Right, userShelf);
  console.log(`    canAddPlateSegment(600→1800): ${result3 ? 'SUCCESS' : 'FAILED'}`);
  
  if (result3) {
    console.log(`      Action: ${result3.action}`);
    console.log(`      Rod Creation Plan: ${result3.rodCreationPlan ? 'YES' : 'NO'}`);
    if (result3.rodCreationPlan) {
      console.log(`        Will create rod at X=${result3.rodCreationPlan.position.x}`);
    }
  } else {
    console.log(`      Probably failed because rod at 1800 has no attachment at Y=400`);
  }
}

// Generate ghost plates for user shelf
regenerateGhostPlates(userShelf);
console.log(`\n  Generated ${userShelf.ghostPlates.length} ghost plates for user shelf`);

// Check for ghosts at 900mm and 1500mm (positions mentioned by user)
[900, 1500].forEach(targetX => {
  const ghostsNearTarget = userShelf.ghostPlates.filter(g => 
    Math.abs(g.midpointPosition.x - targetX) < 100
  );
  
  console.log(`\n    Ghosts near X=${targetX}: ${ghostsNearTarget.length}`);
  ghostsNearTarget.forEach((ghost, idx) => {
    console.log(`      Ghost ${idx}: ${ghost.legal ? '✅ LEGAL' : '❌ ILLEGAL'}`);
    console.log(`        Position: X=${ghost.midpointPosition.x}, Y=${ghost.midpointPosition.y}`);
    console.log(`        Rod Modifications: ${ghost.rodModifications?.length || 0}`);
  });
});

console.log('\n=== Test Complete ===');