import { ColorPalette } from './color.js';

/**
 * Renderer for graph nodes using HTML5 Canvas with layer-based rendering
 * and color support. Uses ID matrix to track pixel inversion state.
 */
export class Renderer {
    constructor(viewport, canvasSize, colorPalette = null) {
        this.viewport = viewport; // { minX, maxX, minY, maxY }
        this.canvasSize = canvasSize; // pixel dimensions (square canvas)
        this.layerCache = new Map(); // node id -> array of {canvas, idMatrix, depth}
        this.colorPalette = colorPalette || new ColorPalette('#3498db');
        this.useColor = colorPalette !== null;
        this.nextPixelId = 0; // Global counter for unique pixel IDs, increments by 2
    }

    /**
     * Set the color palette
     */
    setColorPalette(colorPalette) {
        this.colorPalette = colorPalette;
        this.useColor = true;
        this.layerCache.clear(); // Clear cache when colors change
    }

    /**
     * Enable/disable color mode
     */
    setUseColor(useColor) {
        this.useColor = useColor;
        this.layerCache.clear();
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
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

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

        // Apply final coloring based on parity and depth
        this.applyFinalColors(targetCanvas, finalIdMatrix, finalDepthMatrix);

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
     * Apply final colors to canvas based on idMatrix and depth
     * Odd ID (parity 1) = white, Even ID (parity 0) = depth color
     */
    applyFinalColors(canvas, idMatrix, depthMatrix) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const id = idMatrix[i];
            const pixelIndex = i * 4;

            if (id === 0xFFFFFFFF) {
                // Transparent pixel - set alpha to 0
                data[pixelIndex + 3] = 0;
            } else {
                const parity = id % 2;
                if (parity === 1) {
                    // Odd parity - render as white
                    data[pixelIndex] = 255;
                    data[pixelIndex + 1] = 255;
                    data[pixelIndex + 2] = 255;
                    data[pixelIndex + 3] = 255;
                } else {
                    // Even parity - render with depth color
                    const depth = depthMatrix[i];
                    const color = this.useColor
                        ? this.colorPalette.getColorForLayer(depth)
                        : '#000000';
                    const rgb = this.hexToRgb(color);

                    data[pixelIndex] = rgb.r;
                    data[pixelIndex + 1] = rgb.g;
                    data[pixelIndex + 2] = rgb.b;
                    data[pixelIndex + 3] = 255;
                }
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
     * Assigns unique even IDs (parity 0) to all circle pixels
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

        // Create ID matrix: store full IDs for each pixel
        // IDs are even (parity 0) for root pixels
        const idMatrix = new Uint32Array(this.canvasSize * this.canvasSize);

        // Get alpha channel to determine which pixels are part of the circle
        const imageData = ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
        const alphaData = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const alpha = alphaData[i * 4 + 3];
            if (alpha > 0) {
                // Assign unique even ID (parity 0)
                idMatrix[i] = this.nextPixelId;
                this.nextPixelId += 2;
            } else {
                // Transparent pixel
                idMatrix[i] = 0xFFFFFFFF; // Use max uint32 as "no pixel" marker
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
     * @param {Uint32Array} sourceIdMatrix - Original ID matrix
     * @param {boolean} flipParity - Whether to flip parity (even↔odd)
     * @returns {Uint32Array} New ID matrix with reassigned IDs
     */
    reassignIds(sourceIdMatrix, flipParity) {
        const newIdMatrix = new Uint32Array(sourceIdMatrix.length);

        for (let i = 0; i < sourceIdMatrix.length; i++) {
            if (sourceIdMatrix[i] === 0xFFFFFFFF) {
                // Transparent pixel - keep as transparent
                newIdMatrix[i] = 0xFFFFFFFF;
            } else {
                // Get original parity
                const originalParity = sourceIdMatrix[i] % 2;
                // Determine new parity
                const newParity = flipParity ? 1 - originalParity : originalParity;
                // Assign new ID with appropriate parity
                newIdMatrix[i] = this.nextPixelId + newParity;
                this.nextPixelId += 2;
            }
        }

        return newIdMatrix;
    }

    /**
     * Apply transformation pipeline to both canvas and idMatrix
     * Returns {canvas, idMatrix}
     */
    applyTransformations(sourceCanvas, sourceIdMatrix, scale, radialRadius, radialCount, rotation) {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = this.canvasSize;
        resultCanvas.height = this.canvasSize;
        const ctx = resultCanvas.getContext('2d');

        // Create a canvas representation of idMatrix for transformation (render by parity)
        const idCanvas = this.idMatrixToCanvas(sourceIdMatrix);
        const idCanvasResult = document.createElement('canvas');
        idCanvasResult.width = this.canvasSize;
        idCanvasResult.height = this.canvasSize;
        const idCtx = idCanvasResult.getContext('2d');

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

            // Transform idMatrix canvas with same transformations
            idCtx.translate(center, center);
            idCtx.scale(scale, scale);
            idCtx.rotate((rotation * Math.PI) / 180);
            idCtx.translate(-center, -center);
            idCtx.drawImage(idCanvas, 0, 0);

            const resultIdMatrix = this.canvasToIdMatrix(idCanvasResult);
            return { canvas: resultCanvas, idMatrix: resultIdMatrix };
        }

        // Radial repeat with count >= 1
        const center = this.canvasSize / 2;
        const radiusPixels = this.mathToPixelDistance(radialRadius);

        for (let i = 0; i < radialCount; i++) {
            // Subtract 90 degrees so that 0 degrees points up instead of right
            const angle = (i * 360) / radialCount - 90;
            const angleRad = (angle * Math.PI) / 180;

            // Transform main canvas
            ctx.save();
            ctx.translate(center, center);
            ctx.rotate((rotation * Math.PI) / 180);
            if (radialCount > 1) {
                ctx.rotate(angleRad);
            }
            ctx.translate(radiusPixels, 0);
            ctx.scale(scale, scale);
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);
            ctx.restore();

            // Transform idMatrix canvas with same transformations
            idCtx.save();
            idCtx.translate(center, center);
            idCtx.rotate((rotation * Math.PI) / 180);
            if (radialCount > 1) {
                idCtx.rotate(angleRad);
            }
            idCtx.translate(radiusPixels, 0);
            idCtx.scale(scale, scale);
            idCtx.translate(-center, -center);
            idCtx.drawImage(idCanvas, 0, 0);
            idCtx.restore();
        }

        const resultIdMatrix = this.canvasToIdMatrix(idCanvasResult);
        return { canvas: resultCanvas, idMatrix: resultIdMatrix };
    }

    /**
     * Convert idMatrix to canvas for transformation
     * Renders based on parity: even ID = black, odd ID = white
     */
    idMatrixToCanvas(idMatrix) {
        const canvas = document.createElement('canvas');
        canvas.width = this.canvasSize;
        canvas.height = this.canvasSize;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(this.canvasSize, this.canvasSize);
        const data = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const pixelIndex = i * 4;
            const id = idMatrix[i];

            if (id === 0xFFFFFFFF) {
                // Transparent
                data[pixelIndex] = 0;
                data[pixelIndex + 1] = 0;
                data[pixelIndex + 2] = 0;
                data[pixelIndex + 3] = 0;
            } else {
                const parity = id % 2;
                if (parity === 0) {
                    // Even ID (parity 0) = black
                    data[pixelIndex] = 0;
                    data[pixelIndex + 1] = 0;
                    data[pixelIndex + 2] = 0;
                    data[pixelIndex + 3] = 255;
                } else {
                    // Odd ID (parity 1) = white
                    data[pixelIndex] = 255;
                    data[pixelIndex + 1] = 255;
                    data[pixelIndex + 2] = 255;
                    data[pixelIndex + 3] = 255;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Convert canvas back to idMatrix
     * Creates placeholder IDs that encode parity: 0 (even/black) or 1 (odd/white)
     * Real unique IDs will be assigned later by reassignIds
     */
    canvasToIdMatrix(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
        const data = imageData.data;
        const idMatrix = new Uint32Array(this.canvasSize * this.canvasSize);

        for (let i = 0; i < idMatrix.length; i++) {
            const pixelIndex = i * 4;
            const alpha = data[pixelIndex + 3];

            if (alpha === 0) {
                // Transparent
                idMatrix[i] = 0xFFFFFFFF;
            } else {
                const r = data[pixelIndex];
                // Black = parity 0 (even), White = parity 1 (odd)
                // Store placeholder ID that encodes just the parity
                idMatrix[i] = r > 127 ? 1 : 0;
            }
        }

        return idMatrix;
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
}
