import * as THREE from 'three';
import { getUserPosition } from './geolocation.js';
import { fetchMapData, renderAll } from './mapApi.js';
import { renderChunk } from './rendering/renderChunk.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Camera } from './classes/Camera.js';
import { DirectLight } from './classes/DirectLight.js';
import { Airplane } from './classes/Airplane.js';

const chunkSize = 1000; // Size of each chunk in meters

let scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1); // Set background color to white
renderer.shadowMap.enabled = true; // Enable shadows in the renderer
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
document.body.appendChild(renderer.domElement);

let camera = new Camera(
    new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
);
let cameraOffset = camera.getCameraOffset(); // Get the camera offset

const largeCubeGeometry = new THREE.BoxGeometry(10, 10, 10); // Large cube dimensions
const largeCubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for the large cube
const largeCube = new THREE.Mesh(largeCubeGeometry, largeCubeMaterial);
largeCube.position.set(0, 0, 0); // Set large cube to the center of the scene
largeCube.castShadow = true; // Example object casts shadows
scene.add(largeCube);

// Add lighting to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increase ambient light intensity
scene.add(ambientLight);
let directionalLight = new DirectLight().getLight(); // Create a new instance of DirectLight
scene.add(directionalLight);

// Ensure shadows are enabled in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

let flyingObject = null; // Reference to the plane model

let planeModel = null; // Reference to the planeModel model

const loadedChunks = new Set(); // Keep track of already loaded chunks
let startingPosition = { latitude: 50.2093125, longitude: 15.8264718 }; // Default starting position

