import { Graph, Node } from './graph.js';
import { Renderer } from './renderer.js';
import { ColorPalette } from './color.js';

// Configuration
const VIEWPORT = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
const CANVAS_SIZE = 800;
const THUMBNAIL_SIZE = 200;

// UI elements
const errorDisplay = document.getElementById('error-display');
const exampleSelect = document.getElementById('example-select');
const newGraphButton = document.getElementById('new-graph-button');
const importJsonButton = document.getElementById('import-json-button');
const importJsonInput = document.getElementById('import-json-input');
const exportJsonButton = document.getElementById('export-json-button');
const nodeSelect = document.getElementById('node-select');
const createNodeButton = document.getElementById('create-node-button');
const editorSection = document.getElementById('editor-section');
const editorNodeId = document.getElementById('editor-node-id');
const baseParentSelect = document.getElementById('base-parent-select');
const transformParentSelect = document.getElementById('transform-parent-select');
const scaleSlider = document.getElementById('scale-slider');
const scaleValue = document.getElementById('scale-value');
const radialRadiusSlider = document.getElementById('radial-radius-slider');
const radialRadiusValue = document.getElementById('radial-radius-value');
const radialCountSlider = document.getElementById('radial-count-slider');
const radialCountValue = document.getElementById('radial-count-value');
const rotationSlider = document.getElementById('rotation-slider');
const rotationValue = document.getElementById('rotation-value');
const deleteNodeButton = document.getElementById('delete-node-button');
const thumbnailGrid = document.getElementById('thumbnail-grid');
const fullsizePreview = document.getElementById('fullsize-preview');
const fullsizeCanvas = document.getElementById('fullsize-canvas');
const pixelStats = document.getElementById('pixel-stats');
const colorEnabledCheckbox = document.getElementById('color-enabled-checkbox');
const baseColorPicker = document.getElementById('base-color-picker');
const evenParityMode = document.getElementById('even-parity-mode');
const oddParityMode = document.getElementById('odd-parity-mode');
const firstIndexMode = document.getElementById('first-index-mode');
const lastIndexMode = document.getElementById('last-index-mode');
const clearCacheButton = document.getElementById('clear-cache-button');
const refreshStatsButton = document.getElementById('refresh-stats-button');
const fullsizeMemorySpan = document.getElementById('fullsize-memory');
const thumbnailMemorySpan = document.getElementById('thumbnail-memory');
const totalMemorySpan = document.getElementById('total-memory');

// State
let currentGraph = null;
let selectedNodeId = null;
let renderer = null; // Thumbnail renderer
let fullsizeRenderer = null; // Fullsize renderer (separate cache)
let colorPalette = new ColorPalette('#3498db');
let colorEnabled = true;
let colorModes = {
    evenParity: 'regular',
    oddParity: 'alternate',
    firstIndex: 'inherit',
    lastIndex: 'inherit'
};

// Error handling
function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.classList.add('visible');
    console.error(message);
}

function clearError() {
    errorDisplay.textContent = '';
    errorDisplay.classList.remove('visible');
}

// Apply color settings from JSON data
function applyColorSettings(jsonData) {
    if (jsonData.color_settings) {
        const settings = jsonData.color_settings;

        if (settings.base_color) {
            colorPalette.setBaseColor(settings.base_color);
            baseColorPicker.value = settings.base_color;
        }

        if (settings.enabled !== undefined) {
            colorEnabled = settings.enabled;
            colorEnabledCheckbox.checked = settings.enabled;
        }
    }
}

// Initialize with simple root node
function initializeNewGraph() {
    currentGraph = new Graph();
    const rootNode = new Node(0);
    currentGraph.addNode(rootNode);
    currentGraph.rootNode = rootNode;
    selectedNodeId = null;
    updateUI();
}

// Update all UI elements
function updateUI() {
    updateNodeList();
    updateThumbnails();
    updateEditor();
}

