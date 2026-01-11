# Recursive Graph Art - Specification

## Overview

A graph-based image generator that produces black and white artwork by rendering a directed acyclic graph (DAG) of nodes. Each node combines geometry from two parent nodes with transformations and color inversion.

**Implementation**: JavaScript
**Graph format**: JSON
**Node identification**: Numeric IDs

## Graph Structure

### Node Graph
- The image is defined by a directed acyclic graph (DAG) of nodes
- Exactly one root node (node with no parents)
- All other nodes must eventually trace back to the root through their parent references
- No cycles permitted
- No self-references permitted
- Multiple children may reference the same parent node
- A node may use the same node as both its base_parent and transform_parent (as long as it's not the node itself)

### Validation
Graph validation occurs at load/construction time. The following errors will cause rendering to fail:
- Cycle detected in the graph
- Self-reference detected (node references itself as parent)
- Disconnected nodes (nodes that don't trace back to root)
- Multiple root nodes or no root node
- Invalid node ID references

### Node Types

#### Root Node
- Primitive geometric shape
- Initially: black filled circle with radius 1.0
- Centered at origin (0, 0)
- Future: selectable primitive (circle, square, triangle)
  - Size determined by same scale as circle (e.g., square with side length 2.0, triangle with similar bounding size)

#### Non-Root Node
Each non-root node has:
- `base_parent`: reference to another node (numeric ID)
- `transform_parent`: reference to another node (numeric ID, may be same as base_parent)
- Transformation parameters (all optional in JSON, converted to actual values at load time):
  - `scale`: uniform scaling factor (float)
    - JSON default: 0 → converted to 1.0 at load time
    - Runtime: always contains actual scale value (≥0)
    - Must be non-negative
  - `radial_radius`: radius for radial repeat (float)
    - JSON default: 0
    - Must be non-negative
  - `radial_count`: number of copies in radial repeat (integer)
    - JSON default: 0 (no radial repeat)
    - This is the total number of copies, not additional copies
    - Can be 0 (disables radial repeat), 1 (translation only), or greater
  - `rotation`: final rotation angle in degrees (float)
    - JSON default: 0

## Transformations

All transformations use the origin (0, 0) as the transform center.

Transformations are applied to the transform_parent geometry in this order:

### 1. Scale
- Uniform scaling by `scale` factor
- Applied relative to origin (0, 0)
- Very small scale values are permitted (no minimum threshold)

### 2. Radial Repeat
- Special case: if `radial_count = 0`, radial repeat is disabled (no transformation applied)
- Otherwise, creates `radial_count` total copies of the geometry
- For each copy at angle θ (where θ = i * 360° / radial_count, i = 0 to radial_count-1):
  - Rotate the geometry by θ around the origin
  - Translate by distance `radial_radius` in the direction of angle θ
- Examples:
  - radial_count=0: no radial transformation (original geometry unchanged)
  - radial_count=1: 1 copy at 0° (not rotated), translated by `radial_radius`
  - radial_count=4: 4 copies, each rotated and positioned at 0°, 90°, 180°, 270°

### 3. Rotate
- Final rotation by `rotation` degrees (confirmed: degrees, not radians)
- Rotation direction follows the convention of the rendering library used
- Applied relative to origin (0, 0)

## Rendering Algorithm

### Node Rendering Process
To render a node N:

1. Recursively render `base_parent` → produces base_image
2. Recursively render `transform_parent` → produces transform_image
3. Apply transformations to transform_image (scale, radial-repeat, rotate)
4. Invert colors of transformed image (black ↔ white)
5. Composite inverted transformed image onto base_image using standard alpha compositing

The root node renders as its primitive shape (black filled circle).

### Output
- All nodes in the graph are rendered
- Output is a webpage displaying thumbnails of all rendered nodes
- Clicking a thumbnail shows that node's full-size rendering

### Alternative Rendering Definition (Point-wise)
For any point (x, y) in a node's coordinate space, trace through the graph to determine the pixel value:

1. Evaluate base_parent at (x, y) → returns: black, white, or "no pixel"
2. Apply inverse transformations to (x, y) to find corresponding point(s) in transform_parent space
   - Inverse transformations applied in reverse order:
     1. Inverse rotate (rotate by -rotation)
     2. Inverse radial repeat (check if point falls within any of the radial copies, map back to original)
     3. Inverse scale (divide coordinates by scale factor)
3. Evaluate transform_parent at transformed point → returns: black, white, or "no pixel"
4. If transform_parent returns a pixel, invert its color (black ↔ white)
5. Composite: if transform has a pixel (alpha≥0), blend using alpha compositing; otherwise use base color

Recursion terminates at root node: inside root circle → black, outside → "no pixel".
Color inversions accumulate along transform_parent traversals.

Both definitions are equivalent.

### Compositing
Standard alpha compositing is used to draw the inverted transform image onto the base image.

**Pixel representation:**
- Opaque black: alpha=1, color=black
- Opaque white: alpha=1, color=white
- No pixel/background: alpha=0

**Inversion operation:**
- Flips color: black ↔ white
- Preserves alpha channel

**Alpha compositing:**
- Transform layer drawn over base layer
- Where transform has alpha=1, it fully occludes base
- Where transform has alpha=0, base shows through
- With antialiasing enabled, intermediate alpha values (0 < alpha < 1) at edges create smooth blending

## Color Model

### Current: Black and White
- Images contain only black (#000000) and white (#FFFFFF)
- Inversion swaps black ↔ white

### Future: Color
Color handling will be designed when needed. Mechanism will be semi-configured and semi-automatic (details TBD).

## Image Properties

### Coordinate System
- Origin-centric design: origin at (0, 0)
- Mathematical coordinate space is infinite
- Root circle has radius 1.0

### Viewport and Rendering
- **Viewport**: defines the coordinate bounds to render (e.g., [-2, 2] × [-2, 2])
  - Configurable padding around root circle (radius 1.0)
  - Should be easy to configure
- **Canvas size**: pixel dimensions (e.g., 800×800)
  - Configurable
  - Canvas should be square to avoid distortion
- **Coordinate mapping**: viewport bounds map linearly to pixel canvas
- Neither padding nor canvas size should affect rendering logic (they're display parameters only)

### Antialiasing
- Antialiasing is enabled by default
- Shape edges will have intermediate alpha values (0 to 1) for smooth appearance
- Interior pixels: alpha=1 (fully opaque)
- Edge pixels: 0 < alpha < 1 (partial coverage)
- Exterior pixels: alpha=0 (fully transparent)
- This creates gray values at edges when composited

## Future Considerations

Items noted but not currently specified:

- Selectable root primitives (square, triangle)
- Color support
- Potential support for controlled cycles/recursion with iteration limits
  - XXX: How would iteration limits work? Would a node have a max_depth parameter?
- Canvas size and resolution parameters
- File format for exporting rendered images
  - Canvas-based rendering will support standard image export (PNG, etc.)
