import * as THREE from 'three';
import { getUserPosition } from './geolocation.js';
import { renderChunk } from './rendering/renderChunk.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Camera } from './classes/Camera.js';
import { DirectLight } from './classes/DirectLight.js';
import { Airplane } from './classes/Airplane.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

import * as dat from 'dat.gui';

const chunkSize = 1000; // Size of each chunk in meters
let startingPosition = { latitude: 50.2093125, longitude: 15.8264718 }; // Default starting position if no GPS and no address is provided
let useGPS = true; // Default to GPS

let scene = new THREE.Scene();
const loadedChunks = new Set(); // Keep track of already loaded chunks

// Setup renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1); // Set background color to white
renderer.shadowMap.enabled = true; // Enable shadows in the renderer
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
document.body.appendChild(renderer.domElement);

// Camera
let camera = new Camera(
    new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
);
let cameraOffset = camera.getCameraOffset(); // Get the camera offset

/// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Increase intensity to 1.0
scene.add(ambientLight);

let directionalLight = new DirectLight().getLight();
directionalLight.intensity = 4; // Increase intensity to 2.0
scene.add(directionalLight);

let flyingObject = null; // Reference to the plane model
let planeModel = null; // Reference to the planeModel model
let helicopterModel = null; // Reference to the helicopter model

let composer; // Declare composer globally
let horizontalTiltShiftPass, verticalTiltShiftPass; // Declare passes globally

function addTiltShiftEffect() {
    composer = new EffectComposer(renderer); // Initialize composer globally
    
    const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);  
    composer.addPass(gammaCorrectionPass); // Add gamma correction pass
    const renderPass = new RenderPass(scene, camera.getCamera());
    composer.addPass(renderPass);

    // Horizontal tilt-shift pass
    horizontalTiltShiftPass = new ShaderPass(HorizontalTiltShiftShader);
    horizontalTiltShiftPass.uniforms.h.value = 0.003; // Set horizontal blur strength
    horizontalTiltShiftPass.uniforms.r.value = 0.55; // Set focus area
    composer.addPass(horizontalTiltShiftPass);

    // Vertical tilt-shift pass
    verticalTiltShiftPass = new ShaderPass(VerticalTiltShiftShader);
    verticalTiltShiftPass.uniforms.v.value = 0.003; // Set vertical blur strength
    verticalTiltShiftPass.uniforms.r.value = 0.55; // Set focus area
    composer.addPass(verticalTiltShiftPass);

    setupTiltShiftGUI(); // Add GUI controls for real-time adjustments
}

function setupTiltShiftGUI() {
    const gui = new dat.GUI();
    const tiltShiftParams = {
        horizontalBlur: horizontalTiltShiftPass.uniforms.h.value,
        verticalBlur: verticalTiltShiftPass.uniforms.v.value,
        focusArea: horizontalTiltShiftPass.uniforms.r.value,
    };

    gui.add(tiltShiftParams, 'horizontalBlur', 0.0, 0.01).onChange((value) => {
        horizontalTiltShiftPass.uniforms.h.value = value;
    });
    gui.add(tiltShiftParams, 'verticalBlur', 0.0, 0.01).onChange((value) => {
        verticalTiltShiftPass.uniforms.v.value = value;
    });
    gui.add(tiltShiftParams, 'focusArea', 0.0, 1.0).onChange((value) => {
        horizontalTiltShiftPass.uniforms.r.value = value;
        verticalTiltShiftPass.uniforms.r.value = value;
    });
}

(async () => {
    planeModel = await loadModelSync('/models/Plane.glb', { x: 0, y: 20, z: 0 }, scene);
    planeModel.scale.set(1, 1, 1); // Scale the plane model

    // Load the helicopter model
    //TODO: Load the helicopter model


    let airPlane = new Airplane(planeModel);
    let helicopter = null; // Reference to the helicopter model

    // select the model depending on the user choice
    flyingObject = airPlane;

    getUserPosition(startingPosition)
        .then(async (coords) => {
            startRendering(coords); // Start rendering after getting user position
        })
        .catch(async (error) => {
            console.error('Error getting user position:', error);
        });
})();

// User info panel elements
const gpsIcon = document.getElementById('gps-icon');
const addressInput = document.getElementById('address-input');

addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('play-button').click();
    }
});

gpsIcon.addEventListener('click', () => {
    useGPS = true;
    addressInput.value = ''; // Clear address input
    gpsIcon.style.background = 'white';
    gpsIcon.style.color = 'black';
    addressInput.style.background = 'transparent';
    addressInput.style.color = 'white';
});

addressInput.addEventListener('focus', () => {
    useGPS = false;
    gpsIcon.style.background = 'transparent';
    gpsIcon.style.color = 'white';
    addressInput.style.background = 'white';
    addressInput.style.color = 'black';
});

const loadingScreen = document.getElementById('loading-screen');

