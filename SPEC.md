# Kaleidoscope - WebGL Point-wise Graph Renderer

## Overview
Real-time WebGL/GLSL-based renderer using point-wise (backward tracing) approach. Each pixel is computed independently in a fragment shader by tracing through the graph with inverse transformations.

## Technology Choices
- **Rendering**: WebGL 2.0 with GLSL fragment shaders
- **Approach**: Point-wise backward tracing (each pixel evaluated independently)
- **Performance**: Real-time GPU rendering, no caching
- **Antialiasing**: Signed distance function for root circle + configurable supersampling

## Graph Format (Same as RGA)
```json
{
  "nodes": [
    {
      "id": 0,
      "base_parent": null,
      "transform_parent": null,
      "scale": 1.0,
      "radial_radius": 0.0,
      "radial_count": 0,
      "rotation": 0.0,
      "comment": "optional description"
    }
  ]
}
```

**Parameter defaults:**
- `scale`: 0 → 1.0, otherwise as specified
- All other numeric params: default to 0
- Root node: both parents are null

## Rendering Algorithm

### Fragment Shader Core Logic
```glsl
vec4 evaluateNode(int nodeId, vec2 pos) {
    if (isRoot(nodeId)) {
        return evaluateRootCircle(pos);
    }

    // Get base color
    vec4 baseColor = evaluateNode(baseParentId, pos);

    // Apply inverse transformations to find transform parent coordinate(s)
    vec2[] transformCoords = inverseTransform(pos, node);

    // Evaluate transform parent at inverse position(s)
    vec4 transformColor = vec4(0.0);
    for (each coord in transformCoords) {
        transformColor += evaluateNode(transformParentId, coord);
    }

    // Invert and composite
    transformColor = invertColor(transformColor);
    return composite(baseColor, transformColor);
}
```

### Inverse Transformation Pipeline
For each node, apply in reverse order:
1. **Inverse rotation**: rotate by -rotation degrees
2. **Inverse radial repeat**: map output point to 0-N source points
3. **Inverse scale**: divide coordinates by scale factor

### Root Circle Evaluation
Use signed distance function for perfect antialiasing:
```glsl
float dist = length(pos) - 1.0;
float alpha = smoothstep(pixelSize, 0.0, dist);
return vec4(color, alpha);
```

### Radial Repeat Inverse Transform
Given output point, check all N radial copy positions to find which source point(s) it maps from. Handle overlaps by taking the first valid candidate.

## Data Encoding for Shader

### Option 1: Uniform Arrays (Start Here)
```glsl
uniform int nodeCount;
uniform int nodeBaseParents[MAX_NODES];
uniform int nodeTransformParents[MAX_NODES];
uniform float nodeScales[MAX_NODES];
uniform float nodeRadialRadii[MAX_NODES];
uniform int nodeRadialCounts[MAX_NODES];
uniform float nodeRotations[MAX_NODES];
```

**Pros**: Simple, direct access
**Cons**: Limited to ~256 nodes due to uniform limits

### Option 2: Texture Encoding (Future Optimization)
Encode graph structure as texture data for unlimited nodes.

## Color System (Simple Initial Version)
- Black/white only to start
- Base parent: white where it exists
- Transform parent: inverted when composited
- Color palette system: defer to later

## UI Structure
Similar to RGA but simplified:
- Canvas for rendering (single view, no thumbnails initially)
- Node selector dropdown
- Parameter sliders (scale, radial_radius, radial_count, rotation)
- JSON import/export
- Example selector

## Antialiasing Strategy
1. **Root circle**: SDF-based (no supersampling needed)
2. **Transformed geometry**: Configurable NxN supersampling in fragment shader
   - Start with 2x2 (4 samples per pixel)
   - Make configurable for performance tuning

## Performance Goals
- 60 FPS for graphs with ~20 nodes
- Real-time parameter adjustment
- No render caching - pure GPU computation

## Validation
Reuse RGA validation logic:
- Exactly one root node
- No cycles
- No self-references
- All nodes connected to root
- Valid node ID references
