import { ColorPalette } from './color.js';

/**
 * Renderer for graph nodes using HTML5 Canvas with layer-based rendering
 * and color support
 */
export class Renderer {
    constructor(viewport, canvasSize, colorPalette = null) {
        this.viewport = viewport; // { minX, maxX, minY, maxY }
        this.canvasSize = canvasSize; // pixel dimensions (square canvas)
        this.layerCache = new Map(); // node id -> array of {canvas, depth}
        this.colorPalette = colorPalette || new ColorPalette('#3498db');
        this.useColor = colorPalette !== null;
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
     */
    renderNode(node, targetCanvas) {
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Get layers for this node
        const layers = this.getNodeLayers(node);

        // Draw all layers in order
        for (const layerInfo of layers) {
            ctx.drawImage(layerInfo.canvas, 0, 0);
        }
    }

    /**
     * Get rendering layers for a node
     * Returns an array of {canvas, depth} objects
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
     * Always renders as black - colors are applied during inversion
     */
    getRootLayers() {
        const canvas = document.createElement('canvas');
        canvas.width = this.canvasSize;
        canvas.height = this.canvasSize;
        const ctx = canvas.getContext('2d');

        const center = this.mathToPixel(0, 0);
        const radius = this.mathToPixelDistance(1.0);

        // Always render root as black - colors only applied during inversion
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        return [{ canvas, depth: 0 }];
    }

    /**
     * Get layers for non-root node
     * Returns base layers + transformed/inverted transform layers with updated depths
     */
    getNonRootLayers(node) {
        const graph = this.getGraphFromNode(node);

        // Get base parent layers
        const baseParentNode = graph.getNode(node.baseParent);
        const baseLayers = this.getNodeLayers(baseParentNode);

        // Get transform parent layers
        const transformParentNode = graph.getNode(node.transformParent);
        const transformLayers = this.getNodeLayers(transformParentNode);

        // Find the maximum depth in transform layers to determine new depths
        const maxTransformDepth = Math.max(...transformLayers.map(l => l.depth));

        // Apply transformations to each transform layer, invert, and assign new depths
        const transformedLayers = transformLayers.map(layerInfo => {
            const newDepth = layerInfo.depth + 1; // Each inversion increases depth
            const transformed = this.applyTransformations(
                layerInfo.canvas,
                node.scale,
                node.radialRadius,
                node.radialCount,
                node.rotation
            );
            const inverted = this.invertColors(transformed, newDepth);
            return { canvas: inverted, depth: newDepth };
        });

        // Return base layers followed by transformed/inverted transform layers
        return [...baseLayers, ...transformedLayers];
    }

    /**
     * Apply transformation pipeline to a canvas (single layer)
     */
    applyTransformations(sourceCanvas, scale, radialRadius, radialCount, rotation) {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = this.canvasSize;
        resultCanvas.height = this.canvasSize;
        const ctx = resultCanvas.getContext('2d');

        // Handle radial_count = 0 (no transformation)
        if (radialCount === 0) {
            // Apply only scale and rotation
            const center = this.canvasSize / 2;
            ctx.translate(center, center);
            ctx.scale(scale, scale);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-center, -center);
            ctx.drawImage(sourceCanvas, 0, 0);
            return resultCanvas;
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
        }

        return resultCanvas;
    }

    /**
     * Invert colors while preserving alpha
     * In color mode: white stays white, colors are inverted to the color for the new depth
     * In B&W mode: black ↔ white
     */
    invertColors(sourceCanvas, newDepth) {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = sourceCanvas.width;
        resultCanvas.height = sourceCanvas.height;
        const ctx = resultCanvas.getContext('2d');

        // Draw source to result
        ctx.drawImage(sourceCanvas, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
        const data = imageData.data;

        if (this.useColor) {
            // Color mode: pixels that are black in B&W get depth color, white pixels stay white
            const newColor = this.colorPalette.getColorForLayer(newDepth);
            const rgb = this.hexToRgb(newColor);

            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];

                if (a > 0) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Check if source pixel is dark/black (will invert to white)
                    const isDark = r < 5 && g < 5 && b < 5;

                    if (isDark) {
                        // Dark inverts to white - keep it white
                        data[i] = 255;
                        data[i + 1] = 255;
                        data[i + 2] = 255;
                    } else {
                        // Light pixels (white) invert to dark - apply depth color
                        data[i] = rgb.r;
                        data[i + 1] = rgb.g;
                        data[i + 2] = rgb.b;
                    }
                    // Alpha stays the same
                }
            }
        } else {
            // B&W mode: simple inversion
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];         // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
                // Alpha stays the same
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return resultCanvas;
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
