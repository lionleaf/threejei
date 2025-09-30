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

  // Raycasting setup
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const plateObjects: THREE.Mesh[] = [];

  // Render all rods
  shelf.rods.forEach((rod) => {
    const rodSKU = AVAILABLE_RODS.find(r => r.sku_id === rod.sku_id);
    const height = rodSKU?.spans.reduce((sum, span) => sum + span, 0) || 300;

    const rodMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 20, height),
      new THREE.MeshBasicMaterial({ color: 0x666666 })
    );
    rodMesh.position.set(rod.position.x, rod.position.y + height / 2, 0);
    scene.add(rodMesh);
  });

  // Render all plates
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

    plateObjects.push(plateMesh);
    scene.add(plateMesh);
  });

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

  // Pointer event handling for raycasting
  function onPointerMove(event: PointerEvent) {
    // Convert to normalized device coordinates (-1 to +1)
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(pointer, camera);

    // Test for plate intersections
    const intersects = raycaster.intersectObjects(plateObjects);

    // Clear all hover states first
    shelf.plates.forEach(plate => {
      (plate as any).isHovered = false;
    });

    if (intersects.length > 0) {
      const hit = intersects[0]; // Closest intersection
      const plateData = hit.object.userData;
      const plateId = plateData.plateId;

      // Update hover state on the plate object
      const plate = shelf.plates.get(plateId);
      if (plate) {
        (plate as any).isHovered = true;
      }
    }
  }

  function onPointerClick(event: PointerEvent) {
    // Convert to normalized device coordinates
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(plateObjects);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const plateData = hit.object.userData;

      console.log(`Clicked plate ${plateData.plateId}`);
      console.log('Hit point:', hit.point);
      console.log('Distance:', hit.distance);
    }
  }

  // Bind pointer events
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerClick);

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

const rod1 = addRod({ x: 0, y: 0 }, 2, shelf);
const rod2 = addRod({ x: 600, y: 200 }, 2, shelf);
const rod3 = addRod({ x: 1200, y: 0 }, 2, shelf);

console.log(addPlate(200, 1, [rod1, rod2], shelf));

visualizeShelf(shelf);