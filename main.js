import { Graph, Node } from './graph.js';
import { initWebGL, createProgramFromSources, setupFullscreenQuad, getUniformLocations } from './webgl-utils.js';
import { vertexShaderSource, fragmentShaderSource } from './shaders.js';

// Configuration
const VIEWPORT = { minX: -2, maxX: 2, minY: -2, maxY: 2 };
const MAX_NODES = 256;

// UI elements
const canvas = document.getElementById('glCanvas');
const errorDisplay = document.getElementById('error-display');
const exampleSelect = document.getElementById('example-select');
const newGraphButton = document.getElementById('new-graph-button');
const importJsonButton = document.getElementById('import-json-button');
const exportJsonButton = document.getElementById('export-json-button');
const nodeSelect = document.getElementById('node-select');
const createNodeButton = document.getElementById('create-node-button');
const deleteNodeButton = document.getElementById('delete-node-button');
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
const supersampleSlider = document.getElementById('supersample-slider');
const supersampleValue = document.getElementById('supersample-value');
const fpsCounter = document.getElementById('fps-counter');

// State
let gl = null;
let program = null;
let uniformLocations = null;
let currentGraph = null;
let selectedNodeId = null;
let supersampleFactor = 1;
let animationFrameId = null;

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = performance.now();

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

// Initialize WebGL
function initGL() {
    try {
        gl = initWebGL(canvas);
        program = createProgramFromSources(gl, vertexShaderSource, fragmentShaderSource);
        setupFullscreenQuad(gl, program);

        // Get uniform locations
        const uniformNames = [
            'u_resolution',
            'u_viewport',
            'u_supersampleFactor',
            'u_targetNodeId',
            'u_nodeCount'
        ];

        // Add array uniform locations
        for (let i = 0; i < MAX_NODES; i++) {
            uniformNames.push(`u_nodeBaseParents[${i}]`);
            uniformNames.push(`u_nodeTransformParents[${i}]`);
            uniformNames.push(`u_nodeScales[${i}]`);
            uniformNames.push(`u_nodeRadialRadii[${i}]`);
            uniformNames.push(`u_nodeRadialCounts[${i}]`);
            uniformNames.push(`u_nodeRotations[${i}]`);
        }

        uniformLocations = getUniformLocations(gl, program, uniformNames);

        gl.useProgram(program);
        clearError();
    } catch (error) {
        showError(`WebGL initialization failed: ${error.message}`);
    }
}

// Upload graph data to GPU
function uploadGraphData() {
    if (!gl || !program || !currentGraph) return;

    gl.useProgram(program);

    const nodes = currentGraph.getAllNodes();
    gl.uniform1i(uniformLocations.u_nodeCount, nodes.length);

    // Upload node data
    for (let i = 0; i < MAX_NODES; i++) {
        if (i < nodes.length) {
            const node = nodes[i];
            gl.uniform1i(uniformLocations[`u_nodeBaseParents[${i}]`], node.baseParent !== null ? node.baseParent : -1);
            gl.uniform1i(uniformLocations[`u_nodeTransformParents[${i}]`], node.transformParent !== null ? node.transformParent : -1);
            gl.uniform1f(uniformLocations[`u_nodeScales[${i}]`], node.scale);
            gl.uniform1f(uniformLocations[`u_nodeRadialRadii[${i}]`], node.radialRadius);
            gl.uniform1i(uniformLocations[`u_nodeRadialCounts[${i}]`], node.radialCount);
            gl.uniform1f(uniformLocations[`u_nodeRotations[${i}]`], node.rotation);
        } else {
            // Fill unused slots with defaults
            gl.uniform1i(uniformLocations[`u_nodeBaseParents[${i}]`], -1);
            gl.uniform1i(uniformLocations[`u_nodeTransformParents[${i}]`], -1);
            gl.uniform1f(uniformLocations[`u_nodeScales[${i}]`], 1.0);
            gl.uniform1f(uniformLocations[`u_nodeRadialRadii[${i}]`], 0.0);
            gl.uniform1i(uniformLocations[`u_nodeRadialCounts[${i}]`], 0);
            gl.uniform1f(uniformLocations[`u_nodeRotations[${i}]`], 0.0);
        }
    }
}

// Render current node
function render() {
    if (!gl || !program || !currentGraph) return;

    // Determine which node to render
    const targetNodeId = selectedNodeId !== null ? selectedNodeId :
                        (currentGraph.rootNode ? currentGraph.rootNode.id : 0);

    gl.useProgram(program);

    // Set viewport uniforms
    gl.uniform2f(uniformLocations.u_resolution, canvas.width, canvas.height);
    gl.uniform4f(uniformLocations.u_viewport, VIEWPORT.minX, VIEWPORT.maxX, VIEWPORT.minY, VIEWPORT.maxY);
    gl.uniform1i(uniformLocations.u_supersampleFactor, supersampleFactor);
    gl.uniform1i(uniformLocations.u_targetNodeId, targetNodeId);

    // Set viewport
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Clear
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Update FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate >= 1000) {
        const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
        fpsCounter.textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastFpsUpdate = now;
    }
}

