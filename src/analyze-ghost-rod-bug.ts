import { decodeShelfFromJSON } from './shelf-encoding.js';
import { regenerateGhostRods, regenerateGhostPlates, getRodSKU, getPlateSKU } from './shelf-model.js';
import { getRodHeight } from './shelf-utils.js';

const working = '{"v":2,"r":[[0,-300,12],[600,-300,12],[1200,-300,12],[1800,200,1],[2400,200,1]],"p":[[0,3,[0,1,2]],[200,3,[1,2,3]],[400,3,[0,1,2]],[700,3,[0,1,2]],[-300,3,[0,1,2]]]}';
const broken = '{"v":2,"r":[[0,-300,12],[600,-300,12],[1200,-300,12],[1800,200,1],[2400,200,1]],"p":[[0,3,[0,1,2]],[200,4,[1,2,3,4]],[400,3,[0,1,2]],[700,3,[0,1,2]],[-300,3,[0,1,2]]]}';

console.log("=== ANALYZING DIFFERENCE ===");
const workingJSON = JSON.parse(working);
const brokenJSON = JSON.parse(broken);

console.log("Working plates:", workingJSON.p);
console.log("Broken plates:", brokenJSON.p);

console.log("\nDifference: Plate at Y=200 changed from [1,2,3] to [1,2,3,4]");
console.log("This means rod 4 (at X=1800) now has a plate connection");

console.log("\n=== WORKING CONFIG ===");
const shelfWorking = decodeShelfFromJSON(working);
console.log("\nRods:");
shelfWorking.rods.forEach((rod, id) => {
  const sku = getRodSKU(rod.sku_id)!;
  console.log(`  Rod ${id}: X=${rod.position.x}, Y=${rod.position.y}, SKU=${sku.name}`);
  console.log(`    Attachment points:`, rod.attachmentPoints.map((ap, i) => `${i}:Y=${ap.y}${ap.plateId ? ` (plate ${ap.plateId})` : ''}`));
});

console.log("\nPlates:");
shelfWorking.plates.forEach((plate, id) => {
  const sku = getPlateSKU(plate.sku_id)!;
  console.log(`  Plate ${id}: Y=${plate.y}, SKU=${sku.name}, Connections=[${plate.connections}]`);
});

regenerateGhostPlates(shelfWorking);
console.log("\nGhost plates with rod extensions:");
shelfWorking.ghostPlates.forEach((gp, i) => {
  if (gp.rodModifications && gp.rodModifications.length > 0) {
    console.log(`  Ghost ${i}: Y=${gp.midpointPosition.y}, Action=${gp.action}`);
    gp.rodModifications.forEach(mod => {
      console.log(`    Rod mod: type=${mod.type}, X=${mod.position.x}, NewSKU=${mod.newSkuId}`);
    });
  }
});

console.log("\n=== BROKEN CONFIG ===");
const shelfBroken = decodeShelfFromJSON(broken);
console.log("\nRods:");
shelfBroken.rods.forEach((rod, id) => {
  const sku = getRodSKU(rod.sku_id)!;
  console.log(`  Rod ${id}: X=${rod.position.x}, Y=${rod.position.y}, SKU=${sku.name}`);
  console.log(`    Attachment points:`, rod.attachmentPoints.map((ap, i) => `${i}:Y=${ap.y}${ap.plateId ? ` (plate ${ap.plateId})` : ''}`));
});

console.log("\nPlates:");
shelfBroken.plates.forEach((plate, id) => {
  const sku = getPlateSKU(plate.sku_id)!;
  console.log(`  Plate ${id}: Y=${plate.y}, SKU=${sku.name}, Connections=[${plate.connections}]`);
});

regenerateGhostPlates(shelfBroken);
console.log("\nGhost plates with rod extensions:");
shelfBroken.ghostPlates.forEach((gp, i) => {
  if (gp.rodModifications && gp.rodModifications.length > 0) {
    console.log(`  Ghost ${i}: Y=${gp.midpointPosition.y}, Action=${gp.action}, Legal=${gp.legal}`);
    gp.rodModifications.forEach(mod => {
      console.log(`    Rod mod: type=${mod.type}, X=${mod.position.x}, NewSKU=${mod.newSkuId}, visualY=${mod.visualY}, visualHeight=${mod.visualHeight}`);
    });
  }
});

console.log("\n=== FOCUS: Ghost plates at rod positions 0, 600, 1200 ===");
shelfBroken.ghostPlates.forEach((gp, i) => {
  if (gp.rodModifications) {
    for (const mod of gp.rodModifications) {
      if (mod.position.x === 0 || mod.position.x === 600 || mod.position.x === 1200) {
        console.log(`\nGhost ${i} affects rod at X=${mod.position.x}:`);
        console.log(`  Plate Y=${gp.midpointPosition.y}, Action=${gp.action}`);
        console.log(`  Mod type=${mod.type}, NewSKU=${mod.newSkuId}`);
        console.log(`  visualY=${mod.visualY}, visualHeight=${mod.visualHeight}`);

        const sku = getRodSKU(mod.newSkuId!);
        if (sku) {
          console.log(`  New SKU name: ${sku.name}, total height: ${getRodHeight(sku)}`);
        }
      }
    }
  }
});
