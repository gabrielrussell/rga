/**
 * Renderer for graph nodes using HTML5 Canvas with layer-based rendering
 * to preserve layer structure across radial repeats
 */
export class Renderer {
    constructor(viewport, canvasSize) {
        this.viewport = viewport; // { minX, maxX, minY, maxY }
        this.canvasSize = canvasSize; // pixel dimensions (square canvas)
        this.layerCache = new Map(); // node id -> array of layer canvases
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
        for (const layer of layers) {
            ctx.drawImage(layer, 0, 0);
        }
    }

    /**
     * Get rendering layers for a node
     * Returns an array of canvases, each representing a layer
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
     * Get layers for root node (single layer: black circle)
     */
    getRootLayers() {
        const canvas = document.createElement('canvas');
        canvas.width = this.canvasSize;
        canvas.height = this.canvasSize;
        const ctx = canvas.getContext('2d');

        const center = this.mathToPixel(0, 0);
        const radius = this.mathToPixelDistance(1.0);

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        return [canvas];
    }

    /**
     * Get layers for non-root node
     * Returns base layers + transformed/inverted transform layers
     */
    getNonRootLayers(node) {
        const graph = this.getGraphFromNode(node);

        // Get base parent layers
        const baseParentNode = graph.getNode(node.baseParent);
        const baseLayers = this.getNodeLayers(baseParentNode);

        // Get transform parent layers
        const transformParentNode = graph.getNode(node.transformParent);
        const transformLayers = this.getNodeLayers(transformParentNode);

        // Apply transformations to each transform layer, invert, and collect
        const transformedLayers = transformLayers.map(layer => {
            const transformed = this.applyTransformations(
                layer,
                node.scale,
                node.radialRadius,
                node.radialCount,
                node.rotation
            );
            return this.invertColors(transformed);
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
        // Now all copies of this layer are drawn before moving to the next layer
        const center = this.canvasSize / 2;
        const radiusPixels = this.mathToPixelDistance(radialRadius);

        for (let i = 0; i < radialCount; i++) {
            const angle = (i * 360) / radialCount;
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
     * Invert colors (black <-> white) while preserving alpha
     */
    invertColors(sourceCanvas) {
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = sourceCanvas.width;
        resultCanvas.height = sourceCanvas.height;
        const ctx = resultCanvas.getContext('2d');

        // Draw source to result
        ctx.drawImage(sourceCanvas, 0, 0);

        // Get image data and invert colors
        const imageData = ctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            // Invert RGB, preserve alpha
            data[i] = 255 - data[i];         // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
            // data[i + 3] is alpha, leave unchanged
        }

        ctx.putImageData(imageData, 0, 0);
        return resultCanvas;
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
