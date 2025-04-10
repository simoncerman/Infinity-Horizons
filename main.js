import * as THREE from 'three';
import { getUserPosition } from './geolocation.js';
import { fetchMapData, renderRoads, renderBuildings } from './mapApi.js';
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

// Add lighting to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light


const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Strong directional light
directionalLight.position.set(50, 100, 50); // Position the light

let treeModel = null; // Reference to the tree model
let cachedTreeModel = null; // Cache for the tree model

function clearScene() {
    while (scene.children.length > 1) { // Keep the large cube in the scene
        scene.remove(scene.children[1]);
    }
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
}

function handleMouseMove(event) {
    if (controls.dragging) {
        // It will update the position of the camera, the rotation will be 45 in x and 45 in y
        const deltaX = event.clientX - controls.dragStart.x;
        const deltaY = event.clientY - controls.dragStart.y;
        camera.position.x -= deltaX * 0.01; // Adjust the multiplier for sensitivity
        camera.position.z -= deltaY * 0.01; // Adjust the multiplier for sensitivity
        camera.rotation.x = controls.rotation.x;
        camera.rotation.y = controls.rotation.y;
        camera.rotation.z = controls.rotation.z;
    }
}

function handleMouseUp() {
    controls.dragging = false;
}

function updateCameraPosition() {
    const speed = 0.5;
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
    camera.rotation.x = controls.rotation.x;
    camera.rotation.y = controls.rotation.y;
    camera.rotation.z = controls.rotation.z;
}

function animate() {
    updateCameraPosition(); // Update the camera position based on controls
    renderer.render(scene, camera); // Render the scene
}
renderer.setAnimationLoop(animate); // Ensure the animate function is called in a loop

getUserPosition()
    .then(async (coords) => {
        console.log(`User position: Latitude ${coords.latitude}, Longitude ${coords.longitude}`);
        try {
            
            const width = 500; // Smaller width for visualization
            const height = 500; // Smaller height for visualization
            const mapData = await fetchMapData(coords.latitude, coords.longitude, width, height);

            // Clear the scene before rendering new data
            clearScene();

            // Render roads
            renderRoads(mapData.roads, coords, scene);

            // Render buildings
            renderBuildings(mapData.buildings, coords, scene);

            // Re-add the cached tree model
            if (cachedTreeModel) {
                const treeClone = cachedTreeModel.clone(); // Clone the cached tree model
                treeClone.position.set(50, 0, 0); // Set its position
                scene.add(treeClone);
            }

            scene.add(ambientLight);
            scene.add(directionalLight);

            // Refresh the view by rendering the scene
            renderer.render(scene, camera);

        } catch (error) {
            console.error('Error fetching map data:', error);
        }
    })
    .catch((error) => {
        console.error('Error getting user position:', error);
    });

function loadModel(path, position, scene, callback) {
    const loader = new GLTFLoader();
    loader.load(
        path,
        (gltf) => {
            const model = gltf.scene;
            model.position.set(position.x, position.y, position.z);
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
    camera.rotation.x = parseFloat(rotXInput.value) * (Math.PI / 180);
});

rotYInput.addEventListener('input', () => {
    camera.rotation.y = parseFloat(rotYInput.value) * (Math.PI / 180);
});

rotZInput.addEventListener('input', () => {
    camera.rotation.z = parseFloat(rotZInput.value) * (Math.PI / 180);
}); // Add the missing closing parenthesis here

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);