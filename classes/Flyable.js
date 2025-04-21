export class Flyable {
    speed = 0;
    altitude = 0;
    heading = 0;

    pitch = 0;
    roll = 0;
    yaw = 0;

    model = null;

    yawLeft = false;
    yawRight = false;
    pitchUp = false;
    pitchDown = false;
    rollLeft = false;
    rollRight = false;
    trust = false;
    reverseTrust = false;

    constructor(parameters, model) {
        this.speed = parameters.speed || 0;
        this.altitude = parameters.altitude || 0;
        this.heading = parameters.heading || 0;
        this.pitch = parameters.pitch || 0;
        this.roll = parameters.roll || 0;
        this.yaw = parameters.yaw || 0;

        this.model = model; // Assign the model to the instance
    }

    update() {}

    returnAllParameters() {
        return {
            speed: this.speed,
            altitude: this.altitude,
            heading: this.heading,
            pitch: this.pitch,
            roll: this.roll,
            yaw: this.yaw
        };
    }
}