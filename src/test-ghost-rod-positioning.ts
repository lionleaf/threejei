import { decodeShelfFromJSON } from './shelf-encoding.js';
import { regenerateGhostRods, getRodSKU, calculateAttachmentPositions } from './shelf-model.js';
import { getRodHeight } from './shelf-utils.js';

const working = '{"v":2,"r":[[0,-300,12],[600,-300,12],[1200,-300,12],[1800,200,1],[2400,200,1]],"p":[[0,3,[0,1,2]],[200,3,[1,2,3]],[400,3,[0,1,2]],[700,3,[0,1,2]],[-300,3,[0,1,2]]]}';
const broken = '{"v":2,"r":[[0,-300,12],[600,-300,12],[1200,-300,12],[1800,200,1],[2400,200,1]],"p":[[0,3,[0,1,2]],[200,4,[1,2,3,4]],[400,3,[0,1,2]],[700,3,[0,1,2]],[-300,3,[0,1,2]]]}';

console.log("=== WORKING CONFIG ===");
const shelfWorking = decodeShelfFromJSON(working);
shelfWorking.rods.forEach((rod, id) => {
  const sku = getRodSKU(rod.sku_id)!;
  console.log(`Rod ${id}: X=${rod.position.x}, Y=${rod.position.y}, SKU=${sku.name}, Height=${getRodHeight(sku)}`);
});
regenerateGhostRods(shelfWorking);
console.log("Ghost rods count:", shelfWorking.ghostRods.length);

console.log("\n=== BROKEN CONFIG ===");
const shelfBroken = decodeShelfFromJSON(broken);
shelfBroken.rods.forEach((rod, id) => {
  const sku = getRodSKU(rod.sku_id)!;
  console.log(`Rod ${id}: X=${rod.position.x}, Y=${rod.position.y}, SKU=${sku.name}, Height=${getRodHeight(sku)}`);
});
regenerateGhostRods(shelfBroken);
console.log("Ghost rods count:", shelfBroken.ghostRods.length);

// Check ghost plates too
import { regenerateGhostPlates } from './shelf-model.js';
regenerateGhostPlates(shelfBroken);
console.log("\nGhost plates count:", shelfBroken.ghostPlates.length);

shelfBroken.ghostPlates.forEach((gp, i) => {
  console.log(`\nGhost Plate ${i}:`);
  console.log(`  Action: ${gp.action}, Legal: ${gp.legal}`);
  console.log(`  SKU ID: ${gp.sku_id}`);
  console.log(`  Connections: ${gp.connections}`);
  console.log(`  Position: Y=${gp.midpointPosition.y}`);
  if (gp.rodModifications) {
    console.log(`  Rod Modifications:`);
    gp.rodModifications.forEach((mod, j) => {
      console.log(`    ${j}: Type=${mod.type}, Position=${JSON.stringify(mod.position)}, NewSKU=${mod.newSkuId}`);
      if (mod.visualHeight) console.log(`       VisualHeight=${mod.visualHeight}, VisualY=${mod.visualY}`);
    });
  }
});

// Detailed analysis of each ghost rod
shelfBroken.ghostRods.forEach((gr, i) => {
  console.log(`\n=== Ghost Rod ${i} ===`);
  console.log(`Bottom Rod ID: ${gr.bottomRodId}, Top Rod ID: ${gr.topRodId}`);

  const bottomRod = shelfBroken.rods.get(gr.bottomRodId)!;
  const topRod = shelfBroken.rods.get(gr.topRodId)!;

  const bottomSKU = getRodSKU(bottomRod.sku_id)!;
  const topSKU = getRodSKU(topRod.sku_id)!;
  const ghostSKU = getRodSKU(gr.sku_id)!;

  console.log(`Bottom Rod: Y=${bottomRod.position.y}, SKU=${bottomSKU.name}, Height=${getRodHeight(bottomSKU)}`);
  console.log(`  Attachment positions:`, calculateAttachmentPositions(bottomSKU));
  console.log(`  Absolute top: ${bottomRod.position.y + getRodHeight(bottomSKU)}`);

  console.log(`Top Rod: Y=${topRod.position.y}, SKU=${topSKU.name}, Height=${getRodHeight(topSKU)}`);
  console.log(`  Attachment positions:`, calculateAttachmentPositions(topSKU));
  console.log(`  Absolute bottom: ${topRod.position.y}`);
  console.log(`  Absolute top: ${topRod.position.y + getRodHeight(topSKU)}`);

  console.log(`Ghost Rod: Position=${gr.position.y}, SKU=${ghostSKU.name}, Height=${getRodHeight(ghostSKU)}`);
  console.log(`  Attachment positions:`, gr.attachmentPoints.map(ap => ap.y));
  console.log(`  Expected absolute top: ${gr.position.y + getRodHeight(ghostSKU)}`);

  // Check gap between rods
  const bottomTop = bottomRod.position.y + getRodHeight(bottomSKU);
  const topBottom = topRod.position.y;
  const gap = topBottom - bottomTop;
  console.log(`Gap between rods: ${gap}mm`);

  // Verify the ghost rod should span from bottom to top
  console.log(`Should span from Y=${bottomRod.position.y} to Y=${topRod.position.y + getRodHeight(topSKU)}`);
  console.log(`Total span needed: ${topRod.position.y + getRodHeight(topSKU) - bottomRod.position.y}mm`);
});
