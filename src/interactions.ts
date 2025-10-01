import { type Shelf, removePlate } from './shelf-model.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

export interface InteractionSystem {
  dispose(): void;
}

export function setupInteractions(
  shelf: Shelf,
  camera: any,
  renderer: any,
  plateObjects: THREE.Mesh[]
): InteractionSystem {
  // Raycasting setup
  const raycaster = new THREE.Raycaster();

  function onPlateClick(plateId: number) {
    console.log(`Deleting plate ${plateId}`);
    const success = removePlate(plateId, shelf);

    if (success) {
      console.log(`Plate ${plateId} deleted successfully`);

      // Remove the mesh from the scene and plateObjects array
      const plateObjectIndex = plateObjects.findIndex(obj => obj.userData.plateId === plateId);
      if (plateObjectIndex !== -1) {
        const plateMesh = plateObjects[plateObjectIndex];
        plateMesh.parent?.remove(plateMesh);
        plateObjects.splice(plateObjectIndex, 1);
      }
    } else {
      console.log(`Failed to delete plate ${plateId}`);
    }
  }

  // Pointer event handling for raycasting
  function onPointerMove(event: PointerEvent) {
    const pointer = new THREE.Vector2();
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
    const pointer = new THREE.Vector2();
    // Convert to normalized device coordinates
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(plateObjects);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const plateData = hit.object.userData;
      const plate = shelf.plates.get(plateData.plateId);

      if (plate) {
        onPlateClick(plateData.plateId);
      }
    }
  }

  // Bind pointer events
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerClick);

  // Return cleanup function
  return {
    dispose() {
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerClick);
    }
  };
}