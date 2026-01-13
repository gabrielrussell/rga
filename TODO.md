# TODO - Kaleidoscope WebGL Renderer

**NOTE: Make a git commit for every completed task.**

## Project Setup
- [ ] Create basic HTML file structure
- [ ] Set up JavaScript module structure
- [ ] Initialize git repository
- [ ] Add .gitignore for common files

## Graph Data Structures (Reuse from RGA)
- [ ] Copy Node and Graph classes from RGA
- [ ] Verify JSON loading works
- [ ] Verify graph validation (cycles, connectivity, etc.)
- [ ] Test with RGA example files

## WebGL Foundation
- [ ] Create WebGL context setup utility
- [ ] Implement shader compilation helpers (compile, link, error handling)
- [ ] Create basic vertex shader (fullscreen quad)
- [ ] Set up viewport and coordinate system

## Fragment Shader - Basic Structure
- [ ] Create fragment shader file structure
- [ ] Implement viewport-to-mathematical coordinate conversion
- [ ] Add uniform declarations for graph data
- [ ] Implement node data access functions (getNodeScale, etc.)

## Root Circle Rendering
- [ ] Implement signed distance function for circle
- [ ] Add antialiasing using smoothstep
- [ ] Test root-only rendering
- [ ] Verify circle is centered at (0,0) with radius 1.0

## Inverse Transformations
- [ ] Implement inverse rotation function
- [ ] Implement inverse scale function
- [ ] Implement inverse radial repeat (return array of candidates)
- [ ] Handle radial_count = 0 (no transformation)
- [ ] Handle radial_count = 1 (translate only)
- [ ] Handle radial_count >= 2 (rotate + translate copies)
- [ ] Test transformation pipeline with simple cases

## Recursive Node Evaluation
- [ ] Implement evaluateNode function (recursive)
- [ ] Add base case for root node
- [ ] Add recursive case for non-root nodes
- [ ] Implement color inversion for transform parent
- [ ] Implement alpha compositing
- [ ] Add maximum recursion depth limit (prevent infinite loops)

## Graph Data Upload to GPU
- [ ] Create JavaScript function to extract graph data arrays
- [ ] Upload node data to shader uniforms
- [ ] Pass target node ID to shader
- [ ] Test data transfer with console logging in shader (if possible)

## Color System (Simple Initial)
- [ ] Implement basic black/white rendering
- [ ] Add color inversion logic
- [ ] Verify compositing produces expected results

## Supersampling Antialiasing
- [ ] Add supersample factor uniform (1 = no AA, 2 = 4 samples, etc.)
- [ ] Implement NxN subpixel sampling loop in fragment shader
- [ ] Average subpixel results
- [ ] Test with/without supersampling
- [ ] Make configurable via UI

## User Interface - Basic
- [ ] Create HTML layout
- [ ] Add canvas element
- [ ] Add node selector dropdown
- [ ] Create parameter sliders (scale, radial_radius, radial_count, rotation)
- [ ] Wire up slider events to re-render
- [ ] Display current node info

## User Interface - Graph Management
- [ ] Add JSON import textarea/file input
- [ ] Add JSON export button
- [ ] Add example selector dropdown
- [ ] Add "New Graph" button (create root-only graph)
- [ ] Add error display area
- [ ] Show validation errors to user

## Node Editing
- [ ] Implement node selection
- [ ] Update sliders when node selected
- [ ] Allow creating new nodes
- [ ] Allow deleting nodes (with validation)
- [ ] Update parent selectors (base_parent, transform_parent dropdowns)

## Testing with Examples
- [ ] Copy example files from RGA
- [ ] Test simple-root.json
- [ ] Test scale-rotate.json
- [ ] Test radial-repeat.json
- [ ] Test complex examples
- [ ] Verify visual results match RGA output

## Performance Optimization
- [ ] Add FPS counter
- [ ] Test with larger graphs (~20 nodes)
- [ ] Profile shader performance
- [ ] Optimize hot paths if needed
- [ ] Add performance settings UI (supersample factor)

## Documentation
- [ ] Add README with project description
- [ ] Document controls and usage
- [ ] Add comments to shader code
- [ ] Document limitations (max nodes, etc.)

## Polish
- [ ] Handle window resize
- [ ] Add keyboard shortcuts if useful
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Test cross-browser compatibility
