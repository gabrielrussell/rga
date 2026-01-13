# Kaleidoscope - WebGL Point-wise Graph Renderer

Real-time WebGL/GLSL-based renderer for hierarchical graph structures using point-wise (backward tracing) evaluation.

## Current Status

### Implemented
- ✅ Basic WebGL 2.0 setup with fragment shader rendering
- ✅ Graph data structures (Node, Graph) with validation
- ✅ Root circle rendering using signed distance function
- ✅ Inverse transformation pipeline (rotation, scale)
- ✅ Recursive node evaluation in shader
- ✅ Configurable supersampling antialiasing
- ✅ UI for node editing and parameter adjustment
- ✅ Real-time rendering with FPS counter

### Known Limitations (To Fix)
- ⚠️ Inverse radial repeat only handles first copy (needs proper multi-candidate logic)
- ⚠️ Color compositing uses max() instead of proper alpha blending
- ⚠️ No JSON import/export yet
- ⚠️ No example files loaded
- ⚠️ Maximum 256 nodes due to uniform array limits

### What Should Work
1. **Root node only**: Create new graph → should see white circle on black background
2. **Simple child node**: Create node with root as both parents, adjust scale → should work
3. **Rotation**: Adjust rotation slider → should see rotation
4. **Scale**: Adjust scale → should see scaling

### What Won't Work Yet
1. **Radial repeat**: Will only show one copy instead of N copies
2. **Complex graphs**: Multi-level hierarchies may have visual artifacts

## Usage

1. Start a local server:
   ```bash
   python3 -m http.server 8001
   ```

2. Open browser to `http://localhost:8001`

3. Test basic functionality:
   - Default graph shows root node (white circle)
   - Click "Create New Node" to add a child
   - Adjust sliders to see transformations
   - Select different nodes to render them

## Architecture

### Fragment Shader Flow
```
For each pixel (x, y):
  1. Convert pixel coords to mathematical coords
  2. Evaluate target node at (x, y):
     - If root: use SDF for circle
     - If non-root:
       a. Evaluate base_parent at (x, y)
       b. Apply inverse transforms to find (x', y')
       c. Evaluate transform_parent at (x', y')
       d. Invert transform color (black ↔ white)
       e. Composite transform over base
```

### Data Flow
```
Graph (JS) → Uniform Arrays (GPU) → Fragment Shader → Pixels
```

Node data is uploaded to parallel uniform arrays indexed by node ID.

## Next Steps

1. Fix inverse radial repeat to handle multiple copies
2. Improve color compositing (alpha blending)
3. Add JSON import/export
4. Copy example files from RGA
5. Test visual equivalence with RGA
6. Optimize performance if needed
