import * as THREE from 'three';

export async function fetchMapData(latitude, longitude, width, height) {
    const overpassApiUrl = 'https://overpass-api.de/api/interpreter';
    const bbox = calculateBoundingBox(latitude, longitude, width, height);
    const query = `
        [out:json];
        (
            way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["waterway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
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
                naturals.push({ path: vertices });
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
    roads.forEach(road => {
        let path = road.path;

        let color = 0xD3D3D3; // Default color for roads
        let height = 0.2; // Default height for roads
        let width = 3.5; // Default width for roads

        if (road.tags.highway === 'tertiary') {
            width = road.tags.lanes ? road.tags.lanes * 3.5 : 3.5;
            color = 0x000000;
        } else if (road.tags.highway === 'footway') {
            width = 1;
            color = 0x8B4513;
        } else if (road.tags.highway === 'residential') {
            width = road.tags.lanes ? road.tags.lanes * 3.5 : 3.5;
            color = 0x000000;
        }

        for (let i = 0; i < road.path.length - 1; i++) {
            const start = road.path[i];
            const end = road.path[i + 1];

            const startX = (start.x - coords.longitude) * 111320; // Convert longitude to meters
            const startZ = -(start.z - coords.latitude) * 111320; // Invert z-axis
            const endX = (end.x - coords.longitude) * 111320;
            const endZ = -(end.z - coords.latitude) * 111320; // Invert z-axis

            const dx = endX - startX;
            const dz = endZ - startZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            const roadGeometry = new THREE.BoxGeometry(length, height, width);
            const roadMaterial = new THREE.MeshBasicMaterial({ color: color });
            const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

            // Position the road segment
            roadMesh.position.set(
                (startX + endX) / 2, // Midpoint of the segment
                height / 2,          // Center the road vertically
                (startZ + endZ) / 2  // Midpoint of the segment
            );

            // Rotate the road segment to align with the path
            const angle = Math.atan2(dz, dx);
            roadMesh.rotation.y = -angle;

            scene.add(roadMesh);
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
