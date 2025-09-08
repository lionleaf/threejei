import { createEmptyShelf, addRod, addPlate } from './shelf-models.js';

// Create test shelf
const shelf = createEmptyShelf();
const rod1 = addRod({ x: 0, z: 0 }, "3P_22", shelf);
const rod2 = addRod({ x: 600, z: 0 }, "3P_22", shelf);

addPlate(rod1, rod2, 0, 670, shelf);   // Bottom: 0cm
addPlate(rod1, rod2, 20, 670, shelf);  // Middle: 20cm  
addPlate(rod1, rod2, 40, 670, shelf);  // Top: 40cm

console.log("\n=== SHELF VISUALIZATION ANALYSIS ===");
console.log("Rod attachment points (cm):", shelf.rods.get(rod1).attachmentPoints.map(p => p.y));

console.log("\nASCII Representation of what should be visible:");
console.log("40cm (0.40m): ████████████████ ← Top Plate");
console.log("              |              |");
console.log("              |    20cm gap  |");  
console.log("              |              |");
console.log("20cm (0.20m): ████████████████ ← Middle Plate");
console.log("              |              |");
console.log("              |    20cm gap  |");
console.log("              |              |");
console.log(" 0cm (0.00m): ████████████████ ← Bottom Plate");
console.log("              ↑              ↑");
console.log("            Rod1           Rod2");

console.log("\nMetric conversion check:");
for (const [plateId, plate] of shelf.plates) {
    const startConnection = plate.connections[0];
    const startRod = shelf.rods.get(startConnection[0]);
    const attachmentIndex = startConnection[1];
    const yPositionCm = startRod.attachmentPoints[attachmentIndex].y;
    const yPositionM = yPositionCm * 0.01;
    console.log(`- Plate at ${yPositionCm}cm = ${yPositionM.toFixed(2)}m`);
}

console.log("\n✓ Vertical spacing should be 0.20m (20cm) between each level");
console.log("✓ Total shelf height: 0.40m (40cm)");