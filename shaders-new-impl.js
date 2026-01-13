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
 * Returns vec2(color, alpha) where color is 0=black, 1=white
 */
vec2 evaluateRootCircle(vec2 pos) {
    float pixelSize = length(vec2(u_viewport.y - u_viewport.x, u_viewport.w - u_viewport.z) / u_resolution);
    float dist = circleSDF(pos, 1.0);

    // smoothstep for antialiasing at edge
    float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, dist);
    float color = 0.0; // black circle

    return vec2(color, alpha);
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
 * Apply inverse transformations for a specific radial copy index
 * Returns the source coordinate for this particular copy
 */
vec2 inverseTransformForCopy(vec2 pos, int nodeId, int copyIndex) {
    float scale = u_nodeScales[nodeId];
    float radialRadius = u_nodeRadialRadii[nodeId];
    int radialCount = u_nodeRadialCounts[nodeId];
    float rotation = u_nodeRotations[nodeId];

    vec2 result = pos;

    // Step 1: Inverse rotation (global rotation applied to all)
    result = rotate(result, -rotation);

    // Step 2: Inverse radial repeat for this specific copy
    if (radialCount > 0) {
        // Calculate where this copy was placed
        float userAngle = float(copyIndex) * 360.0 / float(radialCount);
        float placementAngle = userAngle + rotation - 90.0;

        // Undo the translation to this copy's position
        vec2 copyOffset = vec2(
            radialRadius * cos(radians(placementAngle)),
            radialRadius * sin(radians(placementAngle))
        );
        result -= copyOffset;

        // Undo the rotation applied to this copy
        float copyRotation = rotation;
        if (radialCount > 1) {
            copyRotation += userAngle;
        }
        result = rotate(result, -copyRotation);
    }

    // Step 3: Inverse scale
    if (scale > 0.0001) {
        result /= scale;
    }

    return result;
}

vec2 invertColor(vec2 colorAlpha) {
    return vec2(1.0 - colorAlpha.x, colorAlpha.y);
}

vec2 composite(vec2 base, vec2 transform) {
    float alpha = transform.y + base.y * (1.0 - transform.y);
    if (alpha < 0.001) {
        return vec2(0.0, 0.0);
    }
    float color = (transform.x * transform.y + base.x * base.y * (1.0 - transform.y)) / alpha;
    return vec2(color, alpha);
}

// Stack frame for evaluation state machine
struct EvalFrame {
    int nodeId;
    vec2 pos;
    int phase; // 0=NEED_BASE, 1=HAVE_BASE, 2=COMPLETE
    vec2 baseValue;
    vec2 transformValue;
    int radialIndex;
};
    // Iteratively evaluate nodes up to 32 passes
    // Each pass can evaluate nodes whose parents are ready
    for (int pass = 0; pass < 32; pass++) {
        bool madeProgress = false;

        // Try to evaluate all nodes
        for (int nid = 0; nid < u_nodeCount; nid++) {
            if (ready[nid]) continue; // Already evaluated

            vec2 result = tryEvaluateNode(nid, pos, cache, ready);

            if (result.y >= 0.0) { // Successfully evaluated (not -1)
                cache[nid] = result;
                ready[nid] = true;
                madeProgress = true;
            }
        }

        // If we didn't make progress, we're stuck (circular dependency or unsupported pattern)
        if (!madeProgress) {
            break;
        }

        // Check if target node is ready
        if (ready[nodeId]) {
            return cache[nodeId];
        }
    }

    // Return cached result if available, otherwise transparent
    if (ready[nodeId]) {
        return cache[nodeId];
    }

    return vec2(0.0, 0.0); // Fallback: transparent
}

/**
 * Main fragment shader entry point
 */
void main() {
    vec2 pixelCoord = gl_FragCoord.xy;

    if (u_supersampleFactor <= 1) {
        // No supersampling - evaluate at pixel center
        vec2 mathCoord = pixelToMath(pixelCoord);
        vec2 result = evaluateNode(u_targetNodeId, mathCoord);
        fragColor = vec4(vec3(result.x), result.y);
    } else {
        // Supersampling: evaluate at multiple subpixel positions
        vec2 totalValue = vec2(0.0, 0.0);
        int sampleCount = u_supersampleFactor * u_supersampleFactor;
        float step = 1.0 / float(u_supersampleFactor);

        for (int y = 0; y < 8; y++) {
            if (y >= u_supersampleFactor) break;
            for (int x = 0; x < 8; x++) {
                if (x >= u_supersampleFactor) break;

                vec2 offset = vec2(float(x), float(y)) * step + step * 0.5 - 0.5;
                vec2 sampleCoord = pixelCoord + offset;
                vec2 mathCoord = pixelToMath(sampleCoord);
                totalValue += evaluateNode(u_targetNodeId, mathCoord);
            }
        }

        vec2 avgValue = totalValue / float(sampleCount);
        fragColor = vec4(vec3(avgValue.x), avgValue.y);
    }
}
`;
