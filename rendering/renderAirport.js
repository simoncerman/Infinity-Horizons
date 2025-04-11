import * as THREE from 'three';

export function renderAirport(airports, coords, scene) {
    airports.forEach(airport => {
        const path = airport.path;
        const tags = airport.tags;

        let color = 0x808080; // Default gray color for airport elements
        if (tags.aeroway === 'runway') color = 0x333333; // Darker gray for runways
        if (tags.aeroway === 'taxiway') color = 0x555555; // Medium gray for taxiways
        if (tags.aeroway === 'apron') color = 0x777777; // Lighter gray for aprons

        const points = path.map(vertex => new THREE.Vector3(
            (vertex.x - coords.longitude) * 111320, // Convert longitude to meters
            0,                                     // Place at ground level
            -(vertex.z - coords.latitude) * 111320 // Convert latitude to meters and invert z-axis
        ));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(geometry, material);

        scene.add(line);
    });
}