// Update node selector dropdown
function updateNodeList() {
    nodeSelect.innerHTML = '<option value="">-- Select a node --</option>';
    if (!currentGraph) return;

    currentGraph.getAllNodes().forEach(node => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = node.isRoot() ? `Node ${node.id} (Root)` : `Node ${node.id}`;
        if (selectedNodeId === node.id) option.selected = true;
        nodeSelect.appendChild(option);
    });
}

// Node selector change handler
nodeSelect.addEventListener('change', (e) => {
    const nodeId = e.target.value === '' ? null : parseInt(e.target.value);
    if (nodeId !== null) {
        selectNode(nodeId);
    } else {
        selectedNodeId = null;
        updateEditor();
        updateThumbnails();
    }
});

// Select a node for editing
function selectNode(nodeId) {
    selectedNodeId = nodeId;
    updateNodeList();
    updateEditor();
    updateThumbnails(); // Highlight selected thumbnail
    updateFullsizePreview();
}

// Update fullsize preview for selected node
function updateFullsizePreview() {
    if (selectedNodeId === null || !currentGraph) {
        fullsizePreview.style.display = 'none';
        return;
    }

    const node = currentGraph.getNode(selectedNodeId);
    if (!node) return;

    fullsizePreview.style.display = 'block';

    // Create fullsize renderer only if it doesn't exist
    if (!fullsizeRenderer) {
        fullsizeRenderer = new Renderer(VIEWPORT, CANVAS_SIZE, colorEnabled ? colorPalette : null, 2);
    }
    fullsizeRenderer.setGraph(currentGraph);
    fullsizeRenderer.setColorModes(colorModes);
    fullsizeRenderer.setUseColor(colorEnabled);
    if (colorEnabled) {
        fullsizeRenderer.setColorPalette(colorPalette);
    }

    try {
        const stats = fullsizeRenderer.renderNode(node, fullsizeCanvas);
        displayPixelStats(stats);
    } catch (error) {
        showError(`Error rendering fullsize node ${node.id}: ${error.message}`);
    }
}

// Display pixel statistics
function displayPixelStats(stats) {
    const node = currentGraph.getNode(selectedNodeId);
    const timestamp = new Date().toISOString();

    let html = '<strong>Render Metadata:</strong><br>';
    html += `Node: ${node.id}${node.isRoot() ? ' (Root)' : ''}<br>`;
    if (!node.isRoot()) {
        html += `Base Parent: ${node.baseParent}, Transform Parent: ${node.transformParent}<br>`;
        html += `Scale: ${node.scale.toFixed(2)}, Radial: ${node.radialCount} @ ${node.radialRadius.toFixed(2)}, Rotation: ${node.rotation}°<br>`;
    }
    html += `Timestamp: ${timestamp}<br>`;
    html += `Color: ${colorEnabled ? 'Enabled' : 'Disabled'}${colorEnabled ? ` (${colorPalette.baseColor})` : ''}<br>`;
    html += `Canvas: ${CANVAS_SIZE}x${CANVAS_SIZE} (2x supersampled)<br><br>`;

    html += '<strong>Pixel Statistics:</strong><br>';
    html += `Total Unique Pixel IDs: ${stats.totalUniqueIds.toLocaleString()}<br>`;
    html += `Even parity (colored): ${stats.evenCount.toLocaleString()} pixels<br>`;
    html += `Odd parity (white): ${stats.oddCount.toLocaleString()} pixels<br>`;
    html += `Transparent: ${stats.transparentCount.toLocaleString()} pixels<br><br>`;

    html += '<strong>IDs by Depth and Parity:</strong><br>';
    for (const depthInfo of stats.depthInfo) {
        html += `<br><strong>Depth ${depthInfo.depth}:</strong><br>`;

        if (depthInfo.even.length > 0) {
            html += `&nbsp;&nbsp;Even IDs (${depthInfo.even.length} unique): `;
            const evenSample = depthInfo.even.slice(0, 20);
            html += evenSample.join(', ');
            if (depthInfo.even.length > 20) {
                html += `, ... (${depthInfo.even.length - 20} more)`;
            }
            html += '<br>';
        }

        if (depthInfo.odd.length > 0) {
            html += `&nbsp;&nbsp;Odd IDs (${depthInfo.odd.length} unique): `;
            const oddSample = depthInfo.odd.slice(0, 20);
            html += oddSample.join(', ');
            if (depthInfo.odd.length > 20) {
                html += `, ... (${depthInfo.odd.length - 20} more)`;
            }
            html += '<br>';
        }
    }

    pixelStats.innerHTML = html;
}

