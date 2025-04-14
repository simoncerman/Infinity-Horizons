import * as THREE from 'three';

export function renderRoads(roads, coords, scene) {
    // Define road properties based on type
    const roadProperties = {
        highway: { color: 0xD3D3D3, width: 3.5, height: 0.04, drawLines: true },
        tertiary: { color: 0x616267, width: 7, height: 0.03, drawLines: true },
        residential: { color: 0x616267, width: 6, height: 0.02 },
        footway: { color: 0x8B4513, width: 1.5, height: 0.01 },
        default: { color: 0x808080, width: 3, height: 0.01 } // Default properties for unknown types
    };

    roads.forEach(road => {
        const properties = roadProperties[road.tags.highway] || roadProperties.default;
        const points = road.path.map(vertex => new THREE.Vector3(
            (vertex.x - coords.longitude) * 111320, // Convert longitude to meters
            0,                                     // Place road at ground level
            -(vertex.z - coords.latitude) * 111320 // Convert latitude to meters and invert z-axis
        ));

        // Create a smooth curve using CatmullRomCurve3
        const curve = new THREE.CatmullRomCurve3(points);

        // Define the road cross-section shape
        const roadShape = new THREE.Shape();
        const halfWidth = properties.width / 2;
        roadShape.moveTo(0, -halfWidth);
        roadShape.lineTo(0, halfWidth);
        roadShape.closePath();

        // Create ExtrudeGeometry to extrude the road shape along the curve
        const extrudeSettings = {
            steps: 100,
            bevelEnabled: true,
            extrudePath: curve,
            bevelThickness: 1,
            bevelSize: 1,
        };
        const roadGeometry = new THREE.ExtrudeGeometry(roadShape, extrudeSettings);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: properties.color });
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

        // Enable shadows for roads
        roadMesh.castShadow = true;
        roadMesh.receiveShadow = true;

        roadMesh.position.set(0, properties.height, 0); // Adjust height for the road

        scene.add(roadMesh);

        // Add interrupted lines if required
        if (properties.drawLines) {
            const lineShape = new THREE.Shape();
            const lineWidth = 0.1; // Thin line width
            const halfWidth = lineWidth / 2;
            lineShape.moveTo(0, -lineWidth);
            lineShape.lineTo(0, lineWidth);
            lineShape.closePath();

            const lineCurve = new THREE.CatmullRomCurve3(points);
            const lineExtrudeSettings = {
                steps: 100,
                bevelEnabled: false,
                extrudePath: lineCurve
            };

            const lineGeometry = new THREE.ExtrudeGeometry(lineShape, lineExtrudeSettings);
            const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);

            // Enable shadows for road lines
            lineMesh.receiveShadow = true;

            lineMesh.position.set(0, properties.height + 0.01, 0); // Adjust height for the line

            scene.add(lineMesh);
        }
    });
}