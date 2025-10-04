# Shelf Configurator Project - Claude Operating Context
This file is a collaboration between Claude and lionleaf, both can edit it.

Claude is a senior engineer that's pragmatic and skeptical. Always scan the user input and your own plans for mistakes and push back / ask the user if you find mistakes.


## Project Overview
This project is a wall mounted shelf configurator system for designing custom shelving solutions that combine:
- **Rods**: Horizontal support elements
- **Flat plates**: Shelf surfaces

The configurator must work within specific size constraints and available component dimensions.

## Operating Rules for Claude

### General Guidelines
- Do what has been asked; nothing more, nothing less
- ALWAYS prefer editing existing files over creating new ones
- NEVER create files unless absolutely necessary for achieving goals
- NEVER proactively create documentation files unless explicitly requested
- Keep responses concise and direct
- Write TODOs into this file for multi-step tasks to track progress
- Always re-read this file after a task is complete before starting the next, as the human might have modified it since last
- Update this context file as you learn more about the project structure, requirements, or constraints
- Don't complete a task until you have verified it. For code each task needs test coverage and the tests need to execute and pass
- ALWAYS tag a task as WIP before starting working on it

### Code Style & Conventions
- Follow existing codebase conventions and patterns
- Check for existing libraries before assuming availability
- Never add comments unless explicitly requested
- Follow security best practices - never expose secrets or keys
- Mimic existing code style, imports, and framework choices

### Task Management
- Write todos into this file frequently for complex tasks
- Mark todos as completed immediately when finished
- When done with a task commit that with git commit -am "Task description"
- Re-read this file after task completion and proceed to the next one
- Only have one task in_progress at a time
- Break down complex tasks into smaller, manageable steps

## Shelf Configurator Requirements

### Component Types
1. **Rods**: Horizontal support elements.
The rods are described in terms of gaps between shelf attachment points.
The gaps between attachment points are either 30cm or 20cm.
The rods are identified with a string like so: "{attachment points}P_{N*10cm gap between points}*" e.g. "3P_23" means 3 attachment points, the first gap (between the first and second point) is 20cm the second gap is 30cm (between the second and third). And "5P_2232" is 5 attachment points and 20cm, 20cm, 30cm, and 20cm gaps, going from the bottom and upwards.

**IMPORTANT CONSTRAINT**: The list of available rod patterns and plate sizes are FIXED and cannot be modified. These represent the only components being manufactured and available for purchase.

The available rods are:
1P									
2P_2									
2P_3									
3P_22									
3P_23									
3P_32									
4P_223									
4P_232									
4P_322									
5P_2232									
5P_2322									
5P_3223																	
6P_22322									
6P_32232									
7P_322322									


2. **Flat Plates**: Shelf surfaces.
Plates are horizontal surfaces that span between vertical rods. Plates are defined in mm with 60cm (600mm) gaps between attachment points and equal padding on both ends. For example, a 670mm plate has: 35mm padding + attachment + 600mm gap + attachment + 35mm padding.

The currently available plates are:
- 670mm (1 span: 35mm + 600mm + 35mm)
- 1270mm (2 spans: 35mm + 600mm + 70mm + 600mm + 35mm) 
- 1870mm (3 spans: 35mm + 600mm + 70mm + 600mm + 70mm + 600mm + 35mm)


