import { type Shelf } from './shelf-model.js';
import { encodeShelf, applyEncodedState } from './shelf-encoding.js';

interface HistoryEntry {
  encoded: string;        // Encoded shelf state
  timestamp: number;      // When this state was created
  actionType?: string;    // Optional: type of action for debugging
}

/**
 * Manages undo/redo functionality for shelf configurations.
 * Stores encoded shelf states in a history stack.
 */
export class UndoManager {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 150;
  private shelf: Shelf;
  private rebuildCallback?: () => void;

  constructor(shelf: Shelf, rebuildCallback?: () => void) {
    this.shelf = shelf;
    this.rebuildCallback = rebuildCallback;
  }

  /**
   * Save the current shelf state to history.
   * Truncates any future states if we're not at the end.
   */
  saveState(actionType?: string): void {
    const encoded = encodeShelf(this.shelf);

    // Truncate future history if we're in the middle
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new entry
    this.history.push({
      encoded,
      timestamp: Date.now(),
      actionType
    });

    // Trim old states if over max size
    if (this.history.length > this.maxSize) {
      this.history.shift(); // Remove oldest
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Undo to the previous state.
   * @returns true if undo was successful, false otherwise
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    this.currentIndex--;
    const entry = this.history[this.currentIndex];

    const success = applyEncodedState(entry.encoded, this.shelf);

    if (success && this.rebuildCallback) {
      this.rebuildCallback();
    }

    return success;
  }

  /**
   * Redo to the next state.
   * @returns true if redo was successful, false otherwise
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.currentIndex++;
    const entry = this.history[this.currentIndex];

    const success = applyEncodedState(entry.encoded, this.shelf);

    if (success && this.rebuildCallback) {
      this.rebuildCallback();
    }

    return success;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get the current history size.
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Get the current position in history.
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get debug information about the current state.
   */
  getDebugInfo(): { size: number; index: number; canUndo: boolean; canRedo: boolean } {
    return {
      size: this.getHistorySize(),
      index: this.getCurrentIndex(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}
