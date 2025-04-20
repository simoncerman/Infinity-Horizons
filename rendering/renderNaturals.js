import * as THREE from 'three';

export function renderNaturals(naturals, coords, scene, offset) {
    naturals.forEach(natural => {
        console.log('Natural:', natural);
        if (natural.tags.natural === "water") renderWaterways(natural, coords, scene, offset);
    });
}

function renderWaterways(waterway, coords, scene, offset) {
    const offsetX = offset.offsetX;
    const offsetY = offset.offsetY;
    console.log('Waterway:', waterway);
    if (!waterway.path) return;

    // Convert path vertices to THREE.Vector2 for the polygon
    const points = waterway.path.map(vertex => new THREE.Vector2(
        ((vertex.x - coords.longitude) * 111320) + offsetX, // Apply offsetX
        -((vertex.z - coords.latitude) * 111320) + offsetY  // Apply offsetY
    ));

    // Create a shape from the points
    const shape = new THREE.Shape(points);

    // Create geometry and material for the polygon
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);

    // Set the position of the mesh to ground level
    mesh.position.y = 0.01; // Slightly above ground to avoid z-fighting

    // Add the polygon to the scene
    mesh.rotation.x = Math.PI / 2; // Rotate to lie flat
    mesh.receiveShadow = true; // Ensure the polygon receives shadows
    scene.add(mesh);
}

// Utility function to check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
    let inside = false;
    const x = point.x, z = point.y;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, zi = polygon[i].y;
        const xj = polygon[j].x, zj = polygon[j].y;

        const intersect = ((zi > z) !== (zj > z)) &&
            (x < (xj - xi) * (z - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}