(async () => {
    planeModel = await loadModelSync('/models/Plane.glb', { x: 0, y: 20, z: 0 }, scene);
    planeModel.scale.set(1, 1, 1); // Scale the plane model

    let airPlane = new Airplane(planeModel);

    let helicopter = null; // Reference to the helicopter model

    flyingObject = airPlane;

    let drift = { x: 0, z: 0 }; // Drift velocity
    const driftDecay = 0.95; // Drift decay factor (closer to 1 = slower decay)

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
let useGPS = true; // Default to GPS

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

document.getElementById('play-button').addEventListener('click', async () => {
    console.log('Play button clicked');
    const welcomeScreen = document.getElementById('welcome-screen');
    let coords;

    loadingScreen.classList.add('visible'); // Show loading screen

    if (useGPS) {
        try {
            coords = await getUserPosition(startingPosition);
        } catch (error) {
            console.error('Error getting GPS location:', error);
            alert('Failed to get GPS location. Please try again.');
            loadingScreen.classList.remove('visible'); // Hide loading screen
            return;
        }
    } else {
        const address = addressInput.value.trim();
        if (!address) {
            alert('Please enter a valid address.');
            loadingScreen.classList.remove('visible'); // Hide loading screen
            return;
        }

        try {
            const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`);
            const geocodeData = await geocodeResponse.json();

            if (!geocodeData || geocodeData.length === 0) {
                alert('Address not found. Please try a different address.');
                loadingScreen.classList.remove('visible'); // Hide loading screen
                return;
            }

            coords = {
                latitude: parseFloat(geocodeData[0].lat),
                longitude: parseFloat(geocodeData[0].lon)
            };
        } catch (error) {
            console.error('Error fetching map data:', error);
            alert('Failed to fetch address coordinates. Please try again.');
            loadingScreen.classList.remove('visible'); // Hide loading screen
            return;
        }
    }

    welcomeScreen.classList.add('hidden'); // Add the hidden class to trigger fade-out
    setTimeout(() => {
        welcomeScreen.style.display = 'none'; // Remove the welcome screen after animation
        scene = new THREE.Scene(); // Clear the scene
        startRendering(coords); // Start the game with the selected coordinates
        loadingScreen.classList.remove('visible'); // Hide loading screen
    }, 1000); // Match the duration of the fade-out animation
});

document.getElementById('fetch-map').addEventListener('click', async () => {
    console.log('Fetch button clicked');
    let coords;

    loadingScreen.classList.add('visible'); // Show loading screen

    const address = document.getElementById('address').value.trim();
    if (!address) {
        alert('Please enter a valid address.');
        loadingScreen.classList.remove('visible'); // Hide loading screen
        return;
    }

    try {
        const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`);
        const geocodeData = await geocodeResponse.json();

        if (!geocodeData || geocodeData.length === 0) {
            alert('Address not found. Please try a different address.');
            loadingScreen.classList.remove('visible'); // Hide loading screen
            return;
        }

        coords = {
            latitude: parseFloat(geocodeData[0].lat),
            longitude: parseFloat(geocodeData[0].lon)
        };
    } catch (error) {
        console.error('Error fetching map data:', error);
        alert('Failed to fetch address coordinates. Please try again.');
        loadingScreen.classList.remove('visible'); // Hide loading screen
        return;
    }

    // Reset the plane's position
    if (flyingObject) {
        flyingObject.getModel().position.set(0, 20, 0); // Reset to initial position
        flyingObject.pitch = 0;
        flyingObject.yaw = 0;
        flyingObject.roll = 0;
        flyingObject.speed = 0;
    }

    // Clear the current scene and start rendering with new coordinates
    scene = new THREE.Scene(); // Clear the scene
    startRendering(coords); // Start rendering with new coordinates
    loadingScreen.classList.remove('visible'); // Hide loading screen
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
    // If i get to border of chunk, load the next chunk. If i will be like 200 meters from the border, load the next chunk (use realPosition)
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
    // Load the current chunk if not already loaded
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
        renderer.render(scene, camera.getCamera()); // Initial render
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

// Enable frustum culling for all objects in the scene
scene.traverse((object) => {
    if (object.isMesh) {
        object.frustumCulled = true; // Skip rendering objects outside the camera's view
    }
});

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

function handleMouseDown(event) {
    // controls.dragging = true;
    // controls.dragStart.x = event.clientX;
    // controls.dragStart.y = event.clientY;
    // drift.x = 0; // Reset drift when dragging starts
    // drift.z = 0;
}

function handleMouseMove(event) {
    // if (controls.dragging) {
    //     // It will update the position of the camera, the rotation will be 45 in x and 45 in y
    //     const deltaX = event.clientX - controls.dragStart.x;
    //     const deltaY = event.clientY - controls.dragStart.y;
    //     camera.position.x -= deltaX * 0.07; // Adjust the multiplier for sensitivity
    //     camera.position.z -= deltaY * 0.07; // Adjust the multiplier for sensitivity
    //     //camera.rotation.x = controls.rotation.x;
    //     camera.rotation.y = controls.rotation.y;
    //     camera.rotation.z = controls.rotation.z;

    //     drift.x = deltaX * 0.07; // Update drift velocity
    //     drift.z = deltaY * 0.07;

    //     controls.dragStart.x = event.clientX; // Update drag start position
    //     controls.dragStart.y = event.clientY;
    // }
}

function handleMouseUp() {}

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
    // if (!controls.dragging) {
    //     camera.position.x -= drift.x;
    //     camera.position.z -= drift.z;

    //     drift.x *= driftDecay; // Apply decay to drift
    //     drift.z *= driftDecay;

    //     // Stop drift when it's very small
    //     if (Math.abs(drift.x) < 0.001) drift.x = 0;
    //     if (Math.abs(drift.z) < 0.001) drift.z = 0;
    // }
}

function updatePlanePosition() {
    if (!plane) return;

    // Synchronize the plane's position with the camera
    plane.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
    plane.rotation.copy(camera.rotation); // Match the plane's rotation with the camera
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

function animate() {
    updateAirplanePosition(); // Update the airplane's position and rotation
    updateSpeedIndicator(); // Update the speed indicator
    applyDrift(); // Apply drift effect
    updateShadowCameraBounds(); // Dynamically update shadow camera bounds
    scene.add(directionalLight); // Add the directional light to the scene
    checkAndLoadChunks(camera.getCamera().position, chunkSize, scene, startingPosition);
    renderer.render(scene, camera.getCamera()); // Render the scene
}

function clearScene() {
    while (scene.children.length > 1) {
        scene.remove(scene.children[1]);
    }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
window.addEventListener('wheel', handleScroll);
