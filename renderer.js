import { ColorPalette, hexToHsl, hslToRgb, rgbToHex } from './color.js';

/**
 * Renderer for graph nodes using HTML5 Canvas with layer-based rendering
 * and color support. Uses ID matrix to track pixel inversion state.
 */
export class Renderer {
    constructor(viewport, canvasSize, colorPalette = null, supersampleFactor = 4) {
        this.viewport = viewport; // { minX, maxX, minY, maxY }
        this.targetSize = canvasSize; // final output size
        this.supersampleFactor = supersampleFactor;
        this.canvasSize = canvasSize * supersampleFactor; // internal rendering size
        this.layerCache = new Map(); // node id -> array of {canvas, idMatrix, depth}
        this.colorPalette = colorPalette || new ColorPalette('#3498db');
        this.useColor = colorPalette !== null;
        this.nextPixelId = 0; // Global counter for unique pixel IDs, increments by 2
        this.colorModes = {
            evenParity: 'regular',
            oddParity: 'alternative',
            firstIndex: 'inherit',
            lastIndex: 'inherit'
        };
    }

    /**
     * Set color modes for different pixel categories
     */
    setColorModes(modes) {
        this.colorModes = { ...modes };
    }

    /**
     * Set the color palette
     * Note: Does not clear cache since colors are applied after layer computation
     */
    setColorPalette(colorPalette) {
        this.colorPalette = colorPalette;
        this.useColor = true;
    }

    /**
     * Enable/disable color mode
     * Note: Does not clear cache since colors are applied after layer computation
     */
    setUseColor(useColor) {
        this.useColor = useColor;
    }

    /**
     * Convert mathematical coordinates to pixel coordinates
     */
    mathToPixel(x, y) {
        const viewportWidth = this.viewport.maxX - this.viewport.minX;
        const viewportHeight = this.viewport.maxY - this.viewport.minY;

        const pixelX = ((x - this.viewport.minX) / viewportWidth) * this.canvasSize;
        const pixelY = ((this.viewport.maxY - y) / viewportHeight) * this.canvasSize; // Flip Y axis

        return { x: pixelX, y: pixelY };
    }

    /**
     * Convert mathematical distance to pixel distance
     */
    mathToPixelDistance(distance) {
        const viewportWidth = this.viewport.maxX - this.viewport.minX;
        return (distance / viewportWidth) * this.canvasSize;
    }

    /**
     * Render a node to the given canvas
     * Composites all layers and applies final coloring based on idMatrix
     * Returns statistics for debugging
     */
    renderNode(node, targetCanvas) {
        // Create internal high-res canvas
        const internalCanvas = document.createElement('canvas');
        internalCanvas.width = this.canvasSize;
        internalCanvas.height = this.canvasSize;
        const ctx = internalCanvas.getContext('2d');

        // Get layers for this node
        const layers = this.getNodeLayers(node);

        // Composite all layers together with their idMatrices
        const finalIdMatrix = new Uint32Array(this.canvasSize * this.canvasSize);
        finalIdMatrix.fill(0xFFFFFFFF);
        const finalDepthMatrix = new Uint8Array(this.canvasSize * this.canvasSize);

        // Draw all layers in order, tracking final ID and depth for each pixel
        for (const layerInfo of layers) {
            ctx.drawImage(layerInfo.canvas, 0, 0);

            // Update idMatrix and depthMatrix with this layer's data
            for (let i = 0; i < finalIdMatrix.length; i++) {
                if (layerInfo.idMatrix[i] !== 0xFFFFFFFF) {
                    finalIdMatrix[i] = layerInfo.idMatrix[i];
                    finalDepthMatrix[i] = layerInfo.depth;
                }
            }
        }

        // Collect ALL unique IDs for per-image sequential color mapping
        const uniqueIds = new Set();
        for (let i = 0; i < finalIdMatrix.length; i++) {
            const id = finalIdMatrix[i];
            if (id !== 0xFFFFFFFF) {
                uniqueIds.add(id);
            }
        }

        // Create mapping from ID to sequential color index
        // All unique regions get sequential colors: 0, 1, 2, 3...
        const idToColorIndex = new Map();
        const sortedIds = Array.from(uniqueIds).sort((a, b) => a - b);
        sortedIds.forEach((id, index) => {
            idToColorIndex.set(id, index);
        });

        // Apply final coloring based on parity and per-image ID mapping
        this.applyFinalColors(internalCanvas, finalIdMatrix, finalDepthMatrix, idToColorIndex);

        // Downsample to target canvas with anti-aliasing
        const targetCtx = targetCanvas.getContext('2d');
        targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.drawImage(internalCanvas, 0, 0, this.canvasSize, this.canvasSize,
                                           0, 0, this.targetSize, this.targetSize);

        // Store matrices for debugging
        this.lastIdMatrix = finalIdMatrix;
        this.lastDepthMatrix = finalDepthMatrix;

        // Return statistics
        return this.computePixelStats(finalIdMatrix, finalDepthMatrix);
    }

