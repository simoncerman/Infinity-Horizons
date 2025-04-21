import * as THREE from 'three';
export class DirectLight {
    light = null;
    constructor() {
        this.light = new THREE.DirectionalLight(0xffffff, 4); // Increase directional light intensity
        this.light.position.set(50, 50, 50);
        this.light.castShadow = true; // Enable shadows
        this.light.shadow.mapSize.width = 4096; // Increase shadow map resolution
        this.light.shadow.mapSize.height = 4096;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 1000; // Extend far plane for larger scenes
        this.light.shadow.camera.left = -500; // Extend shadow camera bounds
        this.light.shadow.camera.right = 500;
        this.light.shadow.camera.top = 500;
        this.light.shadow.camera.bottom = -500;
    }
    getLight() {
        return this.light;
    }
}