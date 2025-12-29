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
import gsap from "gsap";

const { PI } = Math;

const MouseElm = document.querySelector("main .mouse");
const MouseParaElm = document.querySelector("main .mouse p");
const canvas = document.querySelector("canvas");

const domMouse = { x: 0, y: 0 };
const targetDomMouse = { x: 0, y: 0 };

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

const controls = new OrbitControls(camera, canvas);

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

gui.close();

// GUI Setting
const settings = {
  displaceStrength: {
    value: 1,
  },
  lerpAlpha: {
    value: 0.05,
  },
  rotationLerpAlpha: {
    value: 0.05,
  },
  radius: {
    value: 3,
  },
  rx: {
    value: 0.07,
  },
  ry: {
    value: 0.15,
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
  .max(0.5)
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
  .max(0.6)
  .step(0.001)
  .name("Rotation Lerp Alpha");
gui.add(settings.rx, "value").min(0).max(0.2).step(0.001).name("Rotation X");
gui.add(settings.ry, "value").min(0).max(0.2).step(0.001).name("Rotation Y");

// Raycaster Mouse
const mouse = new Vector2(0, 0);
const targetMouse = new Vector2(0, 0);
const mouse3d = new Vector3(0, 0, 0);

// If Animating any model
let isAnimating = false;
let modelsLoaded = false;

// Cloth Model Object

let cloth = {
  isclothActive: false,
  model: null,
  mouse: new Vector3(),
  mouseUV: new Vector2(),
  originalScale: 0,
  offserIntensity: 0,
};

// Stone Model Object
let stone = {
  isStoneActive: true,
  model: null,
  collider: null,
  mixer: null,
  position: new Vector3(-0.25, 0, 0),
  animations: {
    intro: null,
    outro: null,
  },
  intro: null,
  outro: null,
  isMouse: false,
  positions: {},
};
GLB.load("/stone.glb", (glb) => {
  stone.model = glb.scene;
  stone.collider = stone.model.clone(true);
  stone.animations.intro = glb.animations[0];
  stone.animations.outro = glb.animations[1];
  stone.mixer = new THREE.AnimationMixer(stone.model);
  stone.intro = stone.mixer.clipAction(stone.animations.intro);
  stone.outro = stone.mixer.clipAction(stone.animations.outro);

  stone.mixer.addEventListener("finished", (e) => {
    if (e.action === stone.intro) {
      isAnimating = false;
    }
    if (e.action === stone.outro) {
      isAnimating = false;
      stone.model.visible = false;
    }
  });

  const colliderMaterial = new MeshBasicMaterial({
    color: 0xff0000,
    visible: false,
  });

  stone.collider.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.material = colliderMaterial;
    }
  });

  // Copying all the positions
  stone.model.traverse((node) => {
    if (!node.isMesh) return;
    // world position of node
    const worldPos = new THREE.Vector3();
    node.getWorldPosition(worldPos);
    stone.positions[node.userData.name] = worldPos;
  });

  scene.add(stone.model, stone.collider);
  stone.model.visible = false;
  stone.model.position.copy(stone.position);
  stone.model.scale.setScalar(0.9);
  stone.model.rotation.set(Math.PI / 10, 0, 0);
  stone.collider.position.copy(stone.model.position);
  stone.collider.scale.setScalar(0.9);
  stone.collider.rotation.set(Math.PI / 10, 0, 0);

  loadCloth();
});

