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
        if(tags.height != undefined) {
            height = parseFloat(tags.height); // Use the specified height if available
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
        // Roofs
        if (vertices.length > 2) { // Ensure there are enough points to form a shape
            const shape = new THREE.Shape();

            // Add points to the shape
            vertices.forEach((vertex, index) => {
            const x = ((vertex.x - coords.longitude) * 111320) + offsetX;
            const z = -((vertex.z - coords.latitude) * 111320) + offsetY;

            if (index === 0) {
                shape.moveTo(x, z);
            } else {
                shape.lineTo(x, z);
            }
            });

            // Create geometry and material for the roof
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshStandardMaterial({ color: 0xd7d1c5, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geometry, material);

            // Set the position of the roof to the top of the building
            mesh.position.y = height; // Place the roof at the building's height

            // Add the roof to the scene
            mesh.rotation.x = Math.PI / 2; // Rotate to lie flat
            mesh.receiveShadow = true; // Ensure the roof receives shadows
            scene.add(mesh);
        }
    });

    instancedMesh.castShadow = true; // Enable shadows for the instanced mesh
    instancedMesh.receiveShadow = true; // Buildings do not need to receive shadows
    scene.add(instancedMesh);
}