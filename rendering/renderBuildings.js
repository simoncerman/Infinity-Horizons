import * as THREE from 'three';

export function renderBuildings(buildings, coords, scene, offset) {
    const offsetX = offset.offsetX;
    const offsetY = offset.offsetY;
    buildings.forEach(building => {
        const vertices = building.vertices;
        const tags = building.tags;

        let color = 0xd7d1c5; // Updated default building color
        let height = parseFloat(tags['building:levels'] || 1) * 3; // Default height is 3 meters per level

        if (tags.building === 'house') {
            color = 0xd7d1c5; // Updated color for houses
            height = 5; // Default height for houses
        }

        for (let i = 0; i < vertices.length - 1; i++) {
            const start = vertices[i];
            const end = vertices[i + 1];

            const startX = ((start.x - coords.longitude) * 111320) + offsetX; // Apply offsetX
            const startZ = -((start.z - coords.latitude) * 111320) + offsetY; // Apply offsetY
            const endX = ((end.x - coords.longitude) * 111320) + offsetX;     // Apply offsetX
            const endZ = -((end.z - coords.latitude) * 111320) + offsetY;     // Apply offsetY

            const dx = endX - startX;
            const dz = endZ - startZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            const buildingGeometry = new THREE.BoxGeometry(length + 1, height, 1);
            const buildingMaterial = new THREE.MeshStandardMaterial({ color: color });
            const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);

            // Enable shadows for buildings
            buildingMesh.castShadow = true;
            buildingMesh.receiveShadow = true;

            buildingMesh.position.set(
                (startX + endX) / 2,
                height / 2,
                (startZ + endZ) / 2
            );

            const angle = Math.atan2(dz, dx);
            buildingMesh.rotation.y = -angle;

            scene.add(buildingMesh);
        }
    });
}