function loadCloth() {
  GLB.load("/cloth.glb", (glb) => {
    cloth.model = glb.scene.children[0];

    // Calculating The Cloth Position with respect to Stone position
    let worldPos = new Vector3();
    stone.model.getWorldPosition(worldPos);
    worldPos.copy(worldPos.sub(stone.model.position));

    cloth.model.position.copy(worldPos);
    cloth.originalScale = cloth.model.scale.x * 0.85;
    cloth.model.scale.setScalar(cloth.originalScale * 0);
    scene.add(cloth.model);

    cloth.model.material.onBeforeCompile = (shader) => {
      cloth.model.userData.uniforms = shader.uniforms;

      cloth.model.userData.uniforms.uTime = { value: 0 };
      cloth.model.userData.uniforms.uMouse = { value: cloth.mouse };
      cloth.model.userData.uniforms.uMouseUV = { value: cloth.mouseUV };
      cloth.model.userData.uniforms.uOffsetIntensity = {
        value: cloth.offserIntensity,
      };

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `
        #include <common>
        uniform float uTime;
        uniform float uOffsetIntensity;
        uniform vec3 uMouse;
        uniform vec2 uMouseUV;
    `
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <displacementmap_vertex>",
        `
        #include <displacementmap_vertex>

        vec3 n = normalize(normal);

        // distance between vertex and mouse (same space!)
        float dist = distance(transformed, vec3(
        -0.4824066733648658,-0.6615862949003867,1.6230654871337589
        ));

        dist = distance(uv,uMouseUV);
        // dist = distance(uv,vec2(.5,.5));

        // radius of influence
        float radius = .3;

        // smooth falloff
        float strength = 1.0 - smoothstep(0.0, radius, dist);

        // apply displacement
        transformed += n * strength * 6.15 * uOffsetIntensity;
    `
      );
    };

    modelsLoaded = true;
    AnimateStoneOut();
  });
}

// Raycaster Plane;

const RayPlane = new Mesh(
  new PlaneGeometry(SceneWidth, SceneHeight),
  new MeshBasicMaterial({ color: 0xff0000, transparent: true, visible: false })
);

RayPlane.rotateX.x = Math.PI / 2;
scene.add(RayPlane);

// ?? Lights
const Amb = new AmbientLight(0xffffff, 0.5);
const Dir = new DirectionalLight(0xffffff, 1);
const Top = new DirectionalLight(0xffffff, 4);

Dir.position.set(0, 0, 3);
Top.position.set(0, 4, 0);

scene.add(Amb, Dir, Top);

// Raycaster ??
const raycaster = new Raycaster();

// Displacement Position Vector
const displacedPos = new Vector3();
const rotation = new Vector2();

function AnimateStoneOut() {
  if (!modelsLoaded || isAnimating) return;
  isAnimating = true;

  cloth.offserIntensity = 1;

  const tl = gsap.timeline({
    duration: 0.3,
    ease: "power2",
    onComplete() {
      stone.isStoneActive = false;
      stone.outro.reset().setLoop(THREE.LoopOnce, 1);
      stone.outro.play();

      gsap.to(cloth.model.scale, {
        x: cloth.originalScale,
        y: cloth.originalScale,
        z: cloth.originalScale,
        duration: 1,
        ease: "power4.out",
        delay: 2,
      });
    },
  });

  stone.model.traverse((node) => {
    if (!node.isMesh && !node.userData.name) return;
    const pos = stone.positions[node.userData.name];
    if (!pos) return;
    tl.to(
      node.position,
      {
        x: pos.x,
        y: pos.y,
        z: pos.z,
      },
      "<"
    );
    tl.to(
      node.rotation,
      {
        x: 0,
        y: 0,
        z: 0,
      },
      "<"
    );
  });
}
function AnimateStoneIn() {
  if (!modelsLoaded || isAnimating) return;
  isAnimating = true;
  cloth.offserIntensity = 0;

  gsap.to(cloth.model.scale, {
    x: 0,
    y: 0,
    z: 0,
    duration: 1,
    ease: "power4.in",
    delay: 0,
  });

  const tl = gsap.timeline({
    onComplete() {
      stone.isStoneActive = true;
      stone.model.visible = true;
      stone.intro.reset().setLoop(THREE.LoopOnce, 1);
      stone.intro.play();
    },
  });

  stone.model.traverse((node) => {
    if (!node.isMesh && !node.userData.name) return;
    const pos = stone.positions[node.userData.name];
    if (!pos) return;
    tl.to(
      node.position,
      {
        x: pos.x,
        y: pos.y,
        z: pos.z,
      },
      "<"
    );
    tl.to(
      node.rotation,
      {
        x: 0,
        y: 0,
        z: 0,
      },
      "<"
    );
  });
}

