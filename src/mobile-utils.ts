/**
 * Mobile device detection and optimization utilities
 */

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
export const isTablet = /(iPad|Android)/.test(navigator.userAgent) && window.innerWidth >= 768;
export const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : false;
export const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/**
 * Get appropriate device pixel ratio for rendering
 * Caps at 2x on mobile to save battery and improve performance
 */
export function getDevicePixelRatio(): number {
  if (isMobile) {
    return Math.min(window.devicePixelRatio, 2);
  }
  return window.devicePixelRatio;
}

/**
 * Determine if reduced quality settings should be used
 */
export function shouldUseReducedQuality(): boolean {
  return isMobile || isLowEndDevice;
}

/**
 * Check if currently in mobile viewport
 * More reliable than user agent for responsive design
 */
export function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

/**
 * Check if currently in tablet viewport
 */
export function isTabletViewport(): boolean {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

/**
 * Check if currently in landscape mode
 */
export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

/**
 * Check if currently in portrait mode
 */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}
