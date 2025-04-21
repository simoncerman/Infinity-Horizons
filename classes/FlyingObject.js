import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class FlyingObject {
    model = null; // 3D model of the object

    isPitchUp = false; // Flag for pitch up action
    iPitchDown = false; // Flag for pitch down action
    isYawLeft = false; // Flag for yaw left action
    isYawRight = false; // Flag for yaw right action
    isRollLeft = false; // Flag for roll left action
    isRollRight = false; // Flag for roll right action
    isTrust = false; // Flag for thrust action
    isReverseTrust = false; // Flag for reverse thrust action
    constructor(model) {
        this.model = null;
        this.speed = 0; // Current speed
        this.maxSpeed = 20; // Maximum speed
        this.minSpeed = 0.1; // Minimum speed
        this.acceleration = 0.5; // Acceleration rate
        this.deceleration = 0.3; // Deceleration rate

        // Rotation values
        this.pitch = 0; // Rotation around the X-axis
        this.yaw = 0; // Rotation around the Y-axis
        this.roll = 0; // Rotation around the Z-axis

        this.model = model; // Assign the model to the instance
    }

    update() {}

    getPosX() {
        return this.model.position.x;
    }
    getPosY() {
        return this.model.position.y;
    }
    getPosZ() {
        return this.model.position.z;
    }
    getPos() {
        return this.model.position;
    }
    getModel() {
        return this.model;
    }
}
