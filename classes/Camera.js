import * as THREE from 'three';
export class Camera{
    camera = null;
    cameraOffset = {
        x: 0,
        y: 100,
        z: 125
    };
    constructor(camera)
    {
        this.camera = camera;
        camera.position.z = this.cameraOffset.z; 
        camera.position.y = this.cameraOffset.y; 
        camera.position.x = this.cameraOffset.x; 
        camera.fov = 40; // Set field of view to 40 degrees
        camera.rotation.x = -Math.PI / 180 * 50; // Rotate camera 75 degrees downward
        camera.updateProjectionMatrix(); // Ensure the projection matrix is updated
    }

    getCameraOffset()
    {
        return this.cameraOffset;
    }
    getCamera()
    {
        return this.camera;
    }
}