    /**
     * Compute statistics about pixel IDs and depths
     */
    computePixelStats(idMatrix, depthMatrix) {
        const uniqueIds = new Set();
        const idsByDepthParity = new Map(); // key: "depth_parity" -> Set of IDs
        let evenCount = 0;
        let oddCount = 0;
        let transparentCount = 0;

        for (let i = 0; i < idMatrix.length; i++) {
            const id = idMatrix[i];
            if (id === 0xFFFFFFFF) {
                transparentCount++;
            } else {
                uniqueIds.add(id);
                const parity = id % 2;
                const depth = depthMatrix[i];

                const key = `${depth}_${parity}`;
                if (!idsByDepthParity.has(key)) {
                    idsByDepthParity.set(key, new Set());
                }
                idsByDepthParity.get(key).add(id);

                if (parity === 0) {
                    evenCount++;
                } else {
                    oddCount++;
                }
            }
        }

        // Organize by depth with IDs
        const depthInfo = new Map();
        for (const [key, ids] of idsByDepthParity.entries()) {
            const [depth, parity] = key.split('_').map(Number);
            if (!depthInfo.has(depth)) {
                depthInfo.set(depth, { even: [], odd: [] });
            }
            const sortedIds = Array.from(ids).sort((a, b) => a - b);
            if (parity === 0) {
                depthInfo.get(depth).even = sortedIds;
            } else {
                depthInfo.get(depth).odd = sortedIds;
            }
        }

        return {
            totalUniqueIds: uniqueIds.size,
            evenCount,
            oddCount,
            transparentCount,
            depthInfo: Array.from(depthInfo.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([depth, ids]) => ({ depth, ...ids }))
        };
    }

    /**
     * Apply final colors to canvas based on idMatrix and color modes
     * Respects color mode settings for even/odd parity and first/last indices
     */
    applyFinalColors(canvas, idMatrix, depthMatrix, idToColorIndex) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Find max color index for last index detection
        const maxColorIndex = idToColorIndex.size > 0 ? Math.max(...idToColorIndex.values()) : -1;