// Animation loop
function animate() {
    render();
    animationFrameId = requestAnimationFrame(animate);
}

// Initialize with simple root node
function initializeNewGraph() {
    currentGraph = new Graph();
    const rootNode = new Node(0);
    currentGraph.addNode(rootNode);
    currentGraph.rootNode = rootNode;
    selectedNodeId = null;

    uploadGraphData();
    updateUI();
}

// Update all UI elements
function updateUI() {
    updateNodeList();
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

// Update editor UI for selected node
function updateEditor() {
    if (selectedNodeId === null || !currentGraph) {
        editorSection.style.display = 'none';
        deleteNodeButton.disabled = true;
        return;
    }

    const node = currentGraph.getNode(selectedNodeId);
    if (!node) {
        editorSection.style.display = 'none';
        deleteNodeButton.disabled = true;
        return;
    }

    editorSection.style.display = 'block';
    editorNodeId.textContent = node.id;
    deleteNodeButton.disabled = node.isRoot();

    // Update parent selectors
    updateParentSelects();

    // Set selected values
    baseParentSelect.value = node.baseParent !== null ? node.baseParent : '';
    transformParentSelect.value = node.transformParent !== null ? node.transformParent : '';

    // Update sliders
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
function updateParentSelects() {
    const selects = [baseParentSelect, transformParentSelect];

    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">None</option>';

        if (!currentGraph) return;

        currentGraph.getAllNodes().forEach(node => {
            if (selectedNodeId !== null && node.id !== selectedNodeId) {
                const option = document.createElement('option');
                option.value = node.id;
                option.textContent = node.isRoot() ? `Node ${node.id} (Root)` : `Node ${node.id}`;
                select.appendChild(option);
            }
        });

        select.value = currentValue;
    });
}

// Event handlers
nodeSelect.addEventListener('change', (e) => {
    selectedNodeId = e.target.value === '' ? null : parseInt(e.target.value);
    updateEditor();
    render();
});

createNodeButton.addEventListener('click', () => {
    if (!currentGraph) return;

    const nodes = currentGraph.getAllNodes();
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    const newNode = new Node(newId, 0, 0); // Default to root as both parents
    currentGraph.addNode(newNode);

    try {
        currentGraph.validate();
        uploadGraphData();
        selectedNodeId = newId;
        updateUI();
        render();
        clearError();
    } catch (error) {
        currentGraph.nodes.delete(newId);
        showError(error.message);
    }
});

deleteNodeButton.addEventListener('click', () => {
    if (selectedNodeId === null || !currentGraph) return;

    const node = currentGraph.getNode(selectedNodeId);
    if (node && node.isRoot()) {
        showError('Cannot delete root node');
        return;
    }

    currentGraph.nodes.delete(selectedNodeId);
    selectedNodeId = null;

    try {
        currentGraph.validate();
        uploadGraphData();
        updateUI();
        render();
        clearError();
    } catch (error) {
        showError(error.message);
    }
});

newGraphButton.addEventListener('click', () => {
    if (confirm('Create a new graph? Current graph will be lost.')) {
        initializeNewGraph();
        render();
    }
});

// Slider event handlers
function updateNodeProperty(property, value) {
    if (selectedNodeId === null || !currentGraph) return;

    const node = currentGraph.getNode(selectedNodeId);
    if (!node) return;

    node[property] = value;

    try {
        currentGraph.validate();
        uploadGraphData();
        render();
        clearError();
    } catch (error) {
        showError(error.message);
    }
}

scaleSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    scaleValue.textContent = value.toFixed(2);
    updateNodeProperty('scale', value);
});

radialRadiusSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    radialRadiusValue.textContent = value.toFixed(2);
    updateNodeProperty('radialRadius', value);
});

radialCountSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    radialCountValue.textContent = value;
    updateNodeProperty('radialCount', value);
});

rotationSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    rotationValue.textContent = value + '°';
    updateNodeProperty('rotation', value);
});

supersampleSlider.addEventListener('input', (e) => {
    supersampleFactor = parseInt(e.target.value);
    supersampleValue.textContent = supersampleFactor + 'x';
    render();
});

baseParentSelect.addEventListener('change', (e) => {
    const value = e.target.value === '' ? null : parseInt(e.target.value);
    updateNodeProperty('baseParent', value);
});

transformParentSelect.addEventListener('change', (e) => {
    const value = e.target.value === '' ? null : parseInt(e.target.value);
    updateNodeProperty('transformParent', value);
});

// Initialize
initGL();
initializeNewGraph();
animate();
