# TODO

**NOTE: Make a git commit for every completed task.**

## Implementation Tasks

### Core Data Structures
- [ ] Define Node class/structure
- [ ] Define Graph class/structure with validation
- [ ] Implement JSON loading with parameter defaults (scale 0→1.0, etc.)
- [ ] Implement graph validation (cycles, self-references, disconnected nodes, root count)

### Rendering Engine
- [ ] Implement coordinate system and viewport mapping
- [ ] Implement root node rendering (black circle, radius 1.0)
- [ ] Implement transformation pipeline:
  - [ ] Scale transformation
  - [ ] Radial repeat transformation
  - [ ] Rotate transformation
- [ ] Implement color inversion
- [ ] Implement alpha compositing
- [ ] Implement antialiasing

### Rendering Approaches
- [ ] Implement compositional rendering (render parent nodes, transform, composite)
- [ ] OR implement point-wise rendering (trace graph for each pixel)

### User Interface
- [ ] Create HTML page structure
- [ ] Render all nodes as thumbnails
- [ ] Implement thumbnail click handler to show full-size view
- [ ] Add viewport/canvas size configuration UI (optional)

### Testing & Examples
- [ ] Create example JSON graphs for testing
- [ ] Test basic transformations
- [ ] Test complex graphs with multiple nodes
- [ ] Verify antialiasing works correctly
- [ ] Verify color inversion is correct

### Documentation
- [ ] Add README with usage instructions
- [ ] Document JSON format with examples
- [ ] Add inline code documentation