        for (let i = 0; i < idMatrix.length; i++) {
            const id = idMatrix[i];
            const pixelIndex = i * 4;

            if (id === 0xFFFFFFFF) {
                // Transparent pixel - set alpha to 0
                data[pixelIndex + 3] = 0;
            } else {
                const parity = id % 2;

                // Look up sequential color index for this ID
                const colorIndex = idToColorIndex.get(id);

                // Determine which color mode to use
                let colorMode = null;

                if (parity === 0) {
                    // Even parity - check for first/last index overrides
                    if (colorIndex === 0 && this.colorModes.firstIndex !== 'inherit') {
                        colorMode = this.colorModes.firstIndex;
                    } else if (colorIndex === maxColorIndex && this.colorModes.lastIndex !== 'inherit') {
                        colorMode = this.colorModes.lastIndex;
                    } else {
                        colorMode = this.colorModes.evenParity;
                    }
                } else {
                    // Odd parity
                    colorMode = this.colorModes.oddParity;
                }

                // Apply the selected color mode
                const rgb = this.getColorForMode(colorMode, id, parity, colorIndex);
                data[pixelIndex] = rgb.r;
                data[pixelIndex + 1] = rgb.g;
                data[pixelIndex + 2] = rgb.b;
                data[pixelIndex + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Get rendering layers for a node
     * Returns an array of {canvas, idMatrix, depth} objects
     */
    getNodeLayers(node) {
        // Check cache first
        if (this.layerCache.has(node.id)) {
            return this.layerCache.get(node.id);
        }

        // Compute layers
        const layers = node.isRoot() ? this.getRootLayers() : this.getNonRootLayers(node);

        // Cache the result
        this.layerCache.set(node.id, layers);

        return layers;
    }

    /**
     * Get layers for root node
     * Returns array with single layer at depth 0
     * All root circle pixels share the same ID (even parity)
     */
    getRootLayers() {
        const canvas = document.createElement('canvas');
        canvas.width = this.canvasSize;
        canvas.height = this.canvasSize;
        const ctx = canvas.getContext('2d');

        const center = this.mathToPixel(0, 0);
        const radius = this.mathToPixelDistance(1.0);

        // Render root circle
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Create ID matrix: all circle pixels share same ID
        const idMatrix = new Uint32Array(this.canvasSize * this.canvasSize);
        const rootId = this.nextPixelId; // Single ID for all root pixels
        this.nextPixelId += 2;

        // Get alpha channel to determine which pixels are part of the circle
        const imageData = ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
        const alphaData = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const alpha = alphaData[i * 4 + 3];
            if (alpha > 0) {
                // All circle pixels share the same even ID
                idMatrix[i] = rootId;
            } else {
                // Transparent pixel
                idMatrix[i] = 0xFFFFFFFF;
            }
        }

        return [{ canvas, idMatrix, depth: 0 }];
    }

    /**
     * Get layers for non-root node
     * Returns base layers + transformed/inverted transform layers with updated depths
     * Assigns new IDs to all pixels, preserving or flipping parity
     */
    getNonRootLayers(node) {
        const graph = this.getGraphFromNode(node);

        // Get base parent layers - reassign new IDs with same parity
        const baseParentNode = graph.getNode(node.baseParent);
        const baseParentLayers = this.getNodeLayers(baseParentNode);
        const baseLayers = baseParentLayers.map(layerInfo => {
            const newIdMatrix = this.reassignIds(layerInfo.idMatrix, false); // preserve parity
            return { canvas: layerInfo.canvas, idMatrix: newIdMatrix, depth: layerInfo.depth };
        });

        // Get transform parent layers - reassign new IDs with flipped parity
        const transformParentNode = graph.getNode(node.transformParent);
        const transformLayers = this.getNodeLayers(transformParentNode);

        // Apply transformations to each transform layer and reassign IDs with flipped parity
        const transformedLayers = transformLayers.map(layerInfo => {
            const newDepth = layerInfo.depth + 1;

            // Apply transformations to both canvas and idMatrix
            const { canvas: transformedCanvas, idMatrix: transformedIdMatrix } =
                this.applyTransformations(
                    layerInfo.canvas,
                    layerInfo.idMatrix,
                    node.scale,
                    node.radialRadius,
                    node.radialCount,
                    node.rotation
                );

            // Reassign new IDs with flipped parity for transform parent pixels
            const newIdMatrix = this.reassignIds(transformedIdMatrix, true); // flip parity

            return { canvas: transformedCanvas, idMatrix: newIdMatrix, depth: newDepth };
        });

        // Return base layers followed by transformed transform layers
        return [...baseLayers, ...transformedLayers];
    }

    /**
     * Reassign new IDs to all pixels, optionally flipping parity
     * Each unique source ID gets ONE new ID - all pixels from same source share new ID
     * @param {Uint32Array} sourceIdMatrix - Original ID matrix
     * @param {boolean} flipParity - Whether to flip parity (even↔odd)
     * @returns {Uint32Array} New ID matrix with reassigned IDs
     */
    reassignIds(sourceIdMatrix, flipParity) {
        const newIdMatrix = new Uint32Array(sourceIdMatrix.length);
        const idMapping = new Map(); // source ID -> new ID

        for (let i = 0; i < sourceIdMatrix.length; i++) {
            const sourceId = sourceIdMatrix[i];

            if (sourceId === 0xFFFFFFFF) {
                // Transparent pixel - keep as transparent
                newIdMatrix[i] = 0xFFFFFFFF;
            } else {
                // Check if we've already assigned a new ID for this source ID
                if (!idMapping.has(sourceId)) {
                    // Get original parity
                    const originalParity = sourceId % 2;
                    // Determine new parity
                    const newParity = flipParity ? 1 - originalParity : originalParity;
                    // Assign ONE new ID for this entire source
                    const newId = this.nextPixelId + newParity;
                    idMapping.set(sourceId, newId);
                    this.nextPixelId += 2;
                }

                // Use the mapped new ID
                newIdMatrix[i] = idMapping.get(sourceId);
            }
        }

        return newIdMatrix;
    }

    /**
     * Apply transformation pipeline to both canvas and idMatrix
     * Transforms idMatrix directly by sampling from source positions
     * Returns {canvas, idMatrix}
     */
    applyTransformations(sourceCanvas, sourceIdMatrix, scale, radialRadius, radialCount, rotation) {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = this.canvasSize;
        resultCanvas.height = this.canvasSize;
        const ctx = resultCanvas.getContext('2d');

        const resultIdMatrix = new Uint32Array(this.canvasSize * this.canvasSize);
        resultIdMatrix.fill(0xFFFFFFFF);

        // Handle radial_count = 0 (no transformation)
        if (radialCount === 0) {
            // Apply only scale and rotation
            const center = this.canvasSize / 2;

            // Transform main canvas
            ctx.translate(center, center);
            ctx.scale(scale, scale);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);

            // Transform idMatrix by inverse sampling
            this.transformIdMatrixDirect(sourceIdMatrix, resultIdMatrix, scale, rotation, 0, 0);

            return { canvas: resultCanvas, idMatrix: resultIdMatrix };
        }

        // Radial repeat with count >= 1
        const center = this.canvasSize / 2;
        const radiusPixels = this.mathToPixelDistance(radialRadius);

        for (let i = 0; i < radialCount; i++) {
            // User angle: 0° = top, 90° = right, etc.
            const userAngle = (i * 360) / radialCount;
            // Placement angle: offset by -90° so 0° is at top instead of right
            const placementAngle = userAngle - 90;
            const placementRad = (placementAngle * Math.PI) / 180;
            const userAngleRad = (userAngle * Math.PI) / 180;

            // Transform main canvas
            ctx.save();
            ctx.translate(center, center);
            // Place at the target position
            ctx.translate(radiusPixels * Math.cos(placementRad), radiusPixels * Math.sin(placementRad));
            // Apply rotations (user rotation + wheel-style radial rotation)
            ctx.rotate((rotation * Math.PI) / 180);
            if (radialCount > 1) {
                ctx.rotate(userAngleRad);
            }
            ctx.scale(scale, scale);
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);
            ctx.restore();

            // Transform idMatrix for this repeat
            this.transformIdMatrixDirect(sourceIdMatrix, resultIdMatrix, scale, rotation + userAngle, radiusPixels, placementAngle);
        }

        return { canvas: resultCanvas, idMatrix: resultIdMatrix };
    }

