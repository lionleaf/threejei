import { decodeShelf, decodeShelfFromJSON } from './shelf-encoding.js';

function testBackwardCompatibility() {
  console.log('=== Encoding Backward Compatibility Test ===\n');

  console.log('Test 1: Version 1 encoding');
  const v1JSON = '{"version":1,"rods":[{"pos":{"x":0,"y":0},"sku":"3P_22"},{"pos":{"x":600,"y":0},"sku":"3P_22"}],"plates":[{"y":0,"sku":"670mm","rods":[0,1]}]}';
  const shelfFromV1JSON = decodeShelfFromJSON(v1JSON);
  console.log('V1 JSON decoded:', shelfFromV1JSON.rods.size, 'rods,', shelfFromV1JSON.plates.size, 'plates');

  if (shelfFromV1JSON.rods.size === 2 && shelfFromV1JSON.plates.size === 1) {
    console.log('✓ V1 JSON format works\n');
  } else {
    console.log('❌ V1 JSON format failed\n');
    throw new Error('V1 JSON test failed');
  }

  console.log('Test 2: Version 0 encoding (legacy, no version field)');
  const v0JSON = '{"rods":[{"pos":{"x":0,"y":0},"sku":"3P_22"}],"plates":[]}';
  const shelfFromV0JSON = decodeShelfFromJSON(v0JSON);
  console.log('V0 JSON decoded:', shelfFromV0JSON.rods.size, 'rods,', shelfFromV0JSON.plates.size, 'plates');

  if (shelfFromV0JSON.rods.size === 1 && shelfFromV0JSON.plates.size === 0) {
    console.log('✓ V0 JSON format works\n');
  } else {
    console.log('❌ V0 JSON format failed\n');
    throw new Error('V0 JSON test failed');
  }

  console.log('Test 3: Version 2 encoding');
  const v2JSON = '{"v":2,"r":[[0,4],[600,4]],"p":[[0,1,[0,1]]]}';
  const shelfFromV2JSON = decodeShelfFromJSON(v2JSON);
  console.log('V2 JSON decoded:', shelfFromV2JSON.rods.size, 'rods,', shelfFromV2JSON.plates.size, 'plates');

  if (shelfFromV2JSON.rods.size === 2 && shelfFromV2JSON.plates.size === 1) {
    console.log('✓ V2 JSON format works\n');
  } else {
    console.log('❌ V2 JSON format failed\n');
    throw new Error('V2 JSON test failed');
  }

  console.log('Test 4: V2 with non-zero Y positions');
  const v2NonZeroJSON = '{"v":2,"r":[[0,-300,13],[600,-300,13]],"p":[[-300,1,[0,1]],[0,1,[0,1]],[200,1,[0,1]]]}';
  const shelfNonZero = decodeShelfFromJSON(v2NonZeroJSON);
  console.log('V2 non-zero Y decoded:', shelfNonZero.rods.size, 'rods,', shelfNonZero.plates.size, 'plates');

  const rodArray = Array.from(shelfNonZero.rods.values());
  const firstRod = rodArray[0];
  if (firstRod && firstRod.position.y === -300) {
    console.log('✓ Non-zero Y position preserved correctly\n');
  } else {
    console.log('❌ Non-zero Y position failed\n');
    throw new Error('Non-zero Y test failed');
  }

  console.log('✓ ALL BACKWARD COMPATIBILITY TESTS PASSED\n');
}

testBackwardCompatibility();
