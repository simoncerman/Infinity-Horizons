import * as THREE from 'three';
import { getUserPosition } from './geolocation.js';
import { fetchMapData,renderAll } from './mapApi.js';
import { renderChunk } from './rendering/renderChunk.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const chunkSize = 500; // Size of each chunk in meters

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1); // Set background color to white
renderer.shadowMap.enabled = true; // Enable shadows in the renderer
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
document.body.appendChild(renderer.domElement);

// camera offset from central point
const cameraOffset = {
    x: 0,
    y: 40,
    z: 125
};

camera.position.z = cameraOffset.z; 
camera.position.y = cameraOffset.y; 
camera.position.x = cameraOffset.x; 
//TODO: Rework camera rotations
camera.rotation.x = -Math.PI / 180 * 75; // Rotate camera 75 degrees downward

let controls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    dragging: false,
    dragStart: { x: 0, y: 0 },
    realRotation: { x: 0, y: 0},
    rotation: { x: -Math.PI / 4, y: 0, z: 0}, // Initial rotation
};
let yaw = 0;
let pitch = 0;

const largeCubeGeometry = new THREE.BoxGeometry(10, 10, 10); // Large cube dimensions
const largeCubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for the large cube
const largeCube = new THREE.Mesh(largeCubeGeometry, largeCubeMaterial);
largeCube.position.set(0, 0, 0); // Set large cube to the center of the scene
scene.add(largeCube);

// Add lighting to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); // Increase ambient light intensity
scene.add(ambientLight);

// TODO: Reimplement directional light for large scene with many chunks
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increase directional light intensity
directionalLight.position.set(50, 100, 50); // Position the light
directionalLight.castShadow = true; // Enable shadows

// Configure shadow properties
directionalLight.shadow.mapSize.width = 2048; // Shadow map resolution
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;

scene.add(directionalLight);

// Ensure shadows are enabled in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

largeCube.castShadow = true; // Example object casts shadows

let treeModel = null; // Reference to the tree model
let cachedTreeModel = null; // Cache for the tree model

let drift = { x: 0, z: 0 }; // Drift velocity
const driftDecay = 0.95; // Drift decay factor (closer to 1 = slower decay)

const loadedChunks = new Set(); // Keep track of already loaded chunks

let startingPosition = { latitude: 50.2093125, longitude: 15.8264718 }; // Default starting position

getUserPosition(startingPosition)
    .then(async (coords) => {
        startRendering(coords); // Start rendering after getting user position
    })
    .catch(async (error) => {
        console.error('Error getting user position:', error);
    });
    


// Load the "Low Poly Tree.glb" model once and store its reference
loadModel('/models/Low Poly Tree.glb', { x: 50, y: 0, z: 0 }, scene, (model) => {
    treeModel = model;
});

// Admin panel controls
const fovInput = document.getElementById('fov');
const posXInput = document.getElementById('posX');
const posYInput = document.getElementById('posY');
const posZInput = document.getElementById('posZ');
const rotXInput = document.getElementById('rotX');
const rotYInput = document.getElementById('rotY');
const rotZInput = document.getElementById('rotZ');
const lightXInput = document.getElementById('lightX');
const lightYInput = document.getElementById('lightY');
const lightZInput = document.getElementById('lightZ');

fovInput.addEventListener('input', () => {
    camera.fov = parseFloat(fovInput.value);
    camera.updateProjectionMatrix();
});

posXInput.addEventListener('input', () => {
    camera.position.x = parseFloat(posXInput.value);
});

posYInput.addEventListener('input', () => {
    camera.position.y = parseFloat(posYInput.value);
});

posZInput.addEventListener('input', () => {
    camera.position.z = parseFloat(posZInput.value);
});

rotXInput.addEventListener('input', () => {
    //camera.rotation.x = parseFloat(rotXInput.value) * (Math.PI / 180);
});

rotYInput.addEventListener('input', () => {
    camera.rotation.y = parseFloat(rotYInput.value) * (Math.PI / 180);
});

