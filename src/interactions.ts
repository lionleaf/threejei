import { type Shelf, removePlate, tryFillGapWithPlate } from './shelf-model.js';

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

export interface InteractionSystem {
  dispose(): void;
}

export interface RegenerationCallbacks {
  rebuildGeometry: () => void;
}

export function setupInteractions(
  shelf: Shelf,
  scene: any,
  camera: any,
  renderer: any,
  callbacks: RegenerationCallbacks
): InteractionSystem {
  // Raycasting setup
  const raycaster = new THREE.Raycaster();

  function onPlateClick(plateId: number) {
    console.log(`Deleting plate ${plateId}`);
    const success = removePlate(plateId, shelf);

    if (success) {
      console.log(`Plate ${plateId} deleted successfully`);
      callbacks.rebuildGeometry();
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

    // Test for intersections with all scene objects (recursive: true checks nested objects)
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Clear all hover states first
    shelf.plates.forEach(plate => {
      (plate as any).isHovered = false;
    });
    scene.children.forEach((child: any) => {
      if (child.userData?.type === 'gap' && child.material) {
        child.material.opacity = 0.0;
      }
    });

    // Find first hit with userData.type (either plate or gap)
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        const plate = shelf.plates.get(userData.plateId);
        if (plate) {
          (plate as any).isHovered = true;
        }
        break; // Plates take priority
      } else if (userData?.type === 'gap') {
        (hit.object.material as any).opacity = 0.4;
        break;
      }
    }
  }

  function onPointerClick(event: PointerEvent) {
    const pointer = new THREE.Vector2();
    // Convert to normalized device coordinates
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Find first hit with userData.type (either plate or gap)
    for (const hit of intersects) {
      const userData = hit.object.userData;

      if (userData?.type === 'plate') {
        onPlateClick(userData.plateId);
        break; // Plates take priority
      } else if (userData?.type === 'gap') {
        console.log(`Filling gap between rods ${userData.rodIds} at height ${userData.y}`);
        const plateId = tryFillGapWithPlate(userData.rodIds[0], userData.rodIds[1], userData.y, shelf);

        if (plateId !== -1) {
          console.log(`Gap filled successfully with plate ${plateId}`);
          callbacks.rebuildGeometry();
        } else {
          console.log(`Failed to fill gap`);
        }
        break;
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