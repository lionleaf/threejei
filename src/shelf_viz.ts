// Import functions from shelf-model.ts
import {
  createEmptyShelf,
  addRod,
  addPlate,
  AVAILABLE_RODS,
  AVAILABLE_PLATES,
  type Shelf
} from './shelf-model.js';

import { setupInteractions } from './interactions.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

// Debug flag to make colliders visible
const DEBUG_SHOW_COLLIDERS = false;

// Rebuild all shelf geometry (rods, plates, gap colliders)
function rebuildShelfGeometry(shelf: Shelf, scene: any): void {
  // Remove all existing shelf geometry from scene
  const objectsToRemove = scene.children.filter((child: any) =>
    child.userData?.type === 'rod' ||
    child.userData?.type === 'plate' ||
    child.userData?.type === 'gap' ||
    child.userData?.type === 'attachment_point' ||
    child.userData?.type === 'connection_point'
  );
  objectsToRemove.forEach((obj: any) => scene.remove(obj));

  // Generate rod geometry (each logical rod is two physical rods)
  shelf.rods.forEach((rod, rodId) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const height = rodSKU?.spans.reduce((sum, span) => sum + span, 0) || 40;

    // Plate depth is 200mm, rods are at the front (Z=0) and back (Z=200) edges
    const plateDepth = 200;
    const zPositions = [0, plateDepth];

    // Create two rods - one at front, one at back
    zPositions.forEach(zPos => {
      const rodMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(20, 20, height),
        new THREE.MeshBasicMaterial({ color: 0x666666 })
      );
      rodMesh.position.set(rod.position.x, rod.position.y + height / 2, zPos);
      rodMesh.userData = { type: 'rod', rodId: rodId };
      scene.add(rodMesh);

      // Add attachment point indicators on each rod
      rod.attachmentPoints.forEach(ap => {
        const attachmentY = rod.position.y + ap.y;
        const hasPlate = ap.plateId !== undefined;

        // Create small cylinder at attachment point
        const pointGeometry = new THREE.CylinderGeometry(25, 25, 10); // radius 25, height 10
        const pointMaterial = new THREE.MeshBasicMaterial({
          color: hasPlate ? 0x8B4513 : 0xCCCCCC, // Brown if has plate, light gray if empty
          transparent: true,
          opacity: hasPlate ? 0.8 : 0.5
        });

        const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
        pointMesh.position.set(rod.position.x, attachmentY, zPos);
        pointMesh.userData = { type: 'attachment_point' };
        scene.add(pointMesh);
      });
    });
  });

  // Generate plate geometry
  shelf.plates.forEach((plate, plateId) => {
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
    plateMesh.position.set(centerX, plate.y, plateSKU.depth / 2);

    // Store plate data for raycasting
    plateMesh.userData = {
      type: 'plate',
      plateId: plateId,
      shelf: shelf
    };

    scene.add(plateMesh);

    // Add connection point indicators on plates (at both rod positions)
    const rodZPositions = [0, plateSKU.depth];

    connectedRods.forEach(rod => {
      rodZPositions.forEach(zPos => {
        // Small cylinder at each connection point on the plate
        const connectionGeometry = new THREE.CylinderGeometry(6, 6, 35);
        const connectionMaterial = new THREE.MeshBasicMaterial({
          color: 0x444444, // Dark gray for subtle appearance
          transparent: true,
          opacity: 0.6
        });

        const connectionMesh = new THREE.Mesh(connectionGeometry, connectionMaterial);
        connectionMesh.position.set(rod.position.x, plate.y, zPos);
        connectionMesh.userData = { type: 'connection_point' };
        scene.add(connectionMesh);
      });
    });
  });

  // Generate gap colliders
  const rods = Array.from(shelf.rods.entries()).sort((a, b) => a[1].position.x - b[1].position.x);

  // Check each adjacent rod pair
  for (let i = 0; i < rods.length - 1; i++) {
    const [leftRodId, leftRod] = rods[i];
    const [rightRodId, rightRod] = rods[i + 1];

    // Calculate distance between rods
    const gapDistance = rightRod.position.x - leftRod.position.x;

    // Find attachment points at matching Y heights on both rods
    for (const leftAP of leftRod.attachmentPoints) {
      const leftY = leftRod.position.y + leftAP.y;

      for (const rightAP of rightRod.attachmentPoints) {
        const rightY = rightRod.position.y + rightAP.y;

        // Check if attachment points align and there isn't already a plate spanning the gap
        const plateSpanningGap = (leftAP.plateId === rightAP.plateId) && leftAP.plateId != undefined;
        if (leftY === rightY && !plateSpanningGap) {
          // Create invisible collider
          const centerX = (leftRod.position.x + rightRod.position.x) / 2;

          const colliderGeometry = new THREE.BoxGeometry(gapDistance, 30, 200);
          const colliderMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: DEBUG_SHOW_COLLIDERS ? 0.2 : 0.0
          });

          const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
          collider.position.set(centerX, leftY, 200 / 2);

          // Store metadata for interaction handling
          collider.userData = {
            type: 'gap',
            rodIds: [leftRodId, rightRodId],
            y: leftY,
          };

          scene.add(collider);
        }
      }
    }
  }
}

// General shelf visualizer
function visualizeShelf(shelf: Shelf): void {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x444444);
  document.body.appendChild(renderer.domElement);

  // Initial geometry rendering
  rebuildShelfGeometry(shelf, scene);

  // Calculate shelf center for camera target
  const rods = Array.from(shelf.rods.values());
  const xPositions = rods.map(rod => rod.position.x);
  const yPositions = rods.map(rod => rod.position.y);
  const minX = Math.min(...xPositions);
  const maxX = Math.max(...xPositions);
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2 + 150; // Add typical shelf height

  // Set up OrbitControls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;

  // Set camera target to shelf center
  controls.target.set(centerX, centerY, 0);

  // Position camera for wall-mounted shelf view (looking at XY plane from positive Z)
  const shelfWidth = maxX - minX;
  const shelfHeight = maxY - minY + 300; // Add rod height
  const cameraDistance = Math.max(shelfWidth, shelfHeight) * 0.8 + 400;
  camera.position.set(centerX, centerY, cameraDistance);
  controls.update();

  // Setup interactions with regeneration callback
  const interactions = setupInteractions(
    shelf,
    scene,
    camera,
    renderer,
    {
      rebuildGeometry: () => { rebuildShelfGeometry(shelf, scene); }
    }
  );

  // Handle window resize
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onWindowResize);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// Create and display a sample shelf
const shelf = createEmptyShelf();

const rod1 = addRod({ x: 0, y: 0 }, 6, shelf);
const rod2 = addRod({ x: 600, y: 0 }, 6, shelf);
addRod({ x: 1200, y: 0 }, 15, shelf);
addRod({ x: 1800, y: 0 }, 15, shelf);
addRod({ x: 2400, y: 0 }, 15, shelf);
addRod({ x: 3000, y: 0 }, 15, shelf);

console.log(addPlate(200, 1, [rod1, rod2], shelf));

visualizeShelf(shelf);