    /**
     * Transform idMatrix directly by sampling source IDs at transformed positions
     * For each destination pixel, compute inverse transform to find source pixel ID
     * Mirrors the canvas transformation order in reverse
     */
    transformIdMatrixDirect(sourceIdMatrix, resultIdMatrix, scale, rotationDegrees, radiusPixels, placementAngleDegrees) {
        const center = this.canvasSize / 2;
        const rotationRad = (rotationDegrees * Math.PI) / 180;
        const placementRad = (placementAngleDegrees * Math.PI) / 180;
        const cos = Math.cos(-rotationRad); // Inverse rotation
        const sin = Math.sin(-rotationRad);

        // Placement offset in original coordinates
        const placementX = radiusPixels * Math.cos(placementRad);
        const placementY = radiusPixels * Math.sin(placementRad);

        // For each destination pixel
        for (let destY = 0; destY < this.canvasSize; destY++) {
            for (let destX = 0; destX < this.canvasSize; destX++) {
                const destIndex = destY * this.canvasSize + destX;

                // Skip if already has an ID (from earlier radial repeat)
                if (resultIdMatrix[destIndex] !== 0xFFFFFFFF) {
                    continue;
                }

                // Start with destination pixel, translate to center
                let x = destX - center;
                let y = destY - center;

                // Undo the placement translation (reverse of ctx.translate(placementX, placementY))
                x -= placementX;
                y -= placementY;

                // Apply inverse rotation (reverse of ctx.rotate)
                const rotX = x * cos - y * sin;
                const rotY = x * sin + y * cos;

                // Apply inverse scale (reverse of ctx.scale)
                const srcX = rotX / scale;
                const srcY = rotY / scale;

                // Translate back from center
                const finalX = srcX + center;
                const finalY = srcY + center;

                // Check bounds and sample from source
                if (finalX >= 0 && finalX < this.canvasSize && finalY >= 0 && finalY < this.canvasSize) {
                    const srcIndex = Math.round(finalY) * this.canvasSize + Math.round(finalX);
                    if (srcIndex >= 0 && srcIndex < sourceIdMatrix.length) {
                        const sourceId = sourceIdMatrix[srcIndex];
                        if (sourceId !== 0xFFFFFFFF) {
                            resultIdMatrix[destIndex] = sourceId;
                        }
                    }
                }
            }
        }
    }

