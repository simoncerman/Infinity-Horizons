import * as THREE from 'three';
import { fetchMapData,renderAll } from '/mapApi.js';


export function renderChunk(x, y, scene, chunkSize, referencePoint) {
    // render ground
    const ground = renderGround(x, y, chunkSize);
    scene.add(ground);

    // calculate the lat and lon based on reference point
    const latOffset = (y * chunkSize) / 111320; // Approx. meters per degree latitude
    const lonOffset = (x * chunkSize) / 111320; // Adjust for longitude
    const latitude = referencePoint.latitude - latOffset;
    const longitude = referencePoint.longitude + lonOffset;

    fetchMapData(latitude, longitude, chunkSize, chunkSize).then(data => {
        console.log(data);
        // For latitude and longitude, we need to convert them to meters - different for each axis

        const offsetX = x * chunkSize; // Convert longitude to meters
        const offsetY = y * chunkSize; // Convert latitude to meters and invert z-axis

        renderAll(data, {latitude: latitude, longitude: longitude}, scene, {offsetX: offsetX, offsetY: offsetY});        
    });
}


function renderGround(x, y, chunkSize) {
    // Add a plane under the whole map
    const planeGeometry = new THREE.PlaneGeometry(chunkSize, chunkSize); // Large plane
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x8ec844 }); // Light green color
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2; // Rotate to lie flat
    plane.position.y = -0.2; // Position at ground level

    // set x and z
    plane.position.x = (x * chunkSize);
    plane.position.z = (y * chunkSize);

    plane.receiveShadow = true; // Ensure the ground receives shadows
    return plane;
}