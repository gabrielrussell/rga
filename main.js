import { Graph } from './graph.js';
import { Renderer } from './renderer.js';

// Initial viewport and canvas configuration
const VIEWPORT = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
const CANVAS_SIZE = 800;
const THUMBNAIL_SIZE = 200;

// UI elements
const errorDisplay = document.getElementById('error-display');
const jsonInput = document.getElementById('json-input');
const renderButton = document.getElementById('render-button');
const thumbnailGrid = document.getElementById('thumbnail-grid');
const fullsizeView = document.getElementById('fullsize-view');
const fullsizeCanvas = document.getElementById('fullsize-canvas');
const closeFullsize = document.getElementById('close-fullsize');

let currentGraph = null;
let renderer = null;

// Display error message
function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.add('visible');
    console.error(message);
}

// Clear error message
function clearError() {
    errorDisplay.textContent = '';
    errorDisplay.classList.remove('visible');
}

// Render all nodes as thumbnails
function renderThumbnails(graph) {
    thumbnailGrid.innerHTML = '';
    renderer = new Renderer(VIEWPORT, THUMBNAIL_SIZE);
    renderer.setGraph(graph);

    graph.getAllNodes().forEach(node => {
        const container = document.createElement('div');
        container.className = 'thumbnail-container';

        const canvas = document.createElement('canvas');
        canvas.width = THUMBNAIL_SIZE;
        canvas.height = THUMBNAIL_SIZE;

        const label = document.createElement('div');
        label.className = 'node-label';
        label.textContent = `Node ${node.id}`;

        container.appendChild(canvas);
        container.appendChild(label);
        thumbnailGrid.appendChild(container);

        // Render node to thumbnail
        try {
            renderer.renderNode(node, canvas);
        } catch (error) {
            showError(`Error rendering node ${node.id}: ${error.message}`);
        }

        // Click handler for fullsize view
        container.addEventListener('click', () => {
            showFullsize(node);
        });
    });
}

// Show fullsize view of a node
function showFullsize(node) {
    fullsizeCanvas.width = CANVAS_SIZE;
    fullsizeCanvas.height = CANVAS_SIZE;

    const fullsizeRenderer = new Renderer(VIEWPORT, CANVAS_SIZE);
    fullsizeRenderer.setGraph(currentGraph);
    try {
        fullsizeRenderer.renderNode(node, fullsizeCanvas);
        fullsizeView.classList.add('visible');
    } catch (error) {
        showError(`Error rendering fullsize node ${node.id}: ${error.message}`);
    }
}

// Close fullsize view
closeFullsize.addEventListener('click', () => {
    fullsizeView.classList.remove('visible');
});

fullsizeView.addEventListener('click', (e) => {
    if (e.target === fullsizeView) {
        fullsizeView.classList.remove('visible');
    }
});

// Handle render button click
renderButton.addEventListener('click', () => {
    clearError();
    thumbnailGrid.innerHTML = '';

    try {
        const jsonText = jsonInput.value.trim();
        if (!jsonText) {
            showError('Please enter a JSON graph definition');
            return;
        }

        const jsonData = JSON.parse(jsonText);
        currentGraph = Graph.fromJSON(jsonData);
        renderThumbnails(currentGraph);
    } catch (error) {
        showError(error.message);
    }
});

// Load example graph on startup
const exampleGraph = {
    nodes: [
        { id: 0 }
    ]
};

jsonInput.value = JSON.stringify(exampleGraph, null, 2);
