import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cloudLoader = new GLTFLoader();
let cloudModel = null;

// Load the cloud model once
cloudLoader.load('/models/cloud.gltf', (gltf) => {
    cloudModel = gltf.scene;
    cloudModel.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff }); // Set clouds to white
        }
    });
    console.log('Cloud model loaded');
}, undefined, (error) => {
    console.error('Error loading cloud model:', error);
});

export function renderClouds(x, y, scene, chunkSize) {
    if (!cloudModel) {
        console.warn('Cloud model not loaded yet');
        return;
    }

    for (let i = 0; i < 30; i++) { // 100 clouds per chunk
        const cloud = cloudModel.clone();
        const randomX = x * chunkSize + Math.random() * chunkSize - chunkSize / 2;
        const randomZ = y * chunkSize + Math.random() * chunkSize - chunkSize / 2;
        // random scale from 5 to 10
        const randomScale = Math.random() * 5 + 5;

        cloud.position.set(randomX, 60, randomZ); // Set cloud position at height 60
        cloud.scale.set(randomScale, randomScale, randomScale); // Apply uniform scale
        cloud.traverse((child) => {
            child.castShadow = true; // Clouds do not cast shadows
            child.receiveShadow = true;
        });
        // random rotation
        cloud.rotation.x = Math.random() * Math.PI * 2;
        scene.add(cloud);
    }
}
