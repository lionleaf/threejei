import { createEmptyShelf, addRod, getRodSKU } from './shelf-model.js';
import { getRodHeight } from './shelf-utils.js';

console.log('\n=== Debugging Ghost Rod Generation ===\n');

const shelf = createEmptyShelf();
const rod1 = addRod({ x: 0, y: 0 }, 1, shelf); // 1P at Y=0
const rod2 = addRod({ x: 0, y: 200 }, 1, shelf); // 1P at Y=200

console.log('Created two rods:');
console.log(`  Rod ${rod1}: SKU=${shelf.rods.get(rod1)!.sku_id}, Position=${JSON.stringify(shelf.rods.get(rod1)!.position)}`);
console.log(`  Rod ${rod2}: SKU=${shelf.rods.get(rod2)!.sku_id}, Position=${JSON.stringify(shelf.rods.get(rod2)!.position)}`);

const bottomRod = shelf.rods.get(rod1)!;
const topRod = shelf.rods.get(rod2)!;

const bottomRodSKU = getRodSKU(bottomRod.sku_id);
const topRodSKU = getRodSKU(topRod.sku_id);

console.log('\nRod SKUs:');
console.log(`  Bottom: ${bottomRodSKU!.name}, spans: [${bottomRodSKU!.spans}]`);
console.log(`  Top: ${topRodSKU!.name}, spans: [${topRodSKU!.spans}]`);

const bottomRodHeight = getRodHeight(bottomRodSKU!);
const topRodHeight = getRodHeight(topRodSKU!);

console.log('\nRod heights:');
console.log(`  Bottom height: ${bottomRodHeight}mm`);
console.log(`  Top height: ${topRodHeight}mm`);

const bottomRodTop = bottomRod.position.y + bottomRodHeight;
const topRodBottom = topRod.position.y;

console.log('\nCalculated positions:');
console.log(`  Bottom rod top: ${bottomRodTop}mm`);
console.log(`  Top rod bottom: ${topRodBottom}mm`);
console.log(`  Gap: ${topRodBottom - bottomRodTop}mm`);

console.log('\nAttachment points:');
console.log(`  Bottom rod: ${JSON.stringify(bottomRod.attachmentPoints)}`);
console.log(`  Top rod: ${JSON.stringify(topRod.attachmentPoints)}`);

// Manually test validateMerge
import { validateMerge } from './shelf-model.js';

// Try different attachment Y positions
console.log('\n--- Testing different newAttachmentY values ---');

[0, 100, 200].forEach(testY => {
  console.log(`\nTrying validateMerge with newAttachmentY=${testY}:`);
  const result = validateMerge(rod1, rod2, testY, shelf);

  if (result) {
    console.log(`  ✓ SUCCESS: action=${result.action}, merged SKU=${result.mergedSkuId}`);
    const sku = getRodSKU(result.mergedSkuId!);
    console.log(`    Merged rod will be: ${sku?.name} with spans [${sku?.spans}]`);
  } else {
    console.log(`  ✗ FAILED: No valid merge found`);

    // Debug: calculate what the gaps would be
    const combinedYs = [
      ...bottomRod.attachmentPoints.map(ap => bottomRod.position.y + ap.y),
      testY,
      ...topRod.attachmentPoints.map(ap => topRod.position.y + ap.y)
    ].sort((a, b) => a - b);

    const gaps = [];
    for (let i = 0; i < combinedYs.length - 1; i++) {
      gaps.push(combinedYs[i + 1] - combinedYs[i]);
    }

    console.log(`    Combined Ys (sorted): [${combinedYs}]`);
    console.log(`    Gaps: [${gaps}]`);
  }
});
