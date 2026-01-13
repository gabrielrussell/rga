/**
 * GLSL shader sources
 */

export const vertexShaderSource = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
    // Pass through position for fullscreen quad
    gl_Position = vec4(a_position, 0.0, 1.0);

    // Convert from clip space (-1 to +1) to texture coordinates (0 to 1)
    v_texCoord = a_position * 0.5 + 0.5;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

// Viewport configuration
uniform vec2 u_resolution;
uniform vec4 u_viewport; // minX, maxX, minY, maxY

// Rendering settings
uniform int u_supersampleFactor;
uniform int u_targetNodeId;

// Graph data - node properties
const int MAX_NODES = 256;
uniform int u_nodeCount;
uniform int u_nodeBaseParents[MAX_NODES];
uniform int u_nodeTransformParents[MAX_NODES];
uniform float u_nodeScales[MAX_NODES];
uniform float u_nodeRadialRadii[MAX_NODES];
uniform int u_nodeRadialCounts[MAX_NODES];
uniform float u_nodeRotations[MAX_NODES];

// Maximum recursion depth to prevent infinite loops
const int MAX_DEPTH = 32;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert pixel coordinates to mathematical coordinates
 */
vec2 pixelToMath(vec2 pixelCoord) {
    vec2 normalized = pixelCoord / u_resolution;
    float viewportWidth = u_viewport.y - u_viewport.x;
    float viewportHeight = u_viewport.w - u_viewport.z;

    float mathX = u_viewport.x + normalized.x * viewportWidth;
    float mathY = u_viewport.z + (1.0 - normalized.y) * viewportHeight; // Flip Y

    return vec2(mathX, mathY);
}

/**
 * Check if a node is the root node
 */
bool isRootNode(int nodeId) {
    return u_nodeBaseParents[nodeId] == -1 && u_nodeTransformParents[nodeId] == -1;
}

/**
 * Signed distance function for circle
 */
float circleSDF(vec2 pos, float radius) {
    return length(pos) - radius;
}

/**
 * Evaluate root circle at given position
 * Returns white (1.0) inside circle, black (0.0) outside, with antialiasing
 */
float evaluateRootCircle(vec2 pos) {
    float pixelSize = length(vec2(u_viewport.y - u_viewport.x, u_viewport.w - u_viewport.z) / u_resolution);
    float dist = circleSDF(pos, 1.0);

    // smoothstep for antialiasing at edge
    return 1.0 - smoothstep(-pixelSize, pixelSize, dist);
}

/**
 * Rotate a point by angle (in degrees)
 */
vec2 rotate(vec2 pos, float angleDegrees) {
    float angleRad = radians(angleDegrees);
    float cosA = cos(angleRad);
    float sinA = sin(angleRad);
    return vec2(
        pos.x * cosA - pos.y * sinA,
        pos.x * sinA + pos.y * cosA
    );
}

/**
 * Apply inverse transformations to find source coordinate(s)
 * For now, returns single coordinate (will handle radial repeat later)
 */
vec2 inverseTransform(vec2 pos, int nodeId) {
    float scale = u_nodeScales[nodeId];
    float radialRadius = u_nodeRadialRadii[nodeId];
    int radialCount = u_nodeRadialCounts[nodeId];
    float rotation = u_nodeRotations[nodeId];

    // Step 1: Inverse rotation
    vec2 result = rotate(pos, -rotation);

    // Step 2: Inverse radial repeat (simplified for now - just undo translation)
    // TODO: Implement proper radial inverse with multiple candidates
    if (radialCount > 0) {
        // For now, just undo the first copy's placement
        float placementAngle = -90.0; // 0 degrees = top
        vec2 offset = vec2(
            radialRadius * cos(radians(placementAngle)),
            radialRadius * sin(radians(placementAngle))
        );
        result -= offset;
    }

    // Step 3: Inverse scale
    if (scale > 0.0001) {
        result /= scale;
    }

    return result;
}

/**
 * Invert a color value (black <-> white)
 */
float invertColor(float color) {
    return 1.0 - color;
}

/**
 * Evaluate a node at given position (recursive)
 */
float evaluateNode(int nodeId, vec2 pos, int depth);

float evaluateNode(int nodeId, vec2 pos, int depth) {
    // Safety check: prevent infinite recursion
    if (depth >= MAX_DEPTH) {
        return 0.0;
    }

    // Base case: root node
    if (isRootNode(nodeId)) {
        return evaluateRootCircle(pos);
    }

    // Recursive case: evaluate base and transform parents

    // Evaluate base parent
    int baseParentId = u_nodeBaseParents[nodeId];
    float baseColor = 0.0;
    if (baseParentId >= 0) {
        baseColor = evaluateNode(baseParentId, pos, depth + 1);
    }

    // Evaluate transform parent at inverse-transformed position
    int transformParentId = u_nodeTransformParents[nodeId];
    float transformColor = 0.0;
    if (transformParentId >= 0) {
        vec2 transformPos = inverseTransform(pos, nodeId);
        transformColor = evaluateNode(transformParentId, transformPos, depth + 1);

        // Invert transform color
        transformColor = invertColor(transformColor);
    }

    // Composite: transform over base (simple max for now)
    return max(baseColor, transformColor);
}

/**
 * Main fragment shader entry point
 */
void main() {
    vec2 pixelCoord = gl_FragCoord.xy;

    if (u_supersampleFactor <= 1) {
        // No supersampling - evaluate at pixel center
        vec2 mathCoord = pixelToMath(pixelCoord);
        float value = evaluateNode(u_targetNodeId, mathCoord, 0);
        fragColor = vec4(vec3(value), 1.0);
    } else {
        // Supersampling: evaluate at multiple subpixel positions
        float totalValue = 0.0;
        int sampleCount = u_supersampleFactor * u_supersampleFactor;
        float step = 1.0 / float(u_supersampleFactor);

        for (int y = 0; y < 8; y++) {
            if (y >= u_supersampleFactor) break;
            for (int x = 0; x < 8; x++) {
                if (x >= u_supersampleFactor) break;

                vec2 offset = vec2(float(x), float(y)) * step + step * 0.5 - 0.5;
                vec2 sampleCoord = pixelCoord + offset;
                vec2 mathCoord = pixelToMath(sampleCoord);
                totalValue += evaluateNode(u_targetNodeId, mathCoord, 0);
            }
        }

        float avgValue = totalValue / float(sampleCount);
        fragColor = vec4(vec3(avgValue), 1.0);
    }
}
`;
