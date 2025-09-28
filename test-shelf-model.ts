import { createEmptyShelf } from './shelf-model.ts';

const shelf = createEmptyShelf();
console.log(shelf.rods.size === 0 ? '✅ Test passed' : '❌ Test failed');