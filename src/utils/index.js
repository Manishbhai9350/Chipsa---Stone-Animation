import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { degToRad } from "three/src/math/MathUtils.js";




export function GetSceneBounds(renderer = new WebGLRenderer(),camera = new PerspectiveCamera()){
    const aspect = camera.aspect;
    const z = camera.position.z;
    const theta = degToRad(camera.fov) / 2;
    const height = Math.tan(theta) * z * 2;
    const width =  height * aspect;
    return {width,height}
}