# Point-wise Rendering Exploration

## Current vs Point-wise Approach

### Current (Compositional/Forward)
```
renderNode(N):
  1. Render base_parent → canvas B
  2. Render transform_parent → canvas T
  3. Apply transformations to T (scale, radial, rotate)
  4. Invert colors in T
  5. Composite T onto B
```

### Point-wise (Backward Tracing)
```
evaluatePixel(N, x, y):
  1. Evaluate base_parent(x, y) → color B
  2. Apply INVERSE transformations to (x, y) → (x', y')
  3. Evaluate transform_parent(x', y') → color T
  4. If T exists, invert it
  5. Composite T over B
```

## Key Challenges

### 1. Inverse Transformations

#### Current Forward Transform Pipeline
```
1. Scale (uniform, centered at origin)
2. Radial Repeat (if radial_count > 0)
   - For i in 0..radial_count-1:
     - angle = i * 360 / radial_count
     - rotate by angle
     - translate by radial_radius in direction of angle
3. Rotate (by rotation degrees)
```

#### Inverse Transform Pipeline
Must apply inverses in **reverse order**:

```
1. Inverse Rotate: rotate by -rotation
2. Inverse Radial Repeat:
   - Check if point falls within ANY of the N radial copies
   - If yes, map back to pre-radial coordinates
   - If no, return "no pixel"
3. Inverse Scale: divide coordinates by scale factor
```

### 2. Inverse Radial Repeat - The Tricky Part

Given an output point (x, y), determine if it maps to any radial copy:

```javascript
// Pseudo-code for inverse radial repeat
function inverseRadialRepeat(x, y, radialRadius, radialCount, rotation) {
  if (radialCount === 0) {
    return [(x, y)]; // no transformation
  }

  const candidates = [];

  for (let i = 0; i < radialCount; i++) {
    const angle = (i * 360 / radialCount) + rotation - 90;
    const angleRad = angle * Math.PI / 180;

    // Where was this copy placed?
    const copyX = radialRadius * Math.cos(angleRad);
    const copyY = radialRadius * Math.sin(angleRad);

    // Translate point back to pre-translation coordinates
    let sourceX = x - copyX;
    let sourceY = y - copyY;

    // Undo the rotation that was applied to this copy
    const userAngle = i * 360 / radialCount;
    const totalRotation = rotation + (radialCount > 1 ? userAngle : 0);
    const rotRad = -totalRotation * Math.PI / 180;

    const finalX = sourceX * Math.cos(rotRad) - sourceY * Math.sin(rotRad);
    const finalY = sourceX * Math.sin(rotRad) + sourceY * Math.cos(rotRad);

    // This is A candidate source point
    // But we need to check if the source actually has a pixel there
    candidates.push({ x: finalX, y: finalY, copyIndex: i });
  }

  return candidates;
}
```

**Key insight**: A single output pixel might map to MULTIPLE source pixels (overlapping radial copies). Need to handle compositing order.

### 3. Pixel ID System

Current approach:
- Assigns IDs during layer creation
- Tracks parity (even/odd) for color inversion
- Each unique region gets a unique ID

Point-wise approach options:

**Option A: Path-based IDs**
- Encode the path through the graph into the ID
- E.g., "node5.transform.node3.base.node0" → hash to ID
- Parity = depth in transform_parent chain

**Option B: Geometry-based IDs**
- When evaluating root, assign ID based on position
- Propagate ID through the graph
- Flip parity when going through transform_parent

**Option C: No IDs - Direct Color Assignment**
- Assign colors based on (nodeId, depth)
- Simpler but less flexible

### 4. Antialiasing

Current: Canvas antialiasing (free)

Point-wise options:
- **Supersampling**: Evaluate multiple sub-pixels per output pixel
- **Distance fields**: For root circle, use signed distance function
- **Hybrid**: Keep root as canvas rendering, point-wise for rest

### 5. Performance Considerations

Point-wise will evaluate each node many times. Potential optimizations:

1. **Pixel-level caching**: Memoize evaluatePixel(nodeId, x, y)
2. **Bounding box culling**: Skip evaluation if point outside node bounds
3. **Lazy evaluation**: Only evaluate pixels that are actually sampled
4. **Supersampling only at edges**: Detect edges and supersample there

## Exploration Questions

1. **Radial overlap handling**: When multiple radial copies overlap, which one wins?
   - Current implementation: Last copy drawn wins (layer order)
   - Point-wise: Need to check all candidates and pick one (first? last? closest to origin?)

2. **ID assignment strategy**: How to assign unique IDs in point-wise?
   - Need to ensure same result as compositional approach for color consistency

3. **Root circle rendering**:
   - Option A: Analytic (point inside circle check)
   - Option B: Still render to canvas and sample
   - Option C: Signed distance field

4. **Color inversion tracking**:
   - Track depth in transform_parent chain
   - Parity determines if colors should be inverted

## Next Steps

1. Implement simple point-wise renderer for basic case (no radial, just scale + rotate)
2. Add inverse radial repeat logic
3. Test against current renderer for visual equivalence
4. Implement ID/color tracking system
5. Add antialiasing via supersampling
6. Performance comparison and optimization