// Update the editor panel with selected node's values
function updateEditor() {
    if (selectedNodeId === null || !currentGraph) {
        editorSection.classList.remove('visible');
        return;
    }

    const node = currentGraph.getNode(selectedNodeId);
    if (!node) return;

    editorSection.classList.add('visible');
    editorNodeId.textContent = node.id;

    // Disable editing for root node (can't have parents or transforms)
    const isRoot = node.isRoot();
    baseParentSelect.disabled = isRoot;
    transformParentSelect.disabled = isRoot;
    scaleSlider.disabled = isRoot;
    radialRadiusSlider.disabled = isRoot;
    radialCountSlider.disabled = isRoot;
    rotationSlider.disabled = isRoot;
    deleteNodeButton.disabled = isRoot;

    if (isRoot) {
        baseParentSelect.innerHTML = '<option>N/A (Root)</option>';
        transformParentSelect.innerHTML = '<option>N/A (Root)</option>';
        scaleSlider.value = 1;
        scaleValue.textContent = '1.0';
        radialRadiusSlider.value = 0;
        radialRadiusValue.textContent = '0.0';
        radialCountSlider.value = 0;
        radialCountValue.textContent = '0';
        rotationSlider.value = 0;
        rotationValue.textContent = '0°';
        return;
    }

    // Populate parent selectors
    updateParentSelectors(node);

    // Set slider values
    scaleSlider.value = node.scale;
    scaleValue.textContent = node.scale.toFixed(2);
    radialRadiusSlider.value = node.radialRadius;
    radialRadiusValue.textContent = node.radialRadius.toFixed(2);
    radialCountSlider.value = node.radialCount;
    radialCountValue.textContent = node.radialCount;
    rotationSlider.value = node.rotation;
    rotationValue.textContent = node.rotation + '°';
}

// Update parent selector dropdowns
function updateParentSelectors(currentNode) {
    const nodes = currentGraph.getAllNodes();

    // Base parent selector
    baseParentSelect.innerHTML = '';
    nodes.forEach(node => {
        if (node.id !== currentNode.id) { // Can't be parent of self
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.isRoot() ? `Node ${node.id} (Root)` : `Node ${node.id}`;
            if (node.id === currentNode.baseParent) option.selected = true;
            baseParentSelect.appendChild(option);
        }
    });

    // Transform parent selector
    transformParentSelect.innerHTML = '';
    nodes.forEach(node => {
        if (node.id !== currentNode.id) { // Can't be parent of self
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.isRoot() ? `Node ${node.id} (Root)` : `Node ${node.id}`;
            if (node.id === currentNode.transformParent) option.selected = true;
            transformParentSelect.appendChild(option);
        }
    });
}

// Render all thumbnails
function updateThumbnails() {
    thumbnailGrid.innerHTML = '';
    if (!currentGraph) return;

    // Create renderer only if it doesn't exist or needs recreation
    if (!renderer) {
        renderer = new Renderer(VIEWPORT, THUMBNAIL_SIZE, colorEnabled ? colorPalette : null, 2);
    }
    renderer.setGraph(currentGraph);
    renderer.setColorModes(colorModes);
    renderer.setUseColor(colorEnabled);
    if (colorEnabled) {
        renderer.setColorPalette(colorPalette);
    }

    currentGraph.getAllNodes().forEach(node => {
        const container = document.createElement('div');
        container.className = 'thumbnail-container';
        if (selectedNodeId === node.id) container.classList.add('selected');

        const canvas = document.createElement('canvas');
        canvas.width = THUMBNAIL_SIZE;
        canvas.height = THUMBNAIL_SIZE;

        const label = document.createElement('div');
        label.className = 'node-label';
        label.textContent = node.isRoot() ? `Node ${node.id} (Root)` : `Node ${node.id}`;

        container.appendChild(canvas);
        container.appendChild(label);
        thumbnailGrid.appendChild(container);

        // Render node to thumbnail
        try {
            renderer.renderNode(node, canvas);
        } catch (error) {
            showError(`Error rendering node ${node.id}: ${error.message}`);
        }

        // Click to select node
        container.addEventListener('click', () => selectNode(node.id));
    });

    // Update memory stats after rendering
    updateMemoryStats();
}

