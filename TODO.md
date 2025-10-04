# Shelf Configurator - TODO List

## Plate Operations


### Make plate visualizations red on hoved when about to remove, or when the add is not possible

### Remove Rod Segments
- [ ] Implement `removeRodSegment(rodId, segmentIndex, shelf)` in `shelf-model.ts`
- [ ] Find compatible shorter rod SKU
- [ ] Check for plate conflicts at removed attachment points
- [ ] Auto-remove or trim affected plates (reuse existing functions)
- [ ] Update rod SKU to match new pattern
- [ ] Add segment-based hit detection in interactions.

### Extend Rods Up and Down
- [ ] Implement `extendRodUp(rodId, newSKU, shelf)` in `shelf-model.ts`
- [ ] Implement `extendRodDown(rodId, newSKU, shelf)` in `shelf-model.ts`
- [ ] Find compatible rod SKU with additional spans
- [ ] Preserve existing plate connections
- [ ] Validate no plate conflicts at new attachment points
- [ ] Update interactions.ts for rod modification UI
- [ ] Add visual feedback for available extension options

### Extend Rods to the Sides
- [ ] Implement `addRodToLeft(existingRodId, shelf)` in `shelf-model.ts`
- [ ] Implement `addRodToRight(existingRodId, shelf)` in `shelf-model.ts`
- [ ] Calculate proper X position (600mm standard gap)
- [ ] Match height/pattern of existing rod or allow customization
- [ ] Update interactions.ts to trigger on click beside rods
- [ ] Add ghost rod preview in shelf_viz.ts

### Change Rod Segment Lengths
- [ ] Implement `changeRodSegmentLength(rodId, segmentIndex, newLength, shelf)` in `shelf-model.ts`
- [ ] Find rod SKU with matching pattern except changed segment
- [ ] Validate plate compatibility with new attachment positions
- [ ] Update or remove conflicting plates
- [ ] Add UI for selecting segment length (20cm/30cm toggle)
- [ ] Show preview of attachment point changes

## General Improvements
- [ ] Add undo/redo system for all operations
- [ ] Improve error messages and user feedback
- [ ] Add validation warnings before destructive operations
- [ ] Implement operation animations in shelf_viz.ts

## Mobile Support
- [ ] Add touch event handlers (touchstart, touchmove, touchend)
- [ ] Implement pinch-to-zoom for camera controls
- [ ] Add touch-friendly UI controls (larger hit targets)
- [ ] Test and optimize performance on mobile devices
- [ ] Add responsive layout for different screen sizes
- [ ] Implement mobile-specific gesture controls (swipe, tap-hold)

## Deployment
- [ ] Publish to GitHub Pages
- [ ] Set up GitHub Actions for automatic deployment
- [ ] Configure custom domain (optional)
- [ ] Add build step in workflow (TypeScript compilation)
- [ ] Test deployed version
