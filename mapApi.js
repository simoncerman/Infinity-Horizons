import * as THREE from 'three';

export async function fetchMapData(latitude, longitude, width, height) {
    const overpassApiUrl = 'https://overpass-api.de/api/interpreter';
    const bbox = calculateBoundingBox(latitude, longitude, width, height);
    const query = `
        [out:json][timeout:25];
        (
            way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["waterway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="wood"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["landuse"="forest"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["natural"="wood"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["landuse"="forest"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        );
        (._;>;);
        out body;
    `;

    try {
        const response = await fetch(overpassApiUrl, {
            method: 'POST',
            body: query,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        console.log('API response:', response);
        const data = await response.json();
        console.log('Forests:', data.elements.filter(el => el.tags && (el.tags.natural === 'wood' || el.tags.landuse === 'forest')));
        return processMapData(data);
    } catch (error) {
        console.error('Error fetching map data:', error);
        throw error;
    }
}

function calculateBoundingBox(latitude, longitude, width, height) {
    const latOffset = height / 111320; // Approx. meters per degree latitude
    const lonOffset = width / (111320 * Math.cos((latitude * Math.PI) / 180)); // Adjust for longitude
    return {
        north: latitude + latOffset / 2,
        south: latitude - latOffset / 2,
        east: longitude + lonOffset / 2,
        west: longitude - lonOffset / 2
    };
}

function processMapData(data) {
    const nodes = {};
    data.elements.forEach(element => {
        if (element.type === 'node') {
            console.log('Node:', element);
            nodes[element.id] = { x: element.lon, y: 0, z: element.lat };
        }
    });

    const buildings = [];
    const roads = [];
    const naturals = [];
    const waterways = [];

    data.elements.forEach(element => {
        if (element.type === 'way') {
            const vertices = element.nodes.map(nodeId => nodes[nodeId]);
            if (element.tags.building) {
                buildings.push({ vertices, tags: element.tags });
            } else if (element.tags.highway) {
                roads.push({ path: vertices, tags: element.tags });
            } else if (element.tags.natural) {
                naturals.push({ path: vertices, tags: element.tags });
            } else if (element.tags.waterway) {
                waterways.push({ path: vertices });
            }
        }
    });
    console.log('Buildings:', buildings);
    console.log('Roads:', roads);
    console.log('Naturals:', naturals);
    console.log('Waterways:', waterways);

    return { buildings, roads, naturals, waterways };
}

export function renderRoads(roads, coords, scene) {
    // Assign priority to road types and their heights
    const roadPriority = {
        highway: { priority: 3, height: 0.03 }, // Highest priority, highest height
        residential: { priority: 2, height: 0.02 },
        tertiary: { priority: 2, height: 0.02 }, // Same as residential
        footway: { priority: 1, height: 0.01 }, // Lowest priority, lowest height
    };

    // Sort roads by priority
    roads.sort((a, b) => {
        const priorityA = roadPriority[a.tags.highway]?.priority || 0;
        const priorityB = roadPriority[b.tags.highway]?.priority || 0;
        return priorityA - priorityB;
    });

    roads.forEach(road => {
        let path = road.path;

        let color = 0xD3D3D3; // Default color for roads
        let width = 3.5; // Default width for roads
        let drawLines = false; // Default: no lines
        let height = roadPriority[road.tags.highway]?.height || 0.01; // Default height

        if (road.tags.highway === 'tertiary') {
            width = 7; // Wider for tertiary roads
            drawLines = true; // Draw white lines for tertiary
            color = 0x616267;
        } else if (road.tags.highway === 'footway') {
            width = 1.5;
            color = 0x8B4513;
            drawLines = true; // Draw white lines for footway
        } else if (road.tags.highway === 'residential') {
            width = 6;
            color = 0x616267;
            drawLines = true; // Draw white lines for residential
        }

        // Convert path vertices to THREE.Vector3
        const points = path.map(vertex => new THREE.Vector3(
            (vertex.x - coords.longitude) * 111320, // Convert longitude to meters
            height,                                 // Set height based on priority
            -(vertex.z - coords.latitude) * 111320 // Convert latitude to meters and invert z-axis
        ));

        // Create a smooth curve using CatmullRomCurve3
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(50); // Increase the number of points for smoother curves

        for (let i = 0; i < curvePoints.length - 1; i++) {
            const start = curvePoints[i];
            const end = curvePoints[i + 1];

            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.sqrt(dx * dx + dz * dz);

            // Create the road geometry using PlaneGeometry
            const roadGeometry = new THREE.PlaneGeometry(length, width);
            const roadMaterial = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
            const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

            // Position the road segment
            roadMesh.position.set(
                (start.x + end.x) / 2, // Midpoint of the segment
                height,                // Height based on priority
                (start.z + end.z) / 2  // Midpoint of the segment
            );

            // Rotate the road segment to align with the path
            const angle = Math.atan2(dz, dx);
            roadMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat
            roadMesh.rotation.z = -angle;

            scene.add(roadMesh);

            // Draw white lines in the middle if required
            if (drawLines) {
                const lineWidth = 0.1; // Thin line width
                const lineGeometry = new THREE.PlaneGeometry(length, lineWidth);
                const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
                const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);

                // Position the line segment
                lineMesh.position.set(
                    (start.x + end.x) / 2, // Midpoint of the segment
                    height + 0.001,        // Slightly above the road to avoid z-fighting
                    (start.z + end.z) / 2  // Midpoint of the segment
                );

                // Rotate the line segment to align with the path
                lineMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat
                lineMesh.rotation.z = -angle;

                scene.add(lineMesh);
            }
        }
    });
}

export function renderBuildings(buildings, coords, scene) {
    buildings.forEach(building => {
        const vertices = building.vertices;
        const tags = building.tags;

        const color = 0x808080;
        const height = parseFloat(tags['building:levels'] || 1) * 3; // Default height is 3 meters per level

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

            const buildingGeometry = new THREE.BoxGeometry(length, height, 3); // Default width is 3 meters
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
