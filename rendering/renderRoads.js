import * as THREE from 'three';

export function renderRoads(roads, coords, scene, offset) {
    const offsetX = offset.offsetX;
    const offsetY = offset.offsetY;
    // Define road properties based on type
    const roadProperties = {
        highway: {width: 3.5, height: 0.06, drawLines: true },
        tertiary: { width: 7, height: 0.05, drawLines: true },
        residential: { width: 6, height: 0.04 },
        footway: {width: 1.5, height: 0.03 },
        default: {width: 3, height: 0.02 },
        service: { width: 3, height: 0.02 },

    };

    const surfaceTypes = {
        asphalt: new THREE.MeshStandardMaterial({ color: 0x333333 }),
        concrete: new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
        gravel: new THREE.MeshStandardMaterial({ color: 0x888888 }),
        dirt: new THREE.MeshStandardMaterial({ color: 0x7b5a29 }),
        grass: new THREE.MeshStandardMaterial({ color: 0x4caf50 }),
        sand: new THREE.MeshStandardMaterial({ color: 0xffc107 }),
        paving_stones: new THREE.MeshStandardMaterial({ color: 0x9e9e9e })
    };



    roads.forEach(road => {
        const properties = roadProperties[road.tags.highway] || roadProperties.default;
        

        const points = road.path.map(vertex => new THREE.Vector3(
            ((vertex.x - coords.longitude) * 111320) + offsetX, // Apply offsetX
            0,                                                 // Place road at ground level
            -((vertex.z - coords.latitude) * 111320) + offsetY  // Apply offsetY
        ));

        // Create a smooth curve using CatmullRomCurve3
        const curve = new THREE.CatmullRomCurve3(points);
        var width = properties.width; // Set width based on road type
        if (road.tags.lanes !== undefined) {
            width = road.tags.lanes * 3.5; // Override width if specified in tags
        }

        // Define the road cross-section shape
        const roadShape = new THREE.Shape();
        const halfWidth = width / 2;
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
        const roadMaterial = surfaceTypes[road.tags.surface] || surfaceTypes.asphalt; // Use asphalt as default
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

        // Enable shadows for roads
        roadMesh.castShadow = true;
        roadMesh.receiveShadow = true;

        roadMesh.position.set(0, properties.height + 0.02, 0); // Adjust height for the road

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

            lineMesh.position.set(0, properties.height + 0.03, 0); // Adjust height for the line

            scene.add(lineMesh);
        }
    });
}