// Import functions from shelf-model.ts
import {
  createEmptyShelf,
  addRod,
  addPlate,
  AVAILABLE_RODS,
  AVAILABLE_PLATES,
  type Shelf
} from './shelf-model.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

// General shelf visualizer
function visualizeShelf(shelf: Shelf): void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x444444);
  document.body.appendChild(renderer.domElement);

  // Render all rods
  shelf.rods.forEach((rod) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const height = rodSKU?.spans.reduce((sum, span) => sum + span, 0) || 300;

    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 20, height),
      new THREE.MeshBasicMaterial({ color: 0x666666 })
    );
    rodMesh.position.set(rod.position.x, height / 2, rod.position.z);
    scene.add(rodMesh);
  });

  // Render all plates
  shelf.plates.forEach((plate) => {
    const plateSKU = AVAILABLE_PLATES.find(p => p.sku_id === plate.sku_id);
    if (!plateSKU) return;

    const plateWidth = plateSKU.spans.reduce((sum, span) => sum + span, 0);

    // Calculate plate center position from connected rods
    const connectedRods = plate.connections.map(id => shelf.rods.get(id)).filter(rod => rod !== undefined);
    if (connectedRods.length === 0) return;

    const centerX = connectedRods.reduce((sum, rod) => sum + rod.position.x, 0) / connectedRods.length;

    const plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(plateWidth, 30, plateSKU.depth),
      new THREE.MeshBasicMaterial({ color: 0x8B4513 })
    );
    plateMesh.position.set(centerX, plate.y + 15, 0);
    scene.add(plateMesh);
  });

  // Position camera to look at the scene
  camera.position.set(600, 300, 800);
  camera.lookAt(600, 150, 0);

  renderer.render(scene, camera);
}

// Create and display a sample shelf
const shelf = createEmptyShelf();

const rod1 = addRod({ x: 0, z: 0 }, 1, shelf);
const rod2 = addRod({ x: 600, z: 0 }, 1, shelf);
const rod3 = addRod({ x: 1200, z: 0 }, 4, shelf);

addPlate(1, [rod1, rod2], shelf);
addPlate(1, [rod2, rod3], shelf);

visualizeShelf(shelf);