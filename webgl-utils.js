/**
 * WebGL utility functions for context setup and shader compilation
 */

/**
 * Create and initialize WebGL2 context
 */
export function initWebGL(canvas) {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL 2 is not supported in this browser');
    }
    return gl;
}

/**
 * Compile a shader from source
 */
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
}

/**
 * Link vertex and fragment shaders into a program
 */
export function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program linking failed: ${info}`);
    }

    return program;
}

/**
 * Create shader program from source strings
 */
export function createProgramFromSources(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Clean up shaders after linking
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
}

/**
 * Create a fullscreen quad buffer
 */
export function createFullscreenQuad(gl) {
    const positions = new Float32Array([
        -1, -1,  // bottom-left
         1, -1,  // bottom-right
        -1,  1,  // top-left
         1,  1,  // top-right
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    return buffer;
}

/**
 * Set up attributes for fullscreen quad rendering
 */
export function setupFullscreenQuad(gl, program) {
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const buffer = createFullscreenQuad(gl);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    return buffer;
}

/**
 * Resize canvas to match display size
 */
export function resizeCanvas(canvas) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        return true;
    }

    return false;
}

/**
 * Get uniform locations for a program
 */
export function getUniformLocations(gl, program, uniformNames) {
    const locations = {};
    for (const name of uniformNames) {
        locations[name] = gl.getUniformLocation(program, name);
    }
    return locations;
}
