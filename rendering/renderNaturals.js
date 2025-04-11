import * as THREE from 'three';


export function renderNaturals(naturals, coords, scene, treeModel) {
    naturals.forEach(natural => {
        if (!natural.path || !treeModel) return;

        // Convert path vertices to THREE.Vector3
        const points = natural.path.map(vertex => new THREE.Vector3(
            (vertex.x - coords.longitude) * 111320, // Convert longitude to meters
            0,                                     // Place trees at ground level
            -(vertex.z - coords.latitude) * 111320 // Convert latitude to meters and invert z-axis
        ));

        // Draw a white line along the path
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);

        // Convert points to 2D for polygon checks
        const polygon = points.map(point => new THREE.Vector2(point.x, point.z));

        // Calculate the area of the polygon
        let area = 0;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
        }
        area = Math.abs(area / 2); // Final area in square meters

        // Generate random positions within the bounding box
        const boundingBox = new THREE.Box2();
        polygon.forEach(point => boundingBox.expandByPoint(point));

        // Set the number of trees based on the area size
        const treeDensity = 0.01; // Trees per square meter
        const treeCount = Math.floor(area * treeDensity);

        for (let i = 0; i < treeCount; i++) {
            const randomX = boundingBox.min.x + Math.random() * (boundingBox.max.x - boundingBox.min.x);
            const randomZ = boundingBox.min.y + Math.random() * (boundingBox.max.y - boundingBox.min.y);

            // Check if the random point is inside the polygon
            if (isPointInPolygon(new THREE.Vector2(randomX, randomZ), polygon)) {
                const treeClone = treeModel.clone();
                treeClone.position.set(randomX, 0, randomZ); // Place tree at random position
                scene.add(treeClone);
            }
        }
    });
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