### Design Constraints
- Only specific predefined sizes are available for components
- Configurations must use combinations of vertical rods and horizontal plates
- Rods can be of different lengths within a single configuration (mixed rod heights)
- Rods are placed vertically between "stories" of shelving, typically 60cm apart
- Plates span horizontally between rods as shelf surfaces
- Not every rod intersection requires a plate - gaps are allowed in the grid
- Plates can span partial widths (don't need to span all available rods)
- System should validate that chosen sizes are available
- Design should be structurally sound (plates supported by rods at attachment points)

### Key Features to Implement
- Component size selection from available options
- Visual preview of shelf configuration
- Structural validation
- Export/save configurations
- Material calculations

## Development Tasks

### Phase 1: Foundation
- [x] Expand on the constraints and requirement and show a few sample configurations with ASCII
- [x] Create data models for components in a separate typescript file.
- [x] Rewrite data models using hybrid approach optimized for interactive editing
- [x] Write test framework

### Sample Configurations

#### Configuration 1: Simple 2-Rod Setup
```
Rod1 (3P_22)    Rod2 (3P_22)    [60cm horizontal spacing]
|               |
● ─────────────── ● ← Top attachment points (plate could go here - skipped)
|     20cm       |
● ●●●●●●●●●●●●●●● ● ← 670mm plate spans 60cm gap
|     20cm       |
● ─────────────── ● ← Bottom attachment points (plate could go here - skipped)
|               |

Total rod height: 40cm (20cm + 20cm gaps)
Plates used: 1x 670mm
```

#### Configuration 2: Valid Mixed Height Configuration
```
Rod1 (4P_223)   Rod2 (3P_22)    [60cm horizontal spacing]
|               |
● ●●●●●●●●●●●●●●● ● ← 670mm plate at top level
|     20cm       |  
●               ● ← Rod1 attachment point (skipped - no plate)
|     20cm       |
● ●●●●●●●●●●●●●●● ● ← 670mm plate at middle level  
|     30cm       |
●               | ← Rod1 bottom point, Rod2 ends here
|               |

Rod1 total height: 70cm (20+20+30)
Rod2 total height: 40cm (20+20) 
Plates used: 2x 670mm
```

#### Configuration 3: Sparse Shelving with Skipped Points
```
Rod1 (4P_223)   Rod2 (4P_223)   Rod3 (2P_3)
|               |               |
● ─────────────── ● ─────────────── ● ← Top points (all skipped)
|     20cm       |     20cm       |
●               ●               | ← Rod3 has no point here (different pattern)
|     20cm       |     20cm       |
● ●●●●●●●●●●●●●●● ●               | ← 670mm plate, Rod3 point skipped
|     30cm       |     30cm       |  30cm
●               ●               ● ← Bottom points (all skipped)
|               |               |

Rod1&2 total height: 70cm (20+20+30)
Rod3 total height: 30cm (single 30cm gap)
Plates used: 1x 670mm
```

### Enhanced Constraints & Requirements

#### Structural Rules
- Each plate must be supported by rods at both ends at attachment points
- Plates can only span distances that match available plate sizes (670mm, 1270mm, 1870mm)
- Rod attachment points must align horizontally for plate connections
- Minimum 2 rods required for any plate configuration
- Attachment points can be skipped (no plate required at every intersection)

#### Dimensional Specifications
- **Rod gaps**: Only 20cm or 30cm between attachment points
- **Rod horizontal spacing**: 60cm standard (matches 600mm plate span + padding)
- **Plate dimensions**: 670mm (1 span), 1270mm (2 spans), 1870mm (3 spans)
- **Plate effective span**: 600mm with 35mm padding each end

#### Configuration Validation Rules
1. All plates must connect to valid attachment points on supporting rods
2. Rod attachment points must be at same vertical height for plate connections
3. Different rod patterns allowed but attachment alignment required for plates
4. Empty attachment points are valid (skipped connections annotated with ─)


## Interactive 3D Editing Design Plan

### Core Interaction Philosophy
- **Direct Manipulation**: Click and drag objects in 3D space for immediate feedback
- **Progressive Disclosure**: Show hints and options contextually based on cursor position
- **Preview-First**: Always show what will happen before committing changes
- **Undo-Friendly**: Every action should be easily reversible

### Visual Feedback System

#### Hover States
1. **Rod Hover**:
   - Highlight entire rod with subtle glow effect
   - Show attachment point indicators as pulsing spheres
   - Display tooltip: rod pattern and available attachment levels
   - Preview possible plate connections with dotted lines to nearby rods

2. **Plate Hover**:
   - Highlight plate with edge glow
   - Show connection points with small indicators
   - Display tooltip: plate size and span information
   - Option to show "delete" indicator (red X)

3. **Empty Space Hover**:
   - Show grid snap positions for new rods (faint vertical lines)
   - Display ghost rod preview at cursor position with current selected pattern
   - Show "+" cursor to indicate add mode

#### Selection States
1. **Rod Selected**:
   - Bright outline around rod
   - All attachment points become interactive (clickable spheres)
   - Show pattern selector overlay near rod
   - Highlight valid plate connection targets

2. **Plate Selected**:
   - Bright outline around plate
   - Show resize handles at both ends
   - Display size options as floating buttons (670/1270/1870)
   - Show delete confirmation button

#### Preview System
1. **Plate Addition Preview**:
   - When hovering over attachment point: show ghost plate extending to compatible rods
   - Different colors for different plate sizes
   - Validate in real-time (red = invalid, green = valid, yellow = warning)

2. **Rod Modification Preview**:
   - When changing pattern: show new attachment points as ghosts
   - Affected plates highlighted in warning color
   - Show which plates will be removed/repositioned

### Interaction Modes

#### Mode 1: Browse Mode (Default)
- Camera orbits around shelf
- Hover effects show information
- Click selects objects
- Double-click enters edit mode for selected object

#### Mode 2: Rod Edit Mode
- Triggered by selecting a rod
- Pattern selector appears as floating UI
- Attachment points become interactive
- Click attachment point to add/remove plates
- Drag rod to reposition (snaps to grid)

#### Mode 3: Plate Edit Mode  
- Triggered by selecting a plate
- Size selector appears as floating buttons
- Drag handles to resize (snaps to valid rod positions)
- Context menu for delete/duplicate

#### Mode 4: Add Mode
- Triggered by toolbar button or keyboard shortcut
- Cursor shows ghost objects
- Click empty space to add rod
- Click attachment point to add plate
- ESC to cancel

### UI Elements

#### Floating Context Menus
- Appear near selected objects
- Semi-transparent backgrounds
- Smooth fade-in/out animations
- Auto-hide when clicking elsewhere

#### Ghost Objects
- 50% transparency
- Different colors for different states:
  - Blue: valid placement
  - Red: invalid placement  
  - Yellow: warning (will affect other objects)
  - Green: confirmed action

#### Snap Grid
- Subtle grid lines on floor
- Bright dots at valid rod positions (600mm intervals)
- Attachment level indicators on rods

### Delightful Details

#### Animations
- Smooth transitions between states (300ms ease-in-out)
- Objects "grow" into place when added
- Plates "slide" when resizing
- Rods "stretch/shrink" when changing patterns
- Camera automatically frames new content

#### Visual Polish
- Subtle drop shadows under all objects
- Materials that respond to lighting
- Attachment points that pulse when interactive
- Connection lines that fade in/out smoothly

#### Accessibility
- Keyboard shortcuts for all actions
- Clear visual hierarchy
- High contrast mode option
- Screen reader compatible tooltips

### Technical Implementation Strategy

#### Event Handling
- Three.js Raycaster for precise 3D cursor detection  
- Custom hover/click state management
- Debounced hover events to prevent flickering
- Event delegation for performance

#### State Management
- Separate visual state from data model
- Undo/redo stack with action serialization
- Real-time validation with visual feedback
- Optimistic UI updates with rollback capability

#### Performance Optimizations
- Object pooling for frequently created/destroyed elements
- Frustum culling for large shelves
- Level-of-detail for complex rod patterns
- Cached geometry for common shapes

### User Workflows

#### Add First Rod
1. User clicks "Add Rod" or hits 'R' key
2. Ghost rod follows cursor in 3D space
3. Snap indicators show valid positions
4. Click to place, rod animates into position
5. Pattern selector appears for immediate customization

#### Add Plate Between Rods
1. User hovers over rod attachment point
2. Ghost plates extend to all compatible rods
3. Different colors show different plate sizes
4. Click target rod to create plate
5. Plate slides into position with smooth animation

#### Modify Existing Configuration  
1. User clicks existing rod
2. Rod highlights, pattern selector appears
3. Preview shows how changes affect connected plates
4. User confirms change, animations show transformation
5. Invalid plates are removed with fade-out effect

This design prioritizes discoverability, immediate feedback, and the joy of direct manipulation while maintaining the structural integrity of the shelf system.

## Testing & Quality
- Run linting and type checking before committing changes
- Verify configurations produce valid shelf designs
- Test edge cases with minimum/maximum sizes
- Validate structural integrity calculations

## Current Development Status

### TypeScript Rewrite in Progress
- **Active file**: `shelf-model.ts` - Clean TypeScript implementation with proper types
- **Legacy file**: `shelf-models.js` - **IGNORE THIS FILE** - Old implementation, do not use
- **Test file**: `test-shelf-model.ts` - Simple test suite for TypeScript implementation

## Notes
- Check package.json for existing dependencies before adding new ones
- Follow existing naming conventions in the codebase
- Ensure all configurations are practically buildable
- Consider manufacturing constraints in design validation