/**
 * Camera Assistant - Automatic camera framing and smart movements
 */

// Declare THREE as global (loaded via CDN)
declare const THREE: any;

export class CameraAssistant {
  private camera: any;
  private controls: any;
  private scene: any;
  private autoFollowEnabled: boolean = true;
  private lastShelfBounds: any = null;
  private userInteracting: boolean = false;
  private interactionTimeout: any = null;

  constructor(camera: any, controls: any, scene: any) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
  }

  /**
   * Enable or disable automatic camera following
   */
  setAutoFollow(enabled: boolean): void {
    this.autoFollowEnabled = enabled;
  }

  /**
   * Mark that user is interacting with camera
   */
  setUserInteracting(interacting: boolean): void {
    this.userInteracting = interacting;

    // Clear any pending timeout
    if (this.interactionTimeout) {
      clearTimeout(this.interactionTimeout);
      this.interactionTimeout = null;
    }
  }

  /**
   * Update camera to follow shelf - call this on every frame or shelf change
   * Includes ghost plates to ensure they remain visible
   */
  updateAutoFrame(): void {
    if (!this.autoFollowEnabled || this.userInteracting) {
      return;
    }

    const box = new THREE.Box3();

    // Include all relevant objects including ghosts
    const relevantObjects = this.scene.children.filter((obj: any) =>
      obj.userData.type === 'rod' ||
      obj.userData.type === 'plate' ||
      obj.userData.type === 'ghost_plate' ||
      obj.userData.type === 'ghost_rod' ||
      obj.userData.type === 'ghost_connection_rod'
    );

    if (relevantObjects.length === 0) {
      return;
    }

    relevantObjects.forEach((obj: any) => box.expandByObject(obj));

    if (box.isEmpty()) {
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Check if bounds changed significantly
    const boundsChanged = !this.lastShelfBounds ||
      Math.abs(this.lastShelfBounds.center.x - center.x) > 10 ||
      Math.abs(this.lastShelfBounds.center.y - center.y) > 10 ||
      Math.abs(this.lastShelfBounds.maxDim - maxDim) > 10;

    if (boundsChanged) {
      this.lastShelfBounds = { center: center.clone(), maxDim };
      this.frameAll(true, 400);
    }
  }

  /**
   * Automatically frame the entire shelf configuration
   * Includes all plates and ghost plates to ensure they're visible
   */
  frameAll(animated = true, duration = 1000): void {
    const box = new THREE.Box3();

    // Include all relevant objects including ghosts
    const relevantObjects = this.scene.children.filter((obj: any) =>
      obj.userData.type === 'rod' ||
      obj.userData.type === 'plate' ||
      obj.userData.type === 'ghost_plate' ||
      obj.userData.type === 'ghost_rod' ||
      obj.userData.type === 'ghost_connection_rod'
    );

    if (relevantObjects.length === 0) {
      this.resetView(animated);
      return;
    }

    relevantObjects.forEach((obj: any) => box.expandByObject(obj));

    if (box.isEmpty()) {
      this.resetView(animated);
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Camera configuration: angled view from above for easier plate interaction
    // Camera is positioned at (center.x, center.y + offsetY, center.z + offsetZ)
    // looking at center, where offsetY/offsetZ = 0.4 (40% upward angle)
    const angleRatio = 0.4; // 40% upward offset

    // Calculate required distance to fit bounding box in frustum
    const fovRad = this.camera.fov * (Math.PI / 180);
    const aspect = this.camera.aspect;

    // For angled camera: we need to consider the effective bounding box
    // as seen from the camera's perspective at the given angle

    // Camera direction vector (normalized): (0, -angleRatio, -1) / length
    const dirLength = Math.sqrt(angleRatio * angleRatio + 1);
    const dirY = -angleRatio / dirLength;
    const dirZ = -1 / dirLength;

    // Project bounding box dimensions onto camera's view plane
    // The most constraining dimensions are:
    // - Horizontal: size.x (width) must fit in horizontal FOV
    // - Vertical: effective height considering angle

    // For vertical: bounding box height + extra vertical extent due to angle
    const effectiveHeight = size.y + size.z * Math.abs(dirY);

    // Distance needed to fit horizontal extent
    const horizontalFOV = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
    const distanceForWidth = (size.x / 2) / Math.tan(horizontalFOV / 2);

    // Distance needed to fit vertical extent
    const distanceForHeight = (effectiveHeight / 2) / Math.tan(fovRad / 2);

    // Use the larger distance to ensure everything fits
    const baseDistance = Math.max(distanceForWidth, distanceForHeight);

    // Distance is measured along the camera direction vector
    // offsetZ = baseDistance, offsetY = baseDistance * angleRatio
    const offsetZ = baseDistance;
    const offsetY = baseDistance * angleRatio;

    // Cap at maximum allowed distance
    const isMobileViewport = window.innerWidth < 768;
    const maxAllowedDistance = isMobileViewport ? 14000 : 18000;
    const cappedOffsetZ = Math.min(offsetZ, maxAllowedDistance);
    const cappedOffsetY = cappedOffsetZ * angleRatio;

    // Position camera at calculated offset from center
    const targetPosition = new THREE.Vector3(
      center.x,
      center.y + cappedOffsetY,
      center.z + cappedOffsetZ
    );

    // Look at center
    const target = new THREE.Vector3(center.x, center.y, center.z);

    if (animated) {
      this.animateCameraTo(targetPosition, target, duration);
    } else {
      this.camera.position.copy(targetPosition);
      this.controls.target.copy(target);
      this.controls.update();
    }
  }

  /**
   * Focus camera on a specific object
   */
  focusObject(object: any, animated = true, duration = 800): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let distance = Math.abs(maxDim / Math.tan(fov / 2));
    distance *= 2.5; // Comfortable viewing distance

    // Position camera at 45-degree angle
    const offset = new THREE.Vector3(0, distance * 0.5, distance * 0.9);
    const targetPosition = center.clone().add(offset);

    if (animated) {
      this.animateCameraTo(targetPosition, center, duration);
    } else {
      this.camera.position.copy(targetPosition);
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  /**
   * Smart framing when objects are added/removed
   */
  onObjectAdded(object: any): void {
    // Trigger immediate update to include new object
    this.updateAutoFrame();
  }

  onObjectRemoved(): void {
    // Trigger immediate update to reframe remaining objects
    this.updateAutoFrame();
  }

  /**
   * Called when shelf geometry changes (add/remove plates or rods)
   */
  onShelfChange(): void {
    // Reset bounds to force reframe on next update
    this.lastShelfBounds = null;

    // Force immediate update
    if (this.autoFollowEnabled) {
      // Temporarily allow update even if user is interacting (for builds)
      const wasInteracting = this.userInteracting;
      this.userInteracting = false;
      this.updateAutoFrame();
      this.userInteracting = wasInteracting;
    }
  }

  /**
   * Smooth camera animation
   */
  private animateCameraTo(
    targetPos: any,
    targetLookAt: any,
    duration: number
  ): void {
    const startPos = this.camera.position.clone();
    const startLookAt = this.controls.target.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.controls.target.lerpVectors(startLookAt, targetLookAt, eased);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Return to default view
   */
  resetView(animated = true): void {
    const defaultPos = new THREE.Vector3(0, 400, 1000);
    const defaultTarget = new THREE.Vector3(0, 150, 100);

    if (animated) {
      this.animateCameraTo(defaultPos, defaultTarget, 1000);
    } else {
      this.camera.position.copy(defaultPos);
      this.controls.target.copy(defaultTarget);
      this.controls.update();
    }
  }
}
