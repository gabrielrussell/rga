# Recursive Graph Art (RGA)

A graph-based image generator that produces black and white artwork by rendering a directed acyclic graph (DAG) of nodes with transformations and color inversion.

## Features

- **Graph-based rendering**: Define artwork as a DAG of nodes with parent relationships
- **Transformations**: Scale, radial repeat, and rotation
- **Color inversion**: Each transform layer inverts colors (black ↔ white) while preserving alpha
- **Alpha compositing**: Smooth antialiased edges with proper transparency handling
- **Interactive UI**: View all nodes as thumbnails, click to see fullsize rendering

## Usage

### Running the Application

1. Start a local web server in this directory:
   ```bash
   python3 -m http.server 8000
   # or
   npx http-server
   ```

2. Open your browser to `http://localhost:8000`

3. Enter a JSON graph definition in the textarea and click "Render Graph"

### JSON Format

The graph is defined as JSON with a `nodes` array. Each node has:

- `id` (required): Numeric identifier for the node
- `base_parent` (optional): ID of the base parent node
- `transform_parent` (optional): ID of the transform parent node
- `scale` (optional): Uniform scaling factor (default: 0, treated as 1.0)
- `radial_radius` (optional): Radius for radial repeat (default: 0)
- `radial_count` (optional): Number of copies in radial repeat (default: 0)
- `rotation` (optional): Final rotation in degrees (default: 0)

**Root node**: A node with no `base_parent` or `transform_parent` is the root. There must be exactly one root node.

### Examples

#### Simple Root (Just a Black Circle)
```json
{
  "nodes": [
    { "id": 0 }
  ]
}
```

#### Scale and Rotate
```json
{
  "nodes": [
    { "id": 0 },
    {
      "id": 1,
      "base_parent": 0,
      "transform_parent": 0,
      "scale": 0.5,
      "rotation": 45
    }
  ]
}
```

#### Radial Repeat
```json
{
  "nodes": [
    { "id": 0 },
    {
      "id": 1,
      "base_parent": 0,
      "transform_parent": 0,
      "scale": 0.3,
      "radial_radius": 0.6,
      "radial_count": 6
    }
  ]
}
```

See the `examples/` directory for more examples.

## How It Works

### Rendering Process

1. **Root Node**: Renders as a black filled circle with radius 1.0 at origin (0, 0)

2. **Non-Root Nodes**: Use compositional rendering:
   - Recursively render `base_parent` to a canvas
   - Recursively render `transform_parent` to a canvas
   - Apply transformation pipeline to transform canvas
   - Invert colors of transformed canvas (black ↔ white, preserve alpha)
   - Composite inverted transform onto base using alpha blending

### Transformation Pipeline

Transformations are applied in this order:

1. **Scale**: Uniform scaling by `scale` factor
2. **Radial Repeat**:
   - If `radial_count = 0`: no transformation
   - If `radial_count = 1`: translate by `radial_radius` (no rotation)
   - If `radial_count ≥ 2`: create `radial_count` copies, each rotated and positioned around a circle
3. **Rotate**: Final rotation by `rotation` degrees

### Validation

The graph is validated at load time:
- Must have exactly one root node
- No cycles permitted
- No self-references permitted
- All parent references must exist
- All nodes must trace back to root

## Coordinate System

- Origin at (0, 0) in the center of the canvas
- Root circle has radius 1.0
- Default viewport: [-2, 2] × [-2, 2]
- Default canvas size: 800×800 pixels (thumbnails: 200×200)

## Technical Details

- **Technology**: JavaScript with HTML5 Canvas
- **Rendering**: Compositional (render parent nodes, transform, composite)
- **Antialiasing**: Enabled by default via Canvas native antialiasing
- **Color model**: Black (#000000) and white (#FFFFFF) with alpha channel

## Files

- `index.html`: Main HTML page with UI
- `main.js`: Entry point, handles UI interaction
- `graph.js`: Node and Graph classes with validation
- `renderer.js`: Rendering engine with transformations
- `examples/`: Example JSON graph definitions
- `SPEC.md`: Complete specification
- `TODO.md`: Implementation task list

## License

See LICENSE file.
