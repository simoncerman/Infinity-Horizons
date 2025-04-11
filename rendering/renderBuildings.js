import * as THREE from 'three';

export function renderBuildings(buildings, coords, scene) {
    buildings.forEach(building => {
        const vertices = building.vertices;
        const tags = building.tags;

        let color = 0x808080;
        let height = parseFloat(tags['building:levels'] || 1) * 3; // Default height is 3 meters per level

        // if tag building = house
        if (tags.building === 'house') {
            color = 0x808080; // Brown color for houses
            height = 5; // Default height for houses
        }

        for (let i = 0; i < vertices.length - 1; i++) {
            const start = vertices[i];
            const end = vertices[i + 1];

            const startX = (start.x - coords.longitude) * 111320; // Convert longitude to meters
            const startZ = -(start.z - coords.latitude) * 111320; // Invert z-axis
            const endX = (end.x - coords.longitude) * 111320;
            const endZ = -(end.z - coords.latitude) * 111320; // Invert z-axis

            const dx = endX - startX;
            const dz = endZ - startZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            const buildingGeometry = new THREE.BoxGeometry(length + 1, height, 1); // Default width is 3 meters
            const buildingMaterial = new THREE.MeshBasicMaterial({ color: color });
            const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);

            // Position the building segment
            buildingMesh.position.set(
                (startX + endX) / 2, // Midpoint of the segment
                height / 2,          // Center the building vertically
                (startZ + endZ) / 2  // Midpoint of the segment
            );

            // Rotate the building segment to align with the path
            const angle = Math.atan2(dz, dx);
            buildingMesh.rotation.y = -angle;

            scene.add(buildingMesh);
        }
    });
}