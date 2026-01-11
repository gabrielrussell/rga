/**
 * Renderer for graph nodes using HTML5 Canvas
 */
export class Renderer {
    constructor(viewport, canvasSize) {
        this.viewport = viewport; // { minX, maxX, minY, maxY }
        this.canvasSize = canvasSize; // pixel dimensions (square canvas)
        this.renderCache = new Map(); // node id -> canvas
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

        if (node.isRoot()) {
            this.renderRootNode(ctx);
        } else {
            this.renderNonRootNode(node, ctx);
        }
    }

    /**
     * Render the root node (black circle, radius 1.0)
     */
    renderRootNode(ctx) {
        const center = this.mathToPixel(0, 0);
        const radius = this.mathToPixelDistance(1.0);

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }

    /**
     * Render a non-root node using compositional rendering
     */
    renderNonRootNode(node, targetCtx) {
        const graph = this.getGraphFromNode(node);

        // Create temporary canvases for base and transform
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = this.canvasSize;
        baseCanvas.height = this.canvasSize;

        const transformCanvas = document.createElement('canvas');
        transformCanvas.width = this.canvasSize;
        transformCanvas.height = this.canvasSize;

        // Recursively render base parent
        const baseParentNode = graph.getNode(node.baseParent);
        this.renderNode(baseParentNode, baseCanvas);

        // Recursively render transform parent
        const transformParentNode = graph.getNode(node.transformParent);
        this.renderNode(transformParentNode, transformCanvas);

        // Apply transformations to transform canvas
        const transformedCanvas = this.applyTransformations(
            transformCanvas,
            node.scale,
            node.radialRadius,
            node.radialCount,
            node.rotation
        );

        // Invert colors of transformed canvas
        const invertedCanvas = this.invertColors(transformedCanvas);

        // Composite: draw base, then draw inverted transform on top
        targetCtx.drawImage(baseCanvas, 0, 0);
        targetCtx.drawImage(invertedCanvas, 0, 0);
    }

    /**
     * Apply transformation pipeline to a canvas
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
     * This is a workaround - we'll store a reference to the graph in the renderer
     */
    getGraphFromNode(node) {
        // We need access to the graph to look up parent nodes
        // This will be set by the main.js before rendering
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