rotZInput.addEventListener('input', () => {
    camera.rotation.z = parseFloat(rotZInput.value) * (Math.PI / 180);
});

lightXInput.addEventListener('input', () => {
    directionalLight.position.x = parseFloat(lightXInput.value);
});

lightYInput.addEventListener('input', () => {
    directionalLight.position.y = parseFloat(lightYInput.value);
});

lightZInput.addEventListener('input', () => {
    directionalLight.position.z = parseFloat(lightZInput.value);
});

// User info panel elements
const addressInput = document.getElementById('address');
const fetchMapButton = document.getElementById('fetch-map');

// Load saved address from localStorage
const savedAddress = localStorage.getItem('address');
if (savedAddress) {
    addressInput.value = savedAddress;
}

fetchMapButton.addEventListener('click', async () => {
    const address = addressInput.value.trim();

    if (!address) {
        alert('Please enter a valid address.');
        return;
    }

    // Save the address to localStorage
    localStorage.setItem('address', address);

    console.log(`Fetching map data for Address: ${address}`);
    try {
        // Convert address to latitude and longitude using a geocoding API
        const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`);
        const geocodeData = await geocodeResponse.json();

        if (!geocodeData || geocodeData.length === 0) {
            alert('Address not found. Please try a different address.');
            return;
        }

        const latitude = parseFloat(geocodeData[0].lat);
        const longitude = parseFloat(geocodeData[0].lon);

        console.log(`Geocoded Address: Latitude ${latitude}, Longitude ${longitude}`);

        startRendering({ latitude, longitude }); // Start rendering with geocoded coordinates
    } catch (error) {
        console.error('Error fetching map data:', error);
    }
});


function getChunkCoordinates(position, chunkSize) {
    var chunkOffset = chunkSize / 2;
    const x = Math.floor((position.x + chunkOffset) / chunkSize);
    const z = Math.floor((position.z + chunkOffset) / chunkSize);
    return { x, z };
}

function checkAndLoadChunks(cameraPosition, chunkSize, scene, referencePoint) {
    const currentChunk = getChunkCoordinates(cameraPosition, chunkSize);
    console.log(`Current Chunk: X: ${currentChunk.x}, Z: ${currentChunk.z}`);

    // Load the current chunk if not already loaded
    const chunkKey = `${currentChunk.x},${currentChunk.z}`;
    if (!loadedChunks.has(chunkKey)) {
        loadedChunks.add(chunkKey);
        renderChunk(currentChunk.x, currentChunk.z, scene, chunkSize, referencePoint);
    }
}

function startRendering(coords) {
    clearScene(); // Clear the scene before rendering new chunks
    loadedChunks.clear(); // Clear loaded chunks
    startingPosition = coords; // Update starting position with geolocation data
    // Save geolocation data to localStorage
    localStorage.setItem('latitude', coords.latitude);
    localStorage.setItem('longitude', coords.longitude);

    try {
        clearScene();
        scene.add(ambientLight);
        renderer.setAnimationLoop(animate); // Ensure the animate function is called in a loop
        renderer.render(scene, camera);
    } catch (error) {
        console.error('Error fetching map data:', error);
    }
}

function loadModel(path, position, scene, callback) {
    const loader = new GLTFLoader();
    loader.load(
        path,
        (gltf) => {
            const model = gltf.scene;
            model.position.set(position.x, position.y, position.z);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true; // Enable shadows for model meshes
                    child.receiveShadow = true; // Enable receiving shadows
                }
            });
            if (path === '/models/Low Poly Tree.glb') {
                cachedTreeModel = model; // Cache the tree model
            }
            scene.add(model);
            console.log(`Model loaded from ${path}`);
            if (callback) callback(model);
        },
        undefined,
        (error) => {
            console.error(`Error loading model from ${path}:`, error);
        }
    );
}


function handleKeyDown(event) {
    if (event.key === 'w') controls.forward = true;
    if (event.key === 's') controls.backward = true;
    if (event.key === 'a') controls.left = true;
    if (event.key === 'd') controls.right = true;
}

function handleKeyUp(event) {
    if (event.key === 'w') controls.forward = false;
    if (event.key === 's') controls.backward = false;
    if (event.key === 'a') controls.left = false;
    if (event.key === 'd') controls.right = false;
}

function handleMouseDown(event) {
    controls.dragging = true;
    controls.dragStart.x = event.clientX;
    controls.dragStart.y = event.clientY;
    drift.x = 0; // Reset drift when dragging starts
    drift.z = 0;
}

function handleMouseMove(event) {
    if (controls.dragging) {
        // It will update the position of the camera, the rotation will be 45 in x and 45 in y
        const deltaX = event.clientX - controls.dragStart.x;
        const deltaY = event.clientY - controls.dragStart.y;
        camera.position.x -= deltaX * 0.07; // Adjust the multiplier for sensitivity
        camera.position.z -= deltaY * 0.07; // Adjust the multiplier for sensitivity
        //camera.rotation.x = controls.rotation.x;
        camera.rotation.y = controls.rotation.y;
        camera.rotation.z = controls.rotation.z;

        drift.x = deltaX * 0.07; // Update drift velocity
        drift.z = deltaY * 0.07;

        controls.dragStart.x = event.clientX; // Update drag start position
        controls.dragStart.y = event.clientY;
    }
}

function handleMouseUp() {
    controls.dragging = false;
}

function handleScroll(event) {
    const scrollSpeed = 1; // Adjust the multiplier for sensitivity
    camera.position.y -= event.deltaY * 0.03 * scrollSpeed; // Scroll up moves down, scroll down moves up
    camera.position.y = Math.max(5, camera.position.y); // Prevent the camera from going below ground level (minimum height is 5)

    // Adjust the camera's X rotation based on height
    const maxAngle = -Math.PI / 4; // Maximum downward angle (-45 degrees)
    const minAngle = 0; // Straight angle (0 degrees)
    const heightRange = 50; // Height range for smooth transition
    const normalizedHeight = Math.min(1, (camera.position.y - 5) / heightRange); // Normalize height between 0 and 1
    camera.rotation.x = minAngle + normalizedHeight * (maxAngle - minAngle); // Interpolate between minAngle and maxAngle
}


function updateCameraPosition() {
    const speed = 4; // Increased speed (4x faster)
    if (controls.forward) {
        camera.position.z -= Math.cos(controls.rotation.y) * speed;
        camera.position.x -= Math.sin(controls.rotation.y) * speed;
    }
    if (controls.backward) {
        camera.position.z += Math.cos(controls.rotation.y) * speed;
        camera.position.x += Math.sin(controls.rotation.y) * speed;
    }
    if (controls.left) {
        camera.position.x -= Math.cos(controls.rotation.y) * speed;
        camera.position.z += Math.sin(controls.rotation.y) * speed;
    }
    if (controls.right) {
        camera.position.x += Math.cos(controls.rotation.y) * speed;
        camera.position.z -= Math.sin(controls.rotation.y) * speed;
    }
    //camera.rotation.x = controls.rotation.x;
    camera.rotation.y = controls.rotation.y;
    camera.rotation.z = controls.rotation.z;
}

function applyDrift() {
    if (!controls.dragging) {
        camera.position.x -= drift.x;
        camera.position.z -= drift.z;

        drift.x *= driftDecay; // Apply decay to drift
        drift.z *= driftDecay;

        // Stop drift when it's very small
        if (Math.abs(drift.x) < 0.001) drift.x = 0;
        if (Math.abs(drift.z) < 0.001) drift.z = 0;
    }
}

function animate() {
    updateCameraPosition(); // Update the camera position based on controls
    applyDrift(); // Apply drift effect
    checkAndLoadChunks(camera.position, chunkSize, scene, startingPosition);
    renderer.render(scene, camera); // Render the scene
}


function clearScene() {
    while (scene.children.length > 1) { // Keep the large cube in the scene
        scene.remove(scene.children[1]);
    }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
window.addEventListener('wheel', handleScroll);