async function getCoordinates(useGPS, addressInput, startingPosition) {
    if (useGPS) {
        try {
            return await getUserPosition(startingPosition);
        } catch (error) {
            console.error('Error getting GPS location:', error);
            alert('Failed to get GPS location. Please try again.');
            throw error;
        }
    } else {
        const address = addressInput.value.trim();
        if (!address) {
            alert('Please enter a valid address.');
            throw new Error('Invalid address');
        }

        try {
            const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`);
            const geocodeData = await geocodeResponse.json();

            if (!geocodeData || geocodeData.length === 0) {
                alert('Address not found. Please try a different address.');
                throw new Error('Address not found');
            }

            return {
                latitude: parseFloat(geocodeData[0].lat),
                longitude: parseFloat(geocodeData[0].lon)
            };
        } catch (error) {
            console.error('Error fetching map data:', error);
            alert('Failed to fetch address coordinates. Please try again.');
            throw error;
        }
    }
}

document.getElementById('play-button').addEventListener('click', async () => {
    console.log('Play button clicked');
    const welcomeScreen = document.getElementById('welcome-screen');
    loadingScreen.classList.add('visible'); // Show loading screen

    try {
        const coords = await getCoordinates(useGPS, addressInput, startingPosition);

        welcomeScreen.classList.add('hidden'); // Add the hidden class to trigger fade-out
        setTimeout(() => {
            welcomeScreen.style.display = 'none'; // Remove the welcome screen after animation
            scene = new THREE.Scene(); // Clear the scene
            startRendering(coords); // Start the game with the selected coordinates
            loadingScreen.classList.remove('visible'); // Hide loading screen
        }, 1000); // Match the duration of the fade-out animation
    } catch {
        loadingScreen.classList.remove('visible'); // Hide loading screen on error
    }
});

document.getElementById('fetch-map').addEventListener('click', async () => {
    console.log('Fetch button clicked');
    loadingScreen.classList.add('visible'); // Show loading screen

    try {
        const coords = await getCoordinates(false, document.getElementById('address'), startingPosition);

        if (flyingObject) flyingObject.reset(); // Reset the airplane's position
        scene = new THREE.Scene(); // Clear the scene
        
        startRendering(coords); // Start rendering with new coordinates
        loadingScreen.classList.remove('visible'); // Hide loading screen
    } catch {
        loadingScreen.classList.remove('visible'); // Hide loading screen on error
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

    if (!loadedChunks.has(chunkKey)) {
        loadedChunks.add(chunkKey);
        renderChunk(currentChunk.x, currentChunk.z, scene, chunkSize, referencePoint);
    }
    // If i get to border of chunk, load the next chunk. If i will be like 1/2 chunk from the border, load the next chunk (use realPosition)
    if (Math.abs(realPosition.x - currentChunk.x * chunkSize) < chunkSize / 2) {
        const nextChunkX = currentChunk.x + (realPosition.x > currentChunk.x * chunkSize ? 1 : -1);
        const nextChunkKeyX = `${nextChunkX},${currentChunk.z}`;
        if (!loadedChunks.has(nextChunkKeyX)) {
            loadedChunks.add(nextChunkKeyX);
            renderChunk(nextChunkX, currentChunk.z, scene, chunkSize, referencePoint);
        }
    }
    if (Math.abs(realPosition.z - currentChunk.z * chunkSize) < chunkSize / 2) {
        const nextChunkZ = currentChunk.z + (realPosition.z > currentChunk.z * chunkSize ? 1 : -1);
        const nextChunkKeyZ = `${currentChunk.x},${nextChunkZ}`;
        if (!loadedChunks.has(nextChunkKeyZ)) {
            loadedChunks.add(nextChunkKeyZ);
            renderChunk(currentChunk.x, nextChunkZ, scene, chunkSize, referencePoint);
        }
    }
}

function startRendering(coords) {
    clearScene(); // Clear the scene before rendering new chunks
    loadedChunks.clear(); // Clear loaded chunks
    startingPosition = coords; // Update starting position with geolocation data

    // Save geolocation data to localStorage
    localStorage.setItem('latitude', coords.latitude);
    localStorage.setItem('longitude', coords.longitude);

    const { tiltedView } = loadSettings(); // Check if Tilted View is enabled
    if (tiltedView) {
        addTiltShiftEffect(); // Add tilt-shift effect
    } else {
        composer = null; // Ensure composer is not used
    }

    try {
        scene.add(ambientLight);
        renderer.setAnimationLoop(animate); // Ensure the animate function is called in a loop
    } catch (error) {
        console.error('Error fetching map data:', error);
    }
}

async function loadModelSync(path, position, scene) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
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
                scene.add(model);
                console.log(`Model loaded from ${path}`);
                resolve(model);
            },
            undefined,
            (error) => {
                console.error(`Error loading model from ${path}:`, error);
                reject(error);
            }
        );
    });
}

function updateAirplanePosition() {
    if (!flyingObject) return;

    flyingObject.update();
    scene.add(flyingObject.getModel()); // Add the airplane model to the scene

    // Synchronize the camera's position with the airplane
    camera.getCamera().position.set(
        cameraOffset.x + flyingObject.getPosX(),
        cameraOffset.y + flyingObject.getPosY(),
        cameraOffset.z + flyingObject.getPosZ()
    );
    camera.getCamera().lookAt(flyingObject.getPos());
}

function updateSpeedIndicator() {
    if (!flyingObject) return;

    const speedBar = document.getElementById('speed-bar');
    const speedText = document.getElementById('speed-text');
    const speedPercentage = (flyingObject.speed / flyingObject.maxSpeed) * 100; // Calculate percentage

    speedBar.style.height = `${speedPercentage}%`; // Update bar height
    speedText.textContent = flyingObject.speed.toFixed(1); // Display speed with one decimal
}

function handleKeyDown(event) {
    // Arrow down is pitchDown true, Arrow up is pitchUp true. W is trust true, S is reverseTrust true, Q is yawRight true, E is yawLeft true, Rightarrow is rollRight true, LeftArrow is rollLeft true
    if (event.key === 'ArrowDown') flyingObject.isPitchDown = true;
    if (event.key === 'ArrowUp') flyingObject.isPitchUp = true;
    if (event.key === 'w') flyingObject.isTrust = true;
    if (event.key === 's') flyingObject.isReverseTrust = true;
    if (event.key === 'q') flyingObject.isYawLeft = true;
    if (event.key === 'e') flyingObject.isYawRight = true;
    if (event.key === 'ArrowRight') flyingObject.isRollRight = true;
    if (event.key === 'ArrowLeft') flyingObject.isRollLeft = true;
}

function handleKeyUp(event) {
    // Arrow down is pitchDown false, Arrow up is pitchUp false. W is trust false, S is reverseTrust false, Q is yawRight false, E is yawLeft false, RightArrow is rollRight false, LeftArrow is rollLeft false
    if (event.key === 'ArrowDown') flyingObject.isPitchDown = false;
    if (event.key === 'ArrowUp') flyingObject.isPitchUp = false;
    if (event.key === 'w') flyingObject.isTrust = false;
    if (event.key === 's') flyingObject.isReverseTrust = false;
    if (event.key === 'q') flyingObject.isYawLeft = false;
    if (event.key === 'e') flyingObject.isYawRight = false;
    if (event.key === 'ArrowRight') flyingObject.isRollRight = false;
    if (event.key === 'ArrowLeft') flyingObject.isRollLeft = false;
}

// Function to dynamically update shadow camera bounds
function updateShadowCameraBounds() {
    const cameraPosition = camera.getCamera().position;
    directionalLight.position.set(
        cameraPosition.x + 50,
        cameraPosition.y + 50,
        cameraPosition.z + 50
    );
    directionalLight.target.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    directionalLight.target.updateMatrixWorld(); // Ensure the target's matrix is updated
}

// Settings modal logic
const settingsIcon = document.getElementById('settings-icon');
const settingsModal = document.getElementById('settings-modal');
const tiltedViewCheckbox = document.getElementById('tilted-view-checkbox');
const saveSettingsButton = document.getElementById('save-settings');

// Load settings from localStorage
function loadSettings() {
    const tiltedView = localStorage.getItem('tiltedView') === 'true';
    tiltedViewCheckbox.checked = tiltedView;
    return { tiltedView };
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('tiltedView', tiltedViewCheckbox.checked);
    settingsModal.style.display = 'none';
    applySettings();
}

// Apply settings
function applySettings() {
    const { tiltedView } = loadSettings();
    if (tiltedView) {
        camera.getCamera().rotation.x = -Math.PI / 180 * 75; // Apply tilted view
    } else {
        camera.getCamera().rotation.x = -Math.PI / 180 * 50; // Default view
    }
    camera.getCamera().updateProjectionMatrix();
}

// Event listeners for settings
settingsIcon.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});
saveSettingsButton.addEventListener('click', saveSettings);

// Apply settings on load
applySettings();

function animate() {
    // Enable frustum culling for all objects in the scene
    scene.traverse((object) => {
        if (object.isMesh) {
            object.frustumCulled = true; // Skip rendering objects outside the camera's view
        }
    });
    updateAirplanePosition(); // Update the airplane's position and rotation
    updateSpeedIndicator(); // Update the speed indicator
    updateShadowCameraBounds(); // Dynamically update shadow camera bounds
    scene.add(directionalLight); // Add the directional light to the scene
    checkAndLoadChunks(camera.getCamera().position, chunkSize, scene, startingPosition);

    if (composer) {
        composer.render(); // Use composer to render with tilt-shift effect
    } else {
        renderer.render(scene, camera.getCamera()); // Classic render without effects
    }
}

function clearScene() {
    while (scene.children.length > 1) {
        scene.remove(scene.children[1]);
    }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
