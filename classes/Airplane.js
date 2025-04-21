import { FlyingObject } from './FlyingObject.js';
import * as THREE from 'three';

export class Airplane extends FlyingObject {
    constructor(model) {
        super(model);
    }

    update() {

        // Use renamed boolean properties to determine the next step
        if (this.isPitchUp) {
            this.pitchUp(0.1);
        } else if (this.isPitchDown) {
            this.pitchDown(0.1);
        }
        if (this.isYawLeft) {
            this.yawLeft(0.1);
        } else if (this.isYawRight) {
            this.yawRight(0.1);
        }
        if (this.isRollLeft) {
            this.rollLeft(0.1);
        } else if (this.isRollRight) {
            this.rollRight(0.1);
        }
        if (this.isTrust) {
            console.log('trust', this.isTrust);
            this.increaseSpeed();
        } else if (this.isReverseTrust) {
            this.decreaseSpeed();
        }
        this.model.position.x += Math.sin(this.yaw) * this.speed;
        this.model.position.y += Math.sin(this.pitch) * this.speed;
        this.model.position.z += Math.cos(this.yaw) * this.speed;
        this.model.rotation.x = this.pitch;
        this.model.rotation.y = this.yaw;
        this.model.rotation.z = this.roll;
        this.model.updateMatrixWorld(); // Update the model's matrix world to reflect the new position and rotation
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

    increaseSpeed() {
        this.speed += 0.001; // Adjust the speed increment as needed
    }

    decreaseSpeed() {
        this.speed -= 0.001; // Adjust the speed decrement as needed
    }
}