// Animating The Stone
function AnimateStone(DT = 0) {
  if (modelsLoaded) {
    stone.mixer.update(DT);

    if (isAnimating) return;

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
      displacedPos.copy(worldPos).add(dir.multiplyScalar(strength));

      // apply displacement
      node.position.lerp(displacedPos, settings.lerpAlpha.value);
    });

    stone.model.rotation.x +=
      (rotation.x - stone.model.rotation.x) * settings.rotationLerpAlpha.value;
    stone.model.rotation.y +=
      (rotation.y - stone.model.rotation.y) * settings.rotationLerpAlpha.value;

    stone.collider.rotation.x = stone.model.rotation.x;
    stone.collider.rotation.y = stone.model.rotation.y;
    cloth.model.rotation.x = stone.model.rotation.x;
    cloth.model.rotation.y = stone.model.rotation.y;
  }
}

// Render Pipeline ??
const clock = new Clock();
let PrevTime = clock.getElapsedTime();

function Animate() {
  const CurrentTime = clock.getElapsedTime();
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  if (modelsLoaded && cloth?.model?.userData?.uniforms) {
    cloth.model.userData.uniforms.uTime.value += DT;
    cloth.model.userData.uniforms.uMouse.value.x +=
      (cloth.mouse.x - cloth.model.userData.uniforms.uMouse.value.x) * 0.2;
    cloth.model.userData.uniforms.uMouse.value.y +=
      (cloth.mouse.y - cloth.model.userData.uniforms.uMouse.value.y) * 0.2;
    cloth.model.userData.uniforms.uMouse.value.z +=
      (cloth.mouse.z - cloth.model.userData.uniforms.uMouse.value.z) * 0.2;

    cloth.model.userData.uniforms.uMouseUV.value.x += (
      cloth.mouseUV.x - cloth.model.userData.uniforms.uMouseUV.value.x
    ) * .05
    cloth.model.userData.uniforms.uMouseUV.value.y += (
      cloth.mouseUV.y - cloth.model.userData.uniforms.uMouseUV.value.y
    ) * .05

    if(stone.isMouse) {
      cloth.model.userData.uniforms.uOffsetIntensity.value += (
        1 - cloth.model.userData.uniforms.uOffsetIntensity.value
      ) * .1
    } else {
      cloth.model.userData.uniforms.uOffsetIntensity.value -= cloth.model.userData.uniforms.uOffsetIntensity.value* .1
    }

    cloth.model.userData.uniforms.uOffsetIntensity.value = cloth.offserIntensity
  }

  mouse.x += (targetMouse.x - mouse.x) * 0.15;
  mouse.y += (targetMouse.y - mouse.y) * 0.15;

  domMouse.x += (targetDomMouse.x - domMouse.x) * 0.05;
  domMouse.y += (targetDomMouse.y - domMouse.y) * 0.05;

  MouseElm.style.left = `${domMouse.x}px`;
  MouseElm.style.top = `${domMouse.y}px`;

  AnimateStone(DT);

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
  if (!modelsLoaded) return;
  const x = e.clientX;
  const y = e.clientY;

  targetDomMouse.x = x;
  targetDomMouse.y = y;

  const nx = (x / innerWidth) * 2 - 1;
  const ny = -((y / innerHeight) * 2 - 1);

  mouse.set(nx, ny);
  rotation.set(0.3 + settings.rx.value * -ny, settings.ry.value * nx);

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(stone.collider, true);

  if (intersects && intersects.length) {
    const intersect = intersects[0];
    mouse3d.copy(intersect.point);
    stone.isMouse = true;
    gsap.to(MouseElm, {
      color: "white",
      borderColor: "white",
    });
    gsap.to(MouseParaElm, {
      opacity: 1,
      duration: 0.2,
    });
    document.body.style.cursor = "pointer";
  } else {
    gsap.to(MouseElm, {
      color: "black",
      borderColor: "black",
    });
    gsap.to(MouseParaElm, {
      opacity: 0,
      duration: 0.2,
    });
    stone.isMouse = false;
    document.body.style.cursor = "initial";
  }

  // Cloth model is active checking intersects
  if (!stone.isStoneActive) {
    const intersect = raycaster.intersectObject(cloth.model, false)[0] || null;
    if (intersect) {
      cloth.mouse = intersect.point;
      cloth.mouseUV = intersect.uv;
    }
  }
}

function onClick() {
  if (!stone.isMouse || isAnimating) return;

  if (stone.isStoneActive) {
    AnimateStoneOut();
  } else {
    AnimateStoneIn();
  }
}

window.addEventListener("resize", resize);
window.addEventListener("mousemove", mouseMove);
window.addEventListener("click", onClick);
