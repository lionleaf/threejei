import { createEmptyShelf, addRod, addPlate } from './shelf-model.js';
import { loadPrices, calculateShelfPricing, formatPrice } from './pricing.js';

async function testPricing() {
  console.log('=== Testing Pricing System ===\n');

  // Load prices
  const prices = await loadPrices();
  console.log('✓ Prices loaded successfully\n');

  // Test 1: Empty shelf
  console.log('Test 1: Empty shelf');
  const emptyShelf = createEmptyShelf();
  const emptyPricing = calculateShelfPricing(emptyShelf, prices);
  console.log(`Total price: ${formatPrice(emptyPricing.totalPrice)}`);
  console.log(`Expected: 0.00 kr`);
  console.log(`Pass: ${emptyPricing.totalPrice === 0}\n`);

  // Test 2: Simple shelf (2 rods, 3 plates)
  console.log('Test 2: Simple shelf with 2x 3P_22 rods and 3x 670mm plates');
  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 4, shelf); // sku_id 4 = 3P_22
  const rod2 = addRod({ x: 600, y: 0 }, 4, shelf); // sku_id 4 = 3P_22
  addPlate(0, 1, [rod1, rod2], shelf); // sku_id 1 = 670mm
  addPlate(200, 1, [rod1, rod2], shelf);
  addPlate(400, 1, [rod1, rod2], shelf);

  const pricing = calculateShelfPricing(shelf, prices);

  console.log('\nComponents:');
  pricing.rods.forEach(rod => {
    console.log(`  ${rod.quantity}x ${rod.name} @ ${formatPrice(rod.unitPrice)} = ${formatPrice(rod.totalPrice)}`);
  });
  pricing.plates.forEach(plate => {
    console.log(`  ${plate.quantity}x ${plate.name} @ ${formatPrice(plate.unitPrice)} = ${formatPrice(plate.totalPrice)}`);
  });
  console.log(`  ${pricing.supportRods.quantity}x ${pricing.supportRods.name} @ ${formatPrice(pricing.supportRods.unitPrice)} = ${formatPrice(pricing.supportRods.totalPrice)}`);

  console.log(`\nTotal price: ${formatPrice(pricing.totalPrice)}`);

  // Expected calculation:
  // 2 rods * 2 physical = 4 rods @ 200.00 kr = 800.00 kr
  // 3 plates @ 250.00 kr = 750.00 kr
  // 6 attachment points (3 per rod * 2 rods) * 30.00 kr = 180.00 kr
  // Total: 1730.00 kr
  const expectedTotal = 1730.00;
  console.log(`Expected: ${formatPrice(expectedTotal)}`);
  console.log(`Pass: ${pricing.totalPrice === expectedTotal}\n`);

  // Test 3: Different rod types
  console.log('Test 3: Mixed rod types');
  const mixedShelf = createEmptyShelf();
  const rod3 = addRod({ x: 0, y: 0 }, 4, mixedShelf); // 3P_22
  const rod4 = addRod({ x: 600, y: 0 }, 7, mixedShelf); // 4P_223 (sku_id 7)
  addPlate(0, 1, [rod3, rod4], mixedShelf);

  const mixedPricing = calculateShelfPricing(mixedShelf, prices);
  console.log('\nComponents:');
  mixedPricing.rods.forEach(rod => {
    console.log(`  ${rod.quantity}x ${rod.name} @ ${formatPrice(rod.unitPrice)} = ${formatPrice(rod.totalPrice)}`);
  });
  mixedPricing.plates.forEach(plate => {
    console.log(`  ${plate.quantity}x ${plate.name} @ ${formatPrice(plate.unitPrice)} = ${formatPrice(plate.totalPrice)}`);
  });
  console.log(`  ${mixedPricing.supportRods.quantity}x ${mixedPricing.supportRods.name} @ ${formatPrice(mixedPricing.supportRods.unitPrice)} = ${formatPrice(mixedPricing.supportRods.totalPrice)}`);
  console.log(`\nTotal price: ${formatPrice(mixedPricing.totalPrice)}`);

  // Expected:
  // 1x 3P_22 rod * 2 physical = 2 @ 200.00 kr = 400.00 kr
  // 1x 4P_223 rod * 2 physical = 2 @ 230.00 kr = 460.00 kr
  // 1 plate @ 250.00 kr = 250.00 kr
  // 7 attachment points (3 + 4) * 30.00 kr = 210.00 kr
  // Total: 1320.00 kr
  const expectedMixed = 1320.00;
  console.log(`Expected: ${formatPrice(expectedMixed)}`);
  console.log(`Pass: ${mixedPricing.totalPrice === expectedMixed}\n`);

  console.log('=== All Tests Complete ===');
}

testPricing().catch(console.error);
