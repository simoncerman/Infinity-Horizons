import * as THREE from 'three';
import { getUserPosition } from './geolocation.js';
import { fetchMapData, renderRoads, renderBuildings, renderNaturals } from './mapApi.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1); // Set background color to white
document.body.appendChild(renderer.domElement);

camera.position.z = 125;
camera.position.y = 40;
camera.position.x = 0; // Set camera position
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

// Add a plane under the whole map
const planeGeometry = new THREE.PlaneGeometry(1000, 1000); // Large plane
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x8cc543, side: THREE.DoubleSide });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate to lie flat
plane.position.y = -0.2; // Position at ground level
scene.add(plane);

// Add lighting to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Strong directional light
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

// Enable shadows in the renderer
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows

// Update objects to cast and receive shadows
plane.receiveShadow = true; // Ground receives shadows
largeCube.castShadow = true; // Example object casts shadows
largeCube.receiveShadow = true; // Example object receives shadows

let treeModel = null; // Reference to the tree model
let cachedTreeModel = null; // Cache for the tree model

function clearScene() {
    while (scene.children.length > 1) { // Keep the large cube in the scene
        scene.remove(scene.children[1]);
    }
}

let drift = { x: 0, z: 0 }; // Drift velocity
const driftDecay = 0.95; // Drift decay factor (closer to 1 = slower decay)

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

window.addEventListener('wheel', handleScroll);

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
    renderer.render(scene, camera); // Render the scene
}
renderer.setAnimationLoop(animate); // Ensure the animate function is called in a loop

// Load saved geolocation data from localStorage
const savedLatitude = localStorage.getItem('latitude');
const savedLongitude = localStorage.getItem('longitude');
if (savedLatitude && savedLongitude) {
    console.log(`Loaded saved geolocation: Latitude ${savedLatitude}, Longitude ${savedLongitude}`);
}

getUserPosition()
    .then(async (coords) => {
        console.log(`User position: Latitude ${coords.latitude}, Longitude ${coords.longitude}`);

        // Save geolocation data to localStorage
        localStorage.setItem('latitude', coords.latitude);
        localStorage.setItem('longitude', coords.longitude);

        try {
            const width = 500; // Smaller width for visualization
            const height = 500; // Smaller height for visualization
            const mapData = await fetchMapData(coords.latitude, coords.longitude, width, height);

            // Clear the scene before rendering new data
            clearScene();
            scene.add(plane);

            // Render roads
            renderRoads(mapData.roads, coords, scene);

            // Render buildings
            renderBuildings(mapData.buildings, coords, scene);

            // Render naturals (trees)
            if (cachedTreeModel) {
                renderNaturals(mapData.naturals, coords, scene, cachedTreeModel);
            }

            scene.add(ambientLight);
            scene.add(directionalLight);

            // Refresh the view by rendering the scene
            renderer.render(scene, camera);

        } catch (error) {
            console.error('Error fetching map data:', error);
        }
    })
    .catch(async (error) => {
        console.error('Error getting user position:', error);

        // Fallback to saved address if geolocation fails
        const savedAddress = localStorage.getItem('address');
        if (savedAddress) {
            console.log(`Using saved address: ${savedAddress}`);
            try {
                const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(savedAddress)}&format=json`);
                const geocodeData = await geocodeResponse.json();

                if (!geocodeData || geocodeData.length === 0) {
                    console.error('Saved address not found. Please update the address.');
                    return;
                }

                const latitude = parseFloat(geocodeData[0].lat);
                const longitude = parseFloat(geocodeData[0].lon);

                console.log(`Geocoded Address: Latitude ${latitude}, Longitude ${longitude}`);

                const width = 500; // Smaller width for visualization
                const height = 500; // Smaller height for visualization
                const mapData = await fetchMapData(latitude, longitude, width, height);

                // Clear the scene before rendering new data
                clearScene();
                scene.add(plane);

                // Render roads
                renderRoads(mapData.roads, { latitude, longitude }, scene);

                // Render buildings
                renderBuildings(mapData.buildings, { latitude, longitude }, scene);

                // Render naturals (trees)
                if (cachedTreeModel) {
                    renderNaturals(mapData.naturals, { latitude, longitude }, scene, cachedTreeModel);
                }

                scene.add(ambientLight);
                scene.add(directionalLight);

                // Refresh the view by rendering the scene
                renderer.render(scene, camera);
            } catch (geocodeError) {
                console.error('Error using saved address:', geocodeError);
            }
        } else {
            console.error('No saved address available. Please provide an address.');
        }
    });

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
}); // Add the missing closing parenthesis here

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

        const width = 500; // Smaller width for visualization
        const height = 500; // Smaller height for visualization
        const mapData = await fetchMapData(latitude, longitude, width, height);

        // Clear the scene before rendering new data
        clearScene();
        scene.add(plane);

        // Render roads
        renderRoads(mapData.roads, { latitude, longitude }, scene);

        // Render buildings
        renderBuildings(mapData.buildings, { latitude, longitude }, scene);

        // Render naturals (trees)
        if (cachedTreeModel) {
            renderNaturals(mapData.naturals, { latitude, longitude }, scene, cachedTreeModel);
        }

        scene.add(ambientLight);
        scene.add(directionalLight);

        // Refresh the view by rendering the scene
        renderer.render(scene, camera);
    } catch (error) {
        console.error('Error fetching map data:', error);
    }
});

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);