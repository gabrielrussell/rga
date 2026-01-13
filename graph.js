/**
 * Represents a single node in the graph
 */
export class Node {
    constructor(id, baseParent = null, transformParent = null,
                scale = 1.0, radialRadius = 0, radialCount = 0, rotation = 0, comment = null) {
        this.id = id;
        this.baseParent = baseParent;
        this.transformParent = transformParent;
        this.scale = scale;
        this.radialRadius = radialRadius;
        this.radialCount = radialCount;
        this.rotation = rotation;
        this.comment = comment;
    }

    /**
     * Check if this is a root node (no parents)
     */
    isRoot() {
        return this.baseParent === null && this.transformParent === null;
    }
}

/**
 * Represents the graph structure with validation
 */
export class Graph {
    constructor() {
        this.nodes = new Map(); // id -> Node
        this.rootNode = null;
    }

    /**
     * Add a node to the graph
     */
    addNode(node) {
        this.nodes.set(node.id, node);
    }

    /**
     * Get a node by ID
     */
    getNode(id) {
        return this.nodes.get(id);
    }

    /**
     * Get all nodes
     */
    getAllNodes() {
        return Array.from(this.nodes.values());
    }

    /**
     * Load graph from JSON and validate
     */
    static fromJSON(jsonData) {
        if (!jsonData.nodes || !Array.isArray(jsonData.nodes)) {
            throw new Error('JSON must contain a "nodes" array');
        }

        const graph = new Graph();

        // First pass: create all nodes with parameter defaults
        for (const nodeData of jsonData.nodes) {
            if (nodeData.id === undefined || nodeData.id === null) {
                throw new Error('Each node must have an "id" field');
            }

            const id = nodeData.id;
            const baseParent = nodeData.base_parent !== undefined ? nodeData.base_parent : null;
            const transformParent = nodeData.transform_parent !== undefined ? nodeData.transform_parent : null;

            // Apply defaults: scale 0 -> 1.0, others default to 0
            let scale = nodeData.scale !== undefined ? nodeData.scale : 0;
            if (scale === 0) scale = 1.0;

            const radialRadius = nodeData.radial_radius !== undefined ? nodeData.radial_radius : 0;
            const radialCount = nodeData.radial_count !== undefined ? nodeData.radial_count : 0;
            const rotation = nodeData.rotation !== undefined ? nodeData.rotation : 0;
            const comment = nodeData.comment !== undefined ? nodeData.comment : null;

            // Validate non-negative constraints
            if (scale < 0) {
                throw new Error(`Node ${id}: scale must be non-negative`);
            }
            if (radialRadius < 0) {
                throw new Error(`Node ${id}: radial_radius must be non-negative`);
            }

            const node = new Node(id, baseParent, transformParent,
                                 scale, radialRadius, radialCount, rotation, comment);
            graph.addNode(node);
        }

        // Validate the graph structure
        graph.validate();

        return graph;
    }

    /**
     * Validate the graph structure
     */
    validate() {
        // Find root nodes
        const rootNodes = this.getAllNodes().filter(node => node.isRoot());

        // Validate exactly one root
        if (rootNodes.length === 0) {
            throw new Error('Graph must have exactly one root node (node with no parents)');
        }
        if (rootNodes.length > 1) {
            throw new Error(`Graph must have exactly one root node, found ${rootNodes.length}`);
        }

        this.rootNode = rootNodes[0];

        // Validate all node ID references exist
        for (const node of this.getAllNodes()) {
            if (node.baseParent !== null && !this.nodes.has(node.baseParent)) {
                throw new Error(`Node ${node.id}: base_parent ${node.baseParent} does not exist`);
            }
            if (node.transformParent !== null && !this.nodes.has(node.transformParent)) {
                throw new Error(`Node ${node.id}: transform_parent ${node.transformParent} does not exist`);
            }

            // Validate no self-references
            if (node.baseParent === node.id) {
                throw new Error(`Node ${node.id}: cannot reference itself as base_parent`);
            }
            if (node.transformParent === node.id) {
                throw new Error(`Node ${node.id}: cannot reference itself as transform_parent`);
            }
        }

        // Validate no cycles
        this.detectCycles();

        // Validate all nodes are reachable from root
        this.validateConnectivity();
    }

    /**
     * Detect cycles in the graph using DFS
     */
    detectCycles() {
        const visited = new Set();
        const recursionStack = new Set();

        const dfs = (nodeId, path) => {
            if (recursionStack.has(nodeId)) {
                throw new Error(`Cycle detected: ${path.join(' -> ')} -> ${nodeId}`);
            }
            if (visited.has(nodeId)) {
                return;
            }

            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const node = this.getNode(nodeId);
            if (node.baseParent !== null) {
                dfs(node.baseParent, [...path]);
            }
            if (node.transformParent !== null) {
                dfs(node.transformParent, [...path]);
            }

            recursionStack.delete(nodeId);
        };

        for (const node of this.getAllNodes()) {
            if (!visited.has(node.id)) {
                dfs(node.id, []);
            }
        }
    }

    /**
     * Validate that all nodes can reach the root
     */
    validateConnectivity() {
        for (const node of this.getAllNodes()) {
            if (node.isRoot()) continue;

            if (!this.canReachRoot(node.id, new Set())) {
                throw new Error(`Node ${node.id} is disconnected (does not trace back to root)`);
            }
        }
    }

    /**
     * Check if a node can reach the root through its parent references
     */
    canReachRoot(nodeId, visited) {
        if (visited.has(nodeId)) {
            return false; // Cycle protection
        }
        visited.add(nodeId);

        const node = this.getNode(nodeId);
        if (node.isRoot()) {
            return true;
        }

        // Must be able to reach root through at least one parent
        let canReach = false;
        if (node.baseParent !== null) {
            canReach = canReach || this.canReachRoot(node.baseParent, new Set(visited));
        }
        if (node.transformParent !== null) {
            canReach = canReach || this.canReachRoot(node.transformParent, new Set(visited));
        }

        return canReach;
    }
}
