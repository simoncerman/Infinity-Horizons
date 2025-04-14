import * as THREE from 'three';

export function renderWaterways(waterways, coords, scene) {
    waterways.forEach(waterway => {
        const points = waterway.path.map(vertex => new THREE.Vector3(
            (vertex.x - coords.longitude) * 111320, // Convert longitude to meters
            0,                                     // Place waterway at ground level
            -(vertex.z - coords.latitude) * 111320 // Convert latitude to meters and invert z-axis
        ));

        // Create a smooth curve using CatmullRomCurve3
        const curve = new THREE.CatmullRomCurve3(points);

        // Define the waterway cross-section shape
        const waterwayShape = new THREE.Shape();
        const halfWidth = 2; // Default width for waterways
        waterwayShape.moveTo(0, -halfWidth);
        waterwayShape.lineTo(0, halfWidth);
        waterwayShape.closePath();

        // Create ExtrudeGeometry to extrude the waterway shape along the curve
        const extrudeSettings = {
            steps: 100,
            bevelEnabled: false,
            extrudePath: curve
        };
        const waterwayGeometry = new THREE.ExtrudeGeometry(waterwayShape, extrudeSettings);
        const waterwayMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue color for waterways
        const waterwayMesh = new THREE.Mesh(waterwayGeometry, waterwayMaterial);

        // Enable shadows for waterways
        waterwayMesh.castShadow = false;
        waterwayMesh.receiveShadow = true;

        waterwayMesh.position.set(0, 0.01, 0); // Slightly above ground level
        scene.add(waterwayMesh);
    });
}
