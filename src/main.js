import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { Clock } from "three";
import { GetSceneBounds } from "./utils";
import { AmbientLight } from "three";
import { DirectionalLight } from "three";
import { SpotLight } from "three";
import { Raycaster } from "three";
import { Vector2 } from "three";
import { Vector3 } from "three";
import GUI from "lil-gui";
import { Mesh } from "three";
import { PlaneGeometry } from "three";
import { MeshBasicMaterial } from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

const { PI } = Math;

const canvas = document.querySelector("canvas");

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  1,
  1000
);
camera.position.z = 5;


// Scene Bounds ??
const { width: SceneWidth, height: SceneHeight } = GetSceneBounds(
  renderer,
  camera
);

// Orbit Controls

const controls = new OrbitControls(camera,canvas)


// Loaders & Managers ??
const Manager = new THREE.LoadingManager();
const Draco = new DRACOLoader(Manager);
const GLB = new GLTFLoader(Manager);
const TextureLoader = new THREE.TextureLoader(Manager);

Draco.setDecoderPath("/draco/");
Draco.setDecoderConfig({ type: "wasm" });
GLB.setDRACOLoader(Draco);

// GUI;
const gui = new GUI();


// GUI Setting
const settings = {
  displaceStrength: {
    value: 1,
  },
  lerpAlpha: {
    value: .05,
  },
  rotationLerpAlpha: {
    value: .05,
  },
  radius: {
    value: 3,
  },
  rx:{
    value:.07
  },
  ry:{
    value:.15
  },
};

gui
  .add(settings.displaceStrength, "value")
  .min(0)
  .max(1)
  .step(0.001)
  .name("Displacement Strength");
gui
  .add(settings.lerpAlpha, "value")
  .min(0)
  .max(.5)
  .step(0.0001)
  .name("Lerping Alpha");
gui
  .add(settings.radius, "value")
  .min(0)
  .max(4)
  .step(0.001)
  .name("Displacement Radius");
gui
  .add(settings.rotationLerpAlpha, "value")
  .min(0)
  .max(.6)
  .step(0.001)
  .name("Rotation Lerp Alpha");
gui
  .add(settings.rx, "value")
  .min(0)
  .max(.2)
  .step(0.001)
  .name("Rotation X");
gui
  .add(settings.ry, "value")
  .min(0)
  .max(.2)
  .step(0.001)
  .name("Rotation Y");


// Raycaster Mouse
const mouse = new Vector2(0, 0);
const targetMouse = new Vector2(0, 0);
const mouse3d = new Vector3(0, 0, 0);

// Stone
let stone = {
  model: null,
  mixer: null,
  animations: {
    intro: null,
    outro: null,
  },
  intro: null,
  outro: null,
  loaded: false,
  positions: {},
};
GLB.load("/stone.glb", (glb) => {
  stone.model = glb.scene;
  stone.animations.intro = glb.animations[0];
  stone.animations.outro = glb.animations[1];
  stone.mixer = new THREE.AnimationMixer(stone.model);
  stone.intro = stone.mixer.clipAction(stone.animations.intro);
  stone.outro = stone.mixer.clipAction(stone.animations.outro);
  stone.loaded = true;

  stone.intro.play();

  // Copying all the positions

  stone.model.traverse((node) => {
    if (!node.isMesh) return;
    // world position of node
    const worldPos = new THREE.Vector3();
    node.getWorldPosition(worldPos);
    stone.positions[node.userData.name] = worldPos;
  });

  scene.add(stone.model);
  stone.model.position.set(-0.25, 0, 0);
  stone.model.scale.setScalar(0.9);
  stone.model.rotation.set(Math.PI / 10, 0, 0);
});


// Raycaster Plane;

const RayPlane = new Mesh(
  new PlaneGeometry(SceneWidth,SceneHeight),
  new MeshBasicMaterial({color:0xff0000,transparent:true,visible:false})
)

RayPlane.rotateX.x = Math.PI / 2;
scene.add(RayPlane)




// ?? Lights
const Amb = new AmbientLight(0xffffff, 0.5);
const Dir = new DirectionalLight(0xffffff, 1);
const Top = new DirectionalLight(0xffffff, 4);

Dir.position.set(0, 0, 3);
Top.position.set(0, 4, 0);

scene.add(Amb, Dir, Top);




// Raycaster ??
const raycaster = new Raycaster();



// Render Pipeline ??
const clock = new Clock();
let PrevTime = clock.getElapsedTime();

// Displacement Position Vector
const displacedPos = new Vector3()
const rotation = new Vector2()

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  mouse.x += (targetMouse.x - mouse.x) * 0.15;
  mouse.y += (targetMouse.y - mouse.y) * 0.15;

  if (stone.loaded) {
    // stone.mixer.update(DT)

    stone.model.traverse((node) => {
      if (!node.isMesh) return;

      // world position of node
      const worldPos = stone.positions[node.userData.name];

      // distance from mouse
      const dist = worldPos.distanceTo(mouse3d);

      if (dist > settings.radius.value) {
        node.position.lerp(worldPos, settings.lerpAlpha.value);
        return;
      }

      // direction away from center
      const dir = worldPos.clone().normalize();

      // falloff (strong near mouse, weak far)
      const strength =
        (1 - dist / settings.radius.value) * settings.displaceStrength.value;

      // Displaced Position
      displacedPos.copy(worldPos)
        .add(dir.multiplyScalar(strength));


      // apply displacement
      node.position.lerp(displacedPos, settings.lerpAlpha.value);
    });


    stone.model.rotation.x += (rotation.x - stone.model.rotation.x)  * settings.rotationLerpAlpha.value
    stone.model.rotation.y += (rotation.y - stone.model.rotation.y)  * settings.rotationLerpAlpha.value

  }

  renderer.render(scene, camera);
  requestAnimationFrame(Animate);
}

requestAnimationFrame(Animate);



// Resization ??
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  renderer.setSize(innerWidth, innerHeight);
}


// Mouse Move ??
function mouseMove(e) {
  if (!stone.loaded) return;
  const x = e.clientX;
  const y = e.clientY;

  const nx = (x / innerWidth) * 2 - 1;
  const ny = -((y / innerHeight) * 2 - 1);

  mouse.set(nx, ny);
  rotation.set(
    .3 + settings.rx.value * -ny, 
    settings.ry.value * nx, 
  )

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(RayPlane);

  if (intersects && intersects.length) {
    const intersect = intersects[0];
    mouse3d.copy(intersect.point);
  }
}

window.addEventListener("mousemove", mouseMove);
window.addEventListener("resize", resize);
