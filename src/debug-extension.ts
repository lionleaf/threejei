import { decodeShelfFromJSON } from './shelf-encoding.js';
import { regenerateGhostPlates, getRodSKU } from './shelf-model.js';
import { getRodHeight } from './shelf-utils.js';

const broken = '{"v":2,"r":[[0,-300,12],[600,-300,12],[1200,-300,12],[1800,200,1],[2400,200,1]],"p":[[0,3,[0,1,2]],[200,4,[1,2,3,4]],[400,3,[0,1,2]],[700,3,[0,1,2]],[-300,3,[0,1,2]]]}';

const shelfBroken = decodeShelfFromJSON(broken);

console.log("\nRod 2 (at X=600) details:");
const rod2 = shelfBroken.rods.get(2)!;
const rod2SKU = getRodSKU(rod2.sku_id)!;
console.log(`Current: Y=${rod2.position.y}, SKU=${rod2SKU.sku_id} (${rod2SKU.name}), Height=${getRodHeight(rod2SKU)}`);
console.log(`Top of rod: ${rod2.position.y + getRodHeight(rod2SKU)}`);

regenerateGhostPlates(shelfBroken);

console.log("\nGhost 3 (affects rod at X=600):");
const ghost3 = shelfBroken.ghostPlates[3];
console.log(`Action: ${ghost3.action}`);
console.log(`Plate Y: ${ghost3.midpointPosition.y}`);

const rodMod = ghost3.rodModifications![0];
console.log(`\nRod modification:`);
console.log(`  Type: ${rodMod.type}`);
console.log(`  Position: X=${rodMod.position.x}, Y=${rodMod.position.y}`);
console.log(`  Position object:`, rodMod.position);
console.log(`  NewSKU: ${rodMod.newSkuId}`);
console.log(`  AffectedRodIds:`, rodMod.affectedRodIds);

const newSKU = getRodSKU(rodMod.newSkuId!)!;
console.log(`  New SKU: ${newSKU.sku_id} (${newSKU.name}), Height=${getRodHeight(newSKU)}`);
console.log(`  visualY: ${rodMod.visualY}, visualHeight: ${rodMod.visualHeight}`);

console.log(`\nWhat should be rendered:`);
console.log(`  Current rod is at Y=${rod2.position.y} with height ${getRodHeight(rod2SKU)}, top at Y=${rod2.position.y + getRodHeight(rod2SKU)}`);
console.log(`  After extension, rod will be at Y=${rod2.position.y} with height ${getRodHeight(newSKU)}, top at Y=${rod2.position.y + getRodHeight(newSKU)}`);
console.log(`  Ghost should show the FULL extended rod from Y=${rod2.position.y} to Y=${rod2.position.y + getRodHeight(newSKU)}`);
console.log(`  This will overlap the existing rod but extend ${getRodHeight(newSKU) - getRodHeight(rod2SKU)}mm further`);