// Create new node
createNodeButton.addEventListener('click', () => {
    if (!currentGraph) return;

    const nodes = currentGraph.getAllNodes();
    const newId = Math.max(...nodes.map(n => n.id)) + 1;

    // Default: use root as both parents
    const rootId = currentGraph.rootNode.id;
    const newNode = new Node(newId, rootId, rootId, 1.0, 0, 0, 0);

    currentGraph.addNode(newNode);
    selectNode(newId);
    updateUI();
});

// Delete node
deleteNodeButton.addEventListener('click', () => {
    if (selectedNodeId === null || !currentGraph) return;

    const node = currentGraph.getNode(selectedNodeId);
    if (node.isRoot()) {
        showError('Cannot delete root node');
        return;
    }

    // Check if any other nodes depend on this one
    const dependents = currentGraph.getAllNodes().filter(n =>
        n.baseParent === selectedNodeId || n.transformParent === selectedNodeId
    );

    if (dependents.length > 0) {
        showError(`Cannot delete node ${selectedNodeId}: used by ${dependents.length} other node(s)`);
        return;
    }

    currentGraph.nodes.delete(selectedNodeId);
    selectedNodeId = null;
    updateUI();
});

// Slider event listeners
scaleSlider.addEventListener('input', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.scale = parseFloat(e.target.value);
    scaleValue.textContent = node.scale.toFixed(2);
    updateThumbnails();
    updateFullsizePreview();
});

radialRadiusSlider.addEventListener('input', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.radialRadius = parseFloat(e.target.value);
    radialRadiusValue.textContent = node.radialRadius.toFixed(2);
    updateThumbnails();
    updateFullsizePreview();
});

radialCountSlider.addEventListener('input', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.radialCount = parseInt(e.target.value);
    radialCountValue.textContent = node.radialCount;
    updateThumbnails();
    updateFullsizePreview();
});

rotationSlider.addEventListener('input', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.rotation = parseFloat(e.target.value);
    rotationValue.textContent = node.rotation + '°';
    updateThumbnails();
    updateFullsizePreview();
});

// Parent selector event listeners
baseParentSelect.addEventListener('change', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.baseParent = parseInt(e.target.value);
    updateThumbnails();
    updateFullsizePreview();
});

transformParentSelect.addEventListener('change', (e) => {
    if (selectedNodeId === null) return;
    const node = currentGraph.getNode(selectedNodeId);
    node.transformParent = parseInt(e.target.value);
    updateThumbnails();
    updateFullsizePreview();
});

// Load example
exampleSelect.addEventListener('change', async (e) => {
    const examplePath = e.target.value;
    if (!examplePath) return;

    clearError();

    try {
        const response = await fetch(examplePath);
        if (!response.ok) {
            throw new Error(`Failed to load example: ${response.statusText}`);
        }
        const jsonData = await response.json();
        currentGraph = Graph.fromJSON(jsonData);
        applyColorSettings(jsonData);
        selectedNodeId = null;
        updateUI();
        exampleSelect.value = ''; // Reset selector
    } catch (error) {
        showError(`Error loading example: ${error.message}`);
    }
});

// New graph button
newGraphButton.addEventListener('click', () => {
    initializeNewGraph();
});

// Import JSON button - triggers file input
importJsonButton.addEventListener('click', () => {
    importJsonInput.click();
});

