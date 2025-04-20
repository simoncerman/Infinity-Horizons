import * as THREE from 'three';

export class Airplane {
    constructor(scene, modelPath, initialPosition) {
        this.scene = scene;
        this.model = null;

        // Movement and rotation properties
        this.speed = 0;
        this.maxSpeed = 20;
        this.minSpeed = 0.1;
        this.acceleration = 0.5;
        this.deceleration = 0.3;

        this.pitch = 0; // Rotation around the X-axis
        this.yaw = 0;   // Rotation around the Y-axis
        this.roll = 0;  // Rotation around the Z-axis

        this.loadModel(modelPath, initialPosition);
    }

    loadModel(modelPath, initialPosition) {
        const loader = new THREE.GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => {
                this.model = gltf.scene;
                this.model.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
                this.model.scale.set(1, 1, 1); // Scale the model
                this.scene.add(this.model);
                console.log('Airplane model loaded:', modelPath);
            },
            undefined,
            (error) => {
                console.error('Error loading airplane model:', error);
            }
        );
    }

    updatePosition() {
        if (!this.model) return;

        // Calculate forward direction based on pitch and yaw
        const direction = new THREE.Vector3(
            Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            Math.cos(this.yaw) * Math.cos(this.pitch)
        );

        // Move the airplane forward based on its speed
        this.model.position.addScaledVector(direction, this.speed);

        // Apply rotations
        this.model.rotation.set(this.pitch, this.yaw, this.roll);
    }

    increaseSpeed() {
        this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
    }

    decreaseSpeed() {
        this.speed = Math.max(this.speed - this.deceleration, this.minSpeed);
    }

    pitchUp(rotationSpeed) {
        this.pitch = Math.max(this.pitch - rotationSpeed, -Math.PI / 6);
    }

    pitchDown(rotationSpeed) {
        this.pitch = Math.min(this.pitch + rotationSpeed, Math.PI / 6);
    }

    yawLeft(rotationSpeed) {
        this.yaw += rotationSpeed;
    }

    yawRight(rotationSpeed) {
        this.yaw -= rotationSpeed;
    }

    rollLeft(rotationSpeed) {
        this.roll = Math.max(this.roll - rotationSpeed, -Math.PI / 4);
    }

    rollRight(rotationSpeed) {
        this.roll = Math.min(this.roll + rotationSpeed, Math.PI / 4);
    }
}
