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
        this.nextPixelId = 0; // Global counter for unique pixel IDs
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
     */
    renderNode(node, targetCanvas) {
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Get layers for this node
        const layers = this.getNodeLayers(node);

        // Composite all layers together with their idMatrices
        const finalIdMatrix = new Uint8Array(this.canvasSize * this.canvasSize);
        finalIdMatrix.fill(255);
        const finalDepthMatrix = new Uint8Array(this.canvasSize * this.canvasSize);

        // Draw all layers in order, tracking final parity and depth for each pixel
        for (const layerInfo of layers) {
            ctx.drawImage(layerInfo.canvas, 0, 0);

            // Update idMatrix and depthMatrix with this layer's data
            for (let i = 0; i < finalIdMatrix.length; i++) {
                if (layerInfo.idMatrix[i] !== 255) {
                    finalIdMatrix[i] = layerInfo.idMatrix[i];
                    finalDepthMatrix[i] = layerInfo.depth;
                }
            }
        }

        // Apply final coloring based on parity and depth
        this.applyFinalColors(targetCanvas, finalIdMatrix, finalDepthMatrix);
    }

    /**
     * Apply final colors to canvas based on idMatrix and depth
     * Parity 1 = white, Parity 0 = depth color
     */
    applyFinalColors(canvas, idMatrix, depthMatrix) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const parity = idMatrix[i];
            const pixelIndex = i * 4;

            if (parity === 255) {
                // Transparent pixel - set alpha to 0
                data[pixelIndex + 3] = 0;
            } else if (parity === 1) {
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
     * Creates ID matrix where all circle pixels have parity 0
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

        // Create ID matrix: store parity bit for each pixel
        // 0 = even parity (render with color), 1 = odd parity (render white)
        const idMatrix = new Uint8Array(this.canvasSize * this.canvasSize);

        // Get alpha channel to determine which pixels are part of the circle
        const imageData = ctx.getImageData(0, 0, this.canvasSize, this.canvasSize);
        const alphaData = imageData.data;

        for (let i = 0; i < idMatrix.length; i++) {
            const alpha = alphaData[i * 4 + 3];
            // If pixel has alpha > 0, it's part of the circle with parity 0
            idMatrix[i] = alpha > 0 ? 0 : 255; // 255 = transparent/no pixel
        }

        return [{ canvas, idMatrix, depth: 0 }];
    }

    /**
     * Get layers for non-root node
     * Returns base layers + transformed/inverted transform layers with updated depths
     * Maintains ID matrices with proper parity tracking
     */
    getNonRootLayers(node) {
        const graph = this.getGraphFromNode(node);

        // Get base parent layers (preserve parity)
        const baseParentNode = graph.getNode(node.baseParent);
        const baseLayers = this.getNodeLayers(baseParentNode);

        // Get transform parent layers (will flip parity)
        const transformParentNode = graph.getNode(node.transformParent);
        const transformLayers = this.getNodeLayers(transformParentNode);

        // Apply transformations to each transform layer and flip parity
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

            // Flip parity for transform parent pixels
            const flippedIdMatrix = this.flipParity(transformedIdMatrix);

            return { canvas: transformedCanvas, idMatrix: flippedIdMatrix, depth: newDepth };
        });

        // Return base layers followed by transformed transform layers
        return [...baseLayers, ...transformedLayers];
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

        // Create result idMatrix (initialized to 255 = transparent)
        const resultIdMatrix = new Uint8Array(this.canvasSize * this.canvasSize);
        resultIdMatrix.fill(255);

        // Handle radial_count = 0 (no transformation)
        if (radialCount === 0) {
            // Apply only scale and rotation
            const center = this.canvasSize / 2;
            ctx.translate(center, center);
            ctx.scale(scale, scale);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);

            // For idMatrix, we need to sample from source based on inverse transform
            // For now, simplified: copy the idMatrix (works for simple cases)
            // TODO: properly transform idMatrix with inverse sampling
            this.transformIdMatrix(sourceIdMatrix, resultIdMatrix, scale, rotation, 0, 0, 0);

            return { canvas: resultCanvas, idMatrix: resultIdMatrix };
        }

        // Radial repeat with count >= 1
        const center = this.canvasSize / 2;
        const radiusPixels = this.mathToPixelDistance(radialRadius);

        for (let i = 0; i < radialCount; i++) {
            // Subtract 90 degrees so that 0 degrees points up instead of right
            const angle = (i * 360) / radialCount - 90;
            const angleRad = (angle * Math.PI) / 180;

            ctx.save();

            // Move to center
            ctx.translate(center, center);

            // Apply final rotation
            ctx.rotate((rotation * Math.PI) / 180);

            // Rotate by angle (for this copy)
            if (radialCount > 1) {
                ctx.rotate(angleRad);
            }

            // Translate by radius
            ctx.translate(radiusPixels, 0);

            // Apply scale
            ctx.scale(scale, scale);

            // Draw the source canvas centered
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);

            ctx.restore();

            // Transform the idMatrix for this repeat
            // Simplified: sample from transformed pixels
            this.transformIdMatrix(sourceIdMatrix, resultIdMatrix, scale, rotation + angle, radiusPixels, 0, radialCount);
        }

        return { canvas: resultCanvas, idMatrix: resultIdMatrix };
    }

    /**
     * Transform idMatrix to match canvas transformation
     * Simplified implementation: samples result canvas alpha to copy parity
     */
    transformIdMatrix(sourceIdMatrix, resultIdMatrix, scale, rotation, radiusPixels, angle, radialCount) {
        // For simplicity, we'll read the result canvas alpha and copy parity from overlapping areas
        // This is a simplified approach - proper implementation would inverse-transform each pixel
        // For now, just copy the source idMatrix structure
        for (let i = 0; i < sourceIdMatrix.length; i++) {
            if (sourceIdMatrix[i] !== 255 && resultIdMatrix[i] === 255) {
                resultIdMatrix[i] = sourceIdMatrix[i];
            }
        }
    }

    /**
     * Flip parity bits in idMatrix
     * 0 -> 1, 1 -> 0, 255 (transparent) stays 255
     */
    flipParity(sourceIdMatrix) {
        const flipped = new Uint8Array(sourceIdMatrix.length);
        for (let i = 0; i < sourceIdMatrix.length; i++) {
            if (sourceIdMatrix[i] === 255) {
                flipped[i] = 255; // Keep transparent
            } else {
                flipped[i] = sourceIdMatrix[i] === 0 ? 1 : 0; // Flip parity
            }
        }
        return flipped;
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
