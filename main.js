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
    y: 100,
    z: 125
};

camera.position.z = cameraOffset.z; 
camera.position.y = cameraOffset.y; 
camera.position.x = cameraOffset.x; 

// Set fov
camera.fov = 40; // Set field of view to 40 degrees
camera.rotation.x = -Math.PI / 180 * 50; // Rotate camera 75 degrees downward

camera.updateProjectionMatrix(); // Ensure the projection matrix is updated

//TODO: Rework camera rotations

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increase ambient light intensity
scene.add(ambientLight);

// TODO: Reimplement directional light for large scene with many chunks
const directionalLight = new THREE.DirectionalLight(0xffffff, 4); // Increase directional light intensity
directionalLight.position.set(50, 50, 50); // Position the light
directionalLight.castShadow = true; // Enable shadows

// Configure shadow properties for the directional light
directionalLight.castShadow = true; // Ensure the light casts shadows
directionalLight.shadow.mapSize.width = 4096; // Increase shadow map resolution
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 1000; // Extend far plane for larger scenes
directionalLight.shadow.camera.left = -500; // Extend shadow camera bounds
directionalLight.shadow.camera.right = 500;
directionalLight.shadow.camera.top = 500;
directionalLight.shadow.camera.bottom = -500;

scene.add(directionalLight);

// Ensure shadows are enabled in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

largeCube.castShadow = true; // Example object casts shadows

let treeModel = null; // Reference to the tree model
let cachedTreeModel = null; // Cache for the tree model

let plane = null; // Reference to the plane model

let airplaneSpeed = 0; // Current speed of the airplane
const maxSpeed = 20; // Maximum speed
const minSpeed = 0.1; // Minimum speed
const acceleration = 0.5; // Acceleration rate
const deceleration = 0.3; // Deceleration rate
const rotationSpeed = Math.PI / 180 * 2; // Rotation speed (in radians)

// Load the airplane model and add it to the scene
loadModel('/models/Plane.glb', { x: 0, y: 20, z: 0 }, scene, (model) => {
    plane = model;
    plane.scale.set(1, 1, 1); // Scale the plane model
    console.log('Plane model added to the scene at (0, 20, 0)');
});

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
    var realPosition = cameraPosition.clone();
    realPosition.x -= cameraOffset.x; // Adjust for camera offset
    realPosition.y -= cameraOffset.y; // Adjust for camera offset 
    realPosition.z -= cameraOffset.z; // Adjust for camera offset
    const currentChunk = getChunkCoordinates(realPosition, chunkSize);
    console.log(`Current Chunk: X: ${currentChunk.x}, Z: ${currentChunk.z}`);

    // Load the current chunk if not already loaded
    const chunkKey = `${currentChunk.x},${currentChunk.z}`;

    // Find chunk that should be loaded (in view of the camera)


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

function updateAirplanePosition() {
    if (!plane) return;

    // Move the airplane forward based on its speed
    const direction = new THREE.Vector3();
    plane.getWorldDirection(direction);
    plane.position.addScaledVector(direction, airplaneSpeed);

    // Synchronize the camera's position with the airplane
    camera.position.set(
        cameraOffset.x + plane.position.x,
        cameraOffset.y + plane.position.y,
        cameraOffset.z + plane.position.z
    );
    camera.lookAt(plane.position);
}

function handleKeyDown(event) {
    if (event.key === 'Shift') airplaneSpeed = Math.min(airplaneSpeed + acceleration, maxSpeed); // Increase speed
    if (event.key === 'Control') airplaneSpeed = Math.max(airplaneSpeed - deceleration, minSpeed); // Decrease speed
    if (event.key === 'ArrowLeft') plane.rotation.y += rotationSpeed; // Yaw left
    if (event.key === 'ArrowRight') plane.rotation.y -= rotationSpeed; // Yaw right
    if (event.key === 'ArrowUp') plane.rotation.x = Math.max(plane.rotation.x - rotationSpeed, -Math.PI / 6); // Pitch up
    if (event.key === 'ArrowDown') plane.rotation.x = Math.min(plane.rotation.x + rotationSpeed, Math.PI / 6); // Pitch down
}

function handleKeyUp(event) {
    // No specific actions needed for key release in this implementation
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

    // update direct light position
    // update direction light left and right and up and down
    directionalLight.shadow.camera.left = camera.position.x - 400;
    directionalLight.shadow.camera.right = camera.position.x + 400;
    directionalLight.shadow.camera.top = camera.position.z + 400;
    directionalLight.shadow.camera.bottom = camera.position.z - 400;
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

function updatePlanePosition() {
    if (!plane) return;

    // Synchronize the plane's position with the camera
    plane.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
    plane.rotation.copy(camera.rotation); // Match the plane's rotation with the camera
}

// Function to dynamically update shadow camera bounds
function updateShadowCameraBounds() {
    const cameraPosition = camera.position;
    directionalLight.position.set(
        cameraPosition.x + 50,
        cameraPosition.y + 50,
        cameraPosition.z + 50
    );
    directionalLight.target.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    directionalLight.target.updateMatrixWorld(); // Ensure the target's matrix is updated
}

function animate() {
    updateAirplanePosition(); // Update the airplane's position and rotation
    applyDrift(); // Apply drift effect
    updateShadowCameraBounds(); // Dynamically update shadow camera bounds
    scene.add(directionalLight); // Add the directional light to the scene
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
