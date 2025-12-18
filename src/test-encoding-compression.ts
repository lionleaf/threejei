import { createEmptyShelf, addRod, addPlate } from './shelf-model.js';
import { encodeShelf, decodeShelf, encodeShelfToJSON } from './shelf-encoding.js';

function testCompression() {
  console.log('=== Encoding Compression Test ===\n');

  const shelf = createEmptyShelf();
  const rod1 = addRod({ x: 0, y: 0 }, 4, shelf);
  const rod2 = addRod({ x: 600, y: 0 }, 4, shelf);
  addPlate(0, 1, [rod1, rod2], shelf);
  addPlate(200, 1, [rod1, rod2], shelf);
  addPlate(400, 1, [rod1, rod2], shelf);

  const encodedV2 = encodeShelf(shelf);
  const jsonV2 = encodeShelfToJSON(shelf);

  console.log('Version 2 Encoding:');
  console.log('JSON length:', jsonV2.length);
  console.log('Base64 length:', encodedV2.length);
  console.log('JSON:', jsonV2);
  console.log('');

  const decoded = decodeShelf(encodedV2);
  console.log('Decoded successfully');
  console.log('Rods:', decoded.rods.size);
  console.log('Plates:', decoded.plates.size);

  const parsed = JSON.parse(jsonV2);
  console.log('\nFormat verification:');
  console.log('Version:', parsed.v);
  console.log('Rods format (array):', Array.isArray(parsed.r) && Array.isArray(parsed.r[0]));
  console.log('Plates format (array):', Array.isArray(parsed.p) && Array.isArray(parsed.p[0]));

  console.log('\nExpected size: ~47 bytes JSON, ~63 bytes base64');
  console.log('Actual size:', jsonV2.length, 'bytes JSON,', encodedV2.length, 'bytes base64');

  const v1EstimatedSize = 144;
  const reduction = ((v1EstimatedSize - jsonV2.length) / v1EstimatedSize * 100).toFixed(1);
  console.log(`Compression: ${reduction}% reduction from v1\n`);

  console.log('Test 2: Medium shelf (4 rods, 5 plates)');
  const mediumShelf = createEmptyShelf();
  const r1 = addRod({ x: 0, y: 0 }, 4, mediumShelf);
  const r2 = addRod({ x: 600, y: 0 }, 4, mediumShelf);
  const r3 = addRod({ x: 1200, y: 0 }, 4, mediumShelf);
  const r4 = addRod({ x: 1800, y: 0 }, 4, mediumShelf);

  addPlate(0, 1, [r1, r2], mediumShelf);
  addPlate(200, 1, [r1, r2], mediumShelf);
  addPlate(0, 1, [r2, r3], mediumShelf);
  addPlate(200, 1, [r3, r4], mediumShelf);
  addPlate(400, 1, [r2, r3], mediumShelf);

  const mediumJSON = encodeShelfToJSON(mediumShelf);
  const mediumBase64 = encodeShelf(mediumShelf);

  console.log('Medium shelf JSON length:', mediumJSON.length);
  console.log('Medium shelf Base64 length:', mediumBase64.length);

  const v1MediumEstimate = 390;
  const mediumReduction = ((v1MediumEstimate - mediumJSON.length) / v1MediumEstimate * 100).toFixed(1);
  console.log(`Compression: ${mediumReduction}% reduction from v1\n`);

  const decodedMedium = decodeShelf(mediumBase64);
  console.log('Medium shelf decoded successfully');
  console.log('Rods:', decodedMedium.rods.size);
  console.log('Plates:', decodedMedium.plates.size);

  if (decodedMedium.rods.size === 4 && decodedMedium.plates.size === 5) {
    console.log('✓ TEST PASSED: Compression and decoding working correctly\n');
  } else {
    console.log('❌ TEST FAILED: Decoded shelf has incorrect counts\n');
    throw new Error('Test failed');
  }
}

testCompression();