// Import JSON file handler
importJsonInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    clearError();

    try {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        currentGraph = Graph.fromJSON(jsonData);
        applyColorSettings(jsonData);
        selectedNodeId = null;
        updateUI();
        // Reset the file input so the same file can be loaded again if needed
        importJsonInput.value = '';
    } catch (error) {
        showError(`Error importing JSON: ${error.message}`);
        importJsonInput.value = '';
    }
});

// Export to JSON
exportJsonButton.addEventListener('click', () => {
    if (!currentGraph) return;

    const nodes = currentGraph.getAllNodes().map(node => {
        const obj = { id: node.id };
        if (!node.isRoot()) {
            obj.base_parent = node.baseParent;
            obj.transform_parent = node.transformParent;
            obj.scale = node.scale;
            obj.radial_radius = node.radialRadius;
            obj.radial_count = node.radialCount;
            obj.rotation = node.rotation;
        }
        return obj;
    });

    const exportData = {
        nodes,
        color_settings: {
            enabled: colorEnabled,
            base_color: colorPalette.baseColor
        }
    };

    const json = JSON.stringify(exportData, null, 2);

    // Download as file
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Color controls event listeners
colorEnabledCheckbox.addEventListener('change', (e) => {
    colorEnabled = e.target.checked;
    updateThumbnails();
    updateFullsizePreview();
});

baseColorPicker.addEventListener('input', (e) => {
    colorPalette.setBaseColor(e.target.value);
    updateThumbnails();
    updateFullsizePreview();
});

evenParityMode.addEventListener('change', (e) => {
    colorModes.evenParity = e.target.value;
    updateThumbnails();
    updateFullsizePreview();
});

oddParityMode.addEventListener('change', (e) => {
    colorModes.oddParity = e.target.value;
    updateThumbnails();
    updateFullsizePreview();
});

firstIndexMode.addEventListener('change', (e) => {
    colorModes.firstIndex = e.target.value;
    updateThumbnails();
    updateFullsizePreview();
});

lastIndexMode.addEventListener('change', (e) => {
    colorModes.lastIndex = e.target.value;
    updateThumbnails();
    updateFullsizePreview();
});

// Memory diagnostics
function updateMemoryStats() {
    let thumbnailStats = { totalMB: '0.00', nodeCount: 0, totalLayers: 0 };
    let fullsizeStats = { totalMB: '0.00', nodeCount: 0, totalLayers: 0 };

    if (renderer) {
        thumbnailStats = renderer.getCacheStats();
    }

    if (fullsizeRenderer) {
        fullsizeStats = fullsizeRenderer.getCacheStats();
    }

    const thumbnailMB = parseFloat(thumbnailStats.totalMB);
    const fullsizeMB = parseFloat(fullsizeStats.totalMB);
    const totalMB = thumbnailMB + fullsizeMB;

    fullsizeMemorySpan.textContent = `${fullsizeStats.totalMB} MB (${fullsizeStats.nodeCount} nodes, ${fullsizeStats.totalLayers} layers)`;
    thumbnailMemorySpan.textContent = `${thumbnailStats.totalMB} MB (${thumbnailStats.nodeCount} nodes, ${thumbnailStats.totalLayers} layers)`;
    totalMemorySpan.textContent = `${totalMB.toFixed(2)} MB`;

    // Add warning if memory is high
    if (totalMB > 500) {
        totalMemorySpan.style.color = '#d32f2f';
        totalMemorySpan.style.fontWeight = 'bold';
    } else if (totalMB > 200) {
        totalMemorySpan.style.color = '#ff9800';
        totalMemorySpan.style.fontWeight = 'bold';
    } else {
        totalMemorySpan.style.color = '#666';
        totalMemorySpan.style.fontWeight = 'normal';
    }
}

clearCacheButton.addEventListener('click', () => {
    if (renderer) {
        renderer.clearCache();
    }
    if (fullsizeRenderer) {
        fullsizeRenderer.clearCache();
    }

    updateMemoryStats();
    showError('Caches cleared');
    setTimeout(() => hideError(), 2000);
});

refreshStatsButton.addEventListener('click', () => {
    updateMemoryStats();
});

// Initialize on load
initializeNewGraph();
