/**
 * Test to investigate ghost plate collision issue with user's complex shelf configuration
 */

import { decodeShelfFromJSON } from './shelf-encoding.js';
import { getRodSKU, getPlateSKU } from './shelf-model.js';

// The shelf configuration from the user
const shelfJSON = `{"v":2,"r":[[-600,400,6],[0,10],[600,1],[1200,1],[1200,400,6],[1800,10]],"p":[[0,1,[1,2]],[400,1,[0,1]],[400,1,[4,5]],[900,1,[0,1]],[900,1,[4,5]],[0,1,[3,5]]]}`;

console.log('=== User Shelf Ghost Plate Analysis ===\n');

const shelf = decodeShelfFromJSON(shelfJSON);

console.log('Shelf loaded. Analyzing configuration...\n');

// Print rod configuration
console.log('RODS:');
const sortedRods = Array.from(shelf.rods.entries())
  .sort(([_a, rodA], [_b, rodB]) => rodA.position.x - rodB.position.x);

sortedRods.forEach(([rodId, rod]) => {
  const rodSKU = getRodSKU(rod.sku_id);
  console.log(`\n  Rod ${rodId} at X=${rod.position.x}, Y=${rod.position.y}: ${rodSKU?.name || 'Unknown'}`);
  console.log(`    Spans: [${rodSKU?.spans.join(', ') || 'Unknown'}]`);
  console.log(`    Attachment points (absolute Y positions):`);
  rod.attachmentPoints.forEach((ap, idx) => {
    const absoluteY = rod.position.y + ap.y;
    console.log(`      [${idx}] Y = ${absoluteY} (relative: ${ap.y})`);
  });
});

console.log('\n\nPLATES:');
Array.from(shelf.plates.entries()).forEach(([plateId, plate]) => {
  const plateSKU = getPlateSKU(plate.sku_id);
  const rodList = plate.connections.map(id => {
    const rod = shelf.rods.get(id);
    return rod ? `Rod${id}(X=${rod.position.x})` : `Unknown(${id})`;
  }).join(', ');
  console.log(`  Plate ${plateId} at Y=${plate.y}: ${plateSKU?.name || 'Unknown'} connecting [${rodList}]`);
});

console.log('\n\nGHOST PLATES:');
shelf.ghostPlates.forEach((ghostPlate, idx) => {
  const statusStr = ghostPlate.legal ? '✓ LEGAL' : '✗ INVALID';
  const rodIds = ghostPlate.connections || [];
  const rodList = rodIds.map((id: number) => {
    const rod = shelf.rods.get(id);
    return rod ? `Rod${id}(X=${rod.position.x})` : `Unknown(${id})`;
  }).join(', ');

  console.log(`\n  Ghost ${idx}: ${statusStr}`);
  console.log(`    Y = ${ghostPlate.midpointPosition.y}`);
  console.log(`    X = ${ghostPlate.midpointPosition.x}`);
  console.log(`    Rods: [${rodList}]`);
  console.log(`    Width: ${ghostPlate.width}mm`);

  if (ghostPlate.rodModifications && ghostPlate.rodModifications.length > 0) {
    console.log(`    Rod Modifications Required:`);
    ghostPlate.rodModifications.forEach(mod => {
      const affectedRodId = mod.affectedRodIds?.[0];
      const rod = affectedRodId !== undefined ? shelf.rods.get(affectedRodId) : undefined;
      const rodX = mod.position.x;

      if (mod.type === 'create') {
        const newSKU = getRodSKU(mod.newSkuId!);
        console.log(`      - CREATE new rod at X=${rodX}: ${newSKU?.name || 'Unknown'}`);
      } else if (mod.type === 'extend') {
        const currentSKU = rod ? getRodSKU(rod.sku_id) : undefined;
        const newSKU = getRodSKU(mod.newSkuId!);
        console.log(`      - EXTEND rod ${affectedRodId} at X=${rodX}`);
        console.log(`        From: ${currentSKU?.name || 'Unknown'}`);
        console.log(`        To:   ${newSKU?.name || 'Unknown'}`);
        console.log(`        Direction: ${mod.direction}`);
        console.log(`        Visual segment: Y=${mod.visualY}, height=${mod.visualHeight}`);
      } else if (mod.type === 'merge') {
        const currentSKU = rod ? getRodSKU(rod.sku_id) : undefined;
        const newSKU = getRodSKU(mod.newSkuId!);
        console.log(`      - MERGE rod ${affectedRodId} at X=${rodX}`);
        console.log(`        From: ${currentSKU?.name || 'Unknown'}`);
        console.log(`        To:   ${newSKU?.name || 'Unknown'}`);
      }
    });
  }
});

