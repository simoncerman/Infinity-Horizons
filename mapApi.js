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
            } else if (element.tags.landuse) {
                naturals.push({ path: vertices, tags: element.tags });
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
    // Define road properties based on type
    const roadProperties = {
        highway: { color: 0xD3D3D3, width: 3.5, height: 0.04 },
        tertiary: { color: 0x616267, width: 7, height: 0.03 },
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
        const roadMaterial = new THREE.MeshBasicMaterial({ color: properties.color });
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);

        roadMesh.position.set(0, properties.height, 0); // Adjust height for the road

        scene.add(roadMesh);
    });
}

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
