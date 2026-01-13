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

/**
 * Invert a color value (black <-> white)
 */
vec2 invertColor(vec2 colorAlpha) {
    return vec2(1.0 - colorAlpha.x, colorAlpha.y);
}

/**
 * Composite transform over base using alpha blending
 * transform is drawn over base
 */
vec2 composite(vec2 base, vec2 transform) {
    // Standard alpha compositing: result = transform over base
    float alpha = transform.y + base.y * (1.0 - transform.y);
    if (alpha < 0.001) {
        return vec2(0.0, 0.0);
    }
    float color = (transform.x * transform.y + base.x * base.y * (1.0 - transform.y)) / alpha;
    return vec2(color, alpha);
}

/**
 * Evaluate a node at a position
 * Returns vec2(color, alpha)
 */
vec2 evaluateNode(int nodeId, vec2 pos) {
    // Quick path for root
    if (isRootNode(nodeId)) {
        return evaluateRootCircle(pos);
    }

    // Pattern: node with root as both parents (depth 1)
    int bp = u_nodeBaseParents[nodeId];
    int tp = u_nodeTransformParents[nodeId];

    if (bp >= 0 && tp >= 0 && isRootNode(bp) && isRootNode(tp)) {
        // Depth 1: both parents are root
        vec2 baseValue = evaluateRootCircle(pos);

        vec2 transformValue = vec2(0.0, 0.0);
        int radialCount = u_nodeRadialCounts[nodeId];
        if (radialCount == 0) {
            vec2 tpos = inverseTransformForCopy(pos, nodeId, 0);
            transformValue = evaluateRootCircle(tpos);
        } else {
            for (int i = 0; i < 32; i++) {
                if (i >= radialCount) break;
                vec2 tpos = inverseTransformForCopy(pos, nodeId, i);
                vec2 sample = evaluateRootCircle(tpos);
                // Take max alpha, average color if both present
                if (sample.y > transformValue.y) {
                    transformValue = sample;
                }
            }
        }

        return composite(baseValue, invertColor(transformValue));
    }

    // Pattern: base parent is depth 1, transform parent is root
    if (bp >= 0 && !isRootNode(bp) && tp >= 0 && isRootNode(tp)) {
        // Evaluate base parent (one level)
        int bp_bp = u_nodeBaseParents[bp];
        int bp_tp = u_nodeTransformParents[bp];

        vec2 bpValue = vec2(0.0, 0.0);
        if (bp_bp >= 0 && bp_tp >= 0 && isRootNode(bp_bp) && isRootNode(bp_tp)) {
            // Base parent's parents are both root
            vec2 bp_base = evaluateRootCircle(pos);
            vec2 bp_transform = vec2(0.0, 0.0);
            int bp_radial = u_nodeRadialCounts[bp];
            if (bp_radial == 0) {
                vec2 bp_tpos = inverseTransformForCopy(pos, bp, 0);
                bp_transform = evaluateRootCircle(bp_tpos);
            } else {
                for (int i = 0; i < 32; i++) {
                    if (i >= bp_radial) break;
                    vec2 bp_tpos = inverseTransformForCopy(pos, bp, i);
                    vec2 sample = evaluateRootCircle(bp_tpos);
                    if (sample.y > bp_transform.y) {
                        bp_transform = sample;
                    }
                }
            }
            bpValue = composite(bp_base, invertColor(bp_transform));
        } else if (bp_bp >= 0 && isRootNode(bp_bp)) {
            bpValue = evaluateRootCircle(pos);
        }

        // Evaluate transform parent (root)
        vec2 tpValue = vec2(0.0, 0.0);
        int radialCount = u_nodeRadialCounts[nodeId];
        if (radialCount == 0) {
            vec2 tpos = inverseTransformForCopy(pos, nodeId, 0);
            tpValue = evaluateRootCircle(tpos);
        } else {
            for (int i = 0; i < 32; i++) {
                if (i >= radialCount) break;
                vec2 tpos = inverseTransformForCopy(pos, nodeId, i);
                vec2 sample = evaluateRootCircle(tpos);
                if (sample.y > tpValue.y) {
                    tpValue = sample;
                }
            }
        }

        return composite(bpValue, invertColor(tpValue));
    }

    // Fallback: only evaluate base parent if it's root
    if (bp >= 0 && isRootNode(bp)) {
        return evaluateRootCircle(pos);
    }

    return vec2(0.0, 0.0);
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