// Analyze why certain ghosts might be invalid
console.log('\n\n=== ANALYSIS ===\n');

// Find invalid ghosts and explain why
const invalidGhosts = shelf.ghostPlates.filter(g => !g.legal);
console.log(`Found ${invalidGhosts.length} invalid ghost plates\n`);

invalidGhosts.forEach((ghost, idx) => {
  console.log(`Invalid Ghost at Y=${ghost.midpointPosition.y}, X=${ghost.midpointPosition.x}:`);

  const rodIds = ghost.connections || [];

  if (rodIds.length === 0) {
    console.log(`  ❌ NO RODS connected - this ghost has no valid rod pairs`);

    // Find nearby rods to explain why
    const nearbyRods = Array.from(shelf.rods.values()).filter(rod => {
      const distX = Math.abs(rod.position.x - ghost.midpointPosition.x);
      return distX <= 700; // Within reasonable distance (600mm + padding)
    }).sort((a, b) => a.position.x - b.position.x);

    console.log(`  Nearby rods:`);
    nearbyRods.forEach(rod => {
      const rodSKU = getRodSKU(rod.sku_id);
      const attachmentYs = rod.attachmentPoints.map(ap => rod.position.y + ap.y);
      const hasAttachment = attachmentYs.some(y => Math.abs(y - ghost.midpointPosition.y) < 1);

      console.log(`    - Rod at X=${rod.position.x}: ${rodSKU?.name}`);
      console.log(`      Attachments: [${attachmentYs.join(', ')}]`);
      console.log(`      Has attachment at Y=${ghost.midpointPosition.y}? ${hasAttachment ? 'YES' : 'NO'}`);
    });

    console.log(`  💡 This gap could be filled by:`);
    console.log(`     - Extending nearby short rods (e.g., 1P → 3P_22)`);
    console.log(`     - Creating a new rod at an intermediate position`);
    console.log();
    return;
  }

  // Check each rod to see if it has an attachment point at this Y
  rodIds.forEach((rodId: number) => {
    const rod = shelf.rods.get(rodId);
    if (!rod) {
      console.log(`  - Rod ${rodId}: NOT FOUND`);
      return;
    }

    const rodSKU = getRodSKU(rod.sku_id);
    const attachmentYs = rod.attachmentPoints.map(ap => rod.position.y + ap.y);
    const hasAttachment = attachmentYs.some(y => Math.abs(y - ghost.midpointPosition.y) < 1);

    console.log(`  - Rod ${rodId} (${rodSKU?.name}) at X=${rod.position.x}:`);
    console.log(`      Has attachment at Y=${ghost.midpointPosition.y}? ${hasAttachment}`);
    console.log(`      Available attachments: [${attachmentYs.join(', ')}]`);

    if (!hasAttachment) {
      console.log(`      ⚠️  No attachment point at ghost Y position!`);

      // Check if we could extend this rod
      const minY = Math.min(...attachmentYs);
      const maxY = Math.max(...attachmentYs);
      if (ghost.midpointPosition.y < minY) {
        console.log(`      💡 Could extend DOWN (ghost Y < rod min Y)`);
      } else if (ghost.midpointPosition.y > maxY) {
        console.log(`      💡 Could extend UP (ghost Y > rod max Y)`);
      } else {
        console.log(`      ❌ Ghost Y is INSIDE rod range but no attachment!`);
      }
    }
  });

  console.log();
});

console.log('=== Analysis Complete ===');
