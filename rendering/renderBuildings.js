import * as THREE from 'three';

export function renderBuildings(buildings, coords, scene, offset) {
    const offsetX = offset.offsetX;
    const offsetY = offset.offsetY;

    // Count the total number of building segments
    let instanceCount = 0;
    buildings.forEach(building => {
        instanceCount += building.vertices.length - 1;
    });

    // Create a single instanced mesh for all buildings
    const buildingGeometry = new THREE.BoxGeometry(1, 1, 1); // Base geometry
    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xd7d1c5 });
    const instancedMesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, instanceCount);

    let instanceIndex = 0;
    buildings.forEach(building => {
        const vertices = building.vertices;
        const tags = building.tags;

        let height = parseFloat(tags['building:levels'] || 1) * 3; // Default height is 3 meters per level
        if (tags.building === 'house') {
            height = 5; // Default height for houses
        }

        for (let i = 0; i < vertices.length - 1; i++) {
            const start = vertices[i];
            const end = vertices[i + 1];

            const startX = ((start.x - coords.longitude) * 111320) + offsetX;
            const startZ = -((start.z - coords.latitude) * 111320) + offsetY;
            const endX = ((end.x - coords.longitude) * 111320) + offsetX;
            const endZ = -((end.z - coords.latitude) * 111320) + offsetY;

            const dx = endX - startX;
            const dz = endZ - startZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            // Create a transformation matrix for each building segment
            const matrix = new THREE.Matrix4();
            matrix.compose(
                new THREE.Vector3((startX + endX) / 2, height / 2, (startZ + endZ) / 2), // Position
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx)), // Rotation
                new THREE.Vector3(length + 1, height, 1) // Scale
            );

            instancedMesh.setMatrixAt(instanceIndex++, matrix);
        }
    });

    instancedMesh.castShadow = true; // Enable shadows for the instanced mesh
    instancedMesh.receiveShadow = true; // Buildings do not need to receive shadows
    scene.add(instancedMesh);
}