import * as THREE from 'three';
import { renderRoads } from './rendering/renderRoads.js';
import { renderBuildings } from './rendering/renderBuildings.js';
import { renderNaturals } from './rendering/renderNaturals.js';
import { renderAirport } from './rendering/renderAirport.js';
import { renderWaterways } from './rendering/renderWaterways.js';

export async function fetchMapData(latitude, longitude, width, height) {
    const overpassApiUrl = 'https://overpass-api.de/api/interpreter';
    const bbox = calculateBoundingBox(latitude, longitude, width, height);
    const query = `
        [out:json];
        (
            way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}); // General natural tag
            way["natural"="wood"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="tree"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="grassland"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="scrub"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="heath"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["natural"="wetland"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["landuse"="forest"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["natural"="wood"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["landuse"="forest"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["aeroway"="runway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            relation["aeroway"="runway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["aeroway"="taxiway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["aeroway"="apron"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
            way["aeroway"="aerodrome"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
        );
        (._;>;);
        out body;
    `;

    console.log('Overpass API query:', latitude, longitude, width, height);
    try {
        console.log('Sending API request...');
        console.log('Query:', query);
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
            nodes[element.id] = { x: element.lon, y: 0, z: element.lat };
        }
    });

    const buildings = [];
    const roads = [];
    const naturals = [];
    const waterways = [];
    const airports = [];

    data.elements.forEach(element => {
        if (element.type === 'way') {
            const vertices = element.nodes.map(nodeId => nodes[nodeId]);
            if (element.tags?.building) {
                buildings.push({ vertices, tags: element.tags });
            } else if (element.tags?.highway) {
                roads.push({ path: vertices, tags: element.tags });
            } else if (element.tags?.natural) {
                naturals.push({ path: vertices, tags: element.tags });
            } else if (element.tags?.waterway) {
                waterways.push({ path: vertices, tags: element.tags });
            } else if (element.tags?.aeroway) {
                airports.push({ path: vertices, tags: element.tags });
            }
        }
    });
    console.log('Buildings:', buildings);
    console.log('Roads:', roads);
    console.log('Naturals:', naturals);
    console.log('Waterways:', waterways);
    console.log('Airports:', airports);

    return { buildings, roads, naturals, waterways, airports };
}

export function renderAll(mapData, coords, scene, treeModel) {
    renderRoads(mapData.roads, coords, scene);
    renderBuildings(mapData.buildings, coords, scene);
    renderNaturals(mapData.naturals, coords, scene, treeModel);
    renderWaterways(mapData.waterways, coords, scene);
    renderAirport(mapData.airports, coords, scene);
}

