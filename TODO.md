# TODO

**NOTE: Make a git commit for every completed task.**

**Technology choices:**
- Rendering: HTML5 Canvas
- Approach: Compositional rendering (render parent nodes, transform, composite)
- Initial viewport: [-2, 2] × [-2, 2] (configurable at call site)
- Initial canvas size: 800×800 pixels (configurable at call site)

## Implementation Tasks

### Project Setup
- [ ] Create basic HTML file structure
- [ ] Set up JavaScript module structure

### JSON Format Definition
- [ ] Define JSON schema for graph representation
- [ ] Document JSON structure (nodes array with id, base_parent, transform_parent, transform params)

### Core Data Structures
- [ ] Define Node class/structure (id, base_parent, transform_parent, scale, radial_radius, radial_count, rotation)
- [ ] Define Graph class/structure
- [ ] Implement JSON loading with parameter defaults (scale 0→1.0, all params default to 0)
- [ ] Implement graph validation:
  - [ ] Detect cycles
  - [ ] Detect self-references
  - [ ] Detect disconnected nodes (don't trace back to root)
  - [ ] Validate exactly one root node
  - [ ] Validate node ID references
- [ ] Implement error handling (console.error + display in webpage UI)

### Rendering Engine - Core
- [ ] Implement coordinate system (mathematical coords to pixel coords mapping)
- [ ] Implement viewport-to-canvas mapping (takes viewport bounds and canvas size as parameters)
- [ ] Create canvas management utilities

### Rendering Engine - Node Rendering
- [ ] Implement root node rendering (black circle, radius 1.0, antialiased via Canvas native)
- [ ] Implement node iteration (mechanism to render all nodes in graph)
- [ ] Implement compositional rendering for non-root nodes:
  - [ ] Recursively render base_parent to canvas
  - [ ] Recursively render transform_parent to canvas
  - [ ] Apply transformation pipeline to transform_parent canvas
  - [ ] Invert colors of transformed canvas (black ↔ white, preserve alpha)
  - [ ] Composite inverted transform onto base using alpha compositing

### Rendering Engine - Transformations
- [ ] Implement scale transformation
- [ ] Implement radial repeat transformation:
  - [ ] Handle radial_count=0 (no transformation)
  - [ ] Handle radial_count=1 (translate only, no rotation)
  - [ ] Handle radial_count≥2 (rotate + translate each copy)
- [ ] Implement rotate transformation

### User Interface
- [ ] Create HTML page layout
- [ ] Render all nodes in graph as thumbnails
- [ ] Implement thumbnail grid/list display
- [ ] Implement thumbnail click handler to show full-size rendering
- [ ] Add error display area for validation errors
- [ ] Add file input or textarea for JSON graph input

### Testing & Examples
- [ ] Create simple example JSON (single node - just root)
- [ ] Create example with basic transformations (scale, rotate)
- [ ] Create example with radial repeat
- [ ] Create example with multiple nodes and shared parents
- [ ] Test edge cases (radial_count=0, radial_count=1, very small scale)
- [ ] Verify antialiasing renders smoothly
- [ ] Verify color inversion is correct
- [ ] Test validation error cases

### Documentation
- [ ] Add README with:
  - [ ] Project description
  - [ ] Usage instructions
  - [ ] JSON format documentation with examples
- [ ] Add inline code comments for complex logic