    /**
     * Convert hex color to RGB
     */
    hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    /**
     * Create a whiter, less saturated version of a color
     * @param {string} colorHex - Hex color string
     * @param {number} desaturateAmount - Amount to desaturate (0.0-1.0)
     * @param {number} lightenAmount - Amount to increase lightness (0-100)
     * @returns {string} Desaturated and lightened hex color
     */
    desaturateColor(colorHex, desaturateAmount = 0.75, lightenAmount = 30) {
        const hsl = hexToHsl(colorHex);
        const newS = Math.max(0, hsl.s * (1 - desaturateAmount));
        const newL = Math.min(100, hsl.l + lightenAmount);
        const rgb = hslToRgb(hsl.h, newS, newL);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    /**
     * Get RGB color based on color mode
     * @param {string} mode - Color mode (white/black/regular/alternative/alternate)
     * @param {number} id - Pixel ID
     * @param {number} parity - Pixel parity (0 or 1)
     * @param {number|null} colorIndex - Color index for even parity pixels
     * @returns {{r: number, g: number, b: number}} RGB color object
     */
    getColorForMode(mode, id, parity, colorIndex) {
        switch (mode) {
            case 'white':
                return { r: 255, g: 255, b: 255 };

            case 'black':
                return { r: 0, g: 0, b: 0 };

            case 'alternate':
                // Alternate white/black based on ID
                const oddIndex = Math.floor(id / 2);
                const isWhite = oddIndex % 2 === 0;
                return isWhite ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };

            case 'regular':
                // Regular color from palette - just use sequential color index
                // No math needed - colorIndex is already assigned sequentially for all IDs
                const color = this.useColor
                    ? this.colorPalette.getColorForLayer(colorIndex)
                    : '#000000';
                return this.hexToRgb(color);

            case 'alternative':
                // Desaturated color from palette - just use sequential color index
                const colorAlt = this.useColor
                    ? this.colorPalette.getColorForLayer(colorIndex)
                    : '#000000';
                const desaturated = this.desaturateColor(colorAlt);
                return this.hexToRgb(desaturated);

            default:
                return { r: 0, g: 0, b: 0 };
        }
    }

    /**
     * Helper to get the graph from a node
     */
    getGraphFromNode(node) {
        if (!this.graph) {
            throw new Error('Graph not set in renderer');
        }
        return this.graph;
    }

    /**
     * Set the graph reference
     */
    setGraph(graph) {
        this.graph = graph;
    }

    /**
     * Get cache statistics for memory diagnostics
     */
    getCacheStats() {
        let totalLayers = 0;
        let totalMatrixBytes = 0;
        let totalCanvasBytes = 0;
        const matrixBytesPerPixel = 4 + 1; // Uint32Array + Uint8Array
        const canvasBytesPerPixel = 4; // RGBA

        for (const [nodeId, layers] of this.layerCache.entries()) {
            totalLayers += layers.length;
            for (const layer of layers) {
                const pixelCount = layer.idMatrix.length;
                totalMatrixBytes += pixelCount * matrixBytesPerPixel;
                totalCanvasBytes += pixelCount * canvasBytesPerPixel;
            }
        }

        return {
            nodeCount: this.layerCache.size,
            totalLayers,
            totalMatrixMB: (totalMatrixBytes / 1024 / 1024).toFixed(2),
            totalCanvasMB: (totalCanvasBytes / 1024 / 1024).toFixed(2),
            totalMB: ((totalMatrixBytes + totalCanvasBytes) / 1024 / 1024).toFixed(2),
            canvasSize: this.canvasSize,
            targetSize: this.targetSize,
            supersampleFactor: this.supersampleFactor
        };
    }

    /**
     * Clear the layer cache to free memory
     */
    clearCache() {
        this.layerCache.clear();
    }
}
