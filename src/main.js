import './style.css'
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader'
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader'
import { Clock } from 'three';
import { GetSceneBounds } from './utils';
import { AmbientLight } from 'three';
import { DirectionalLight } from 'three';

const {PI} = Math

const canvas = document.querySelector('canvas')

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene()

const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true})

const camera = new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,1000)
camera.position.z = 5


const Manager = new THREE.LoadingManager();
const Draco = new DRACOLoader(Manager)
const GLB = new GLTFLoader(Manager)
const TextureLoader = new THREE.TextureLoader(Manager)

Draco.setDecoderPath('/draco/')
Draco.setDecoderConfig({type: 'wasm'})
GLB.setDRACOLoader(Draco)

let stone = {
  model:null,
  mixer:null,
  animations:{
    intro:null,
    outro:null
  },
  intro:null,
  outro:null,
  loaded:false
}
GLB.load('/stone.glb',glb => {
  stone.model = glb.scene;
  stone.animations.intro = glb.animations[0]
  stone.animations.outro = glb.animations[1]
  stone.mixer = new THREE.AnimationMixer(stone)
  stone.intro = stone.mixer.clipAction(stone.animations.intro)
  stone.outro = stone.mixer.clipAction(stone.animations.outro)
  stone.loaded = true;

  // stone.intro.play()

  console.log(stone.intro)

  scene.add(stone.model)
  
})


// ?? Lights

const Amb = new AmbientLight(0xffffff,.5)
const Dir = new DirectionalLight(0xffffff,1)

Dir.position.set(0,0,3)

scene.add(Amb,Dir)



const { width:SceneWidth,height:SceneHeight } = GetSceneBounds(renderer,camera)


const clock = new Clock()
let PrevTime = clock.getElapsedTime()

function Animate(){
  const CurrentTime = clock.getElapsedTime()
  const DT = CurrentTime - PrevTime;
  PrevTime = CurrentTime;

  if(stone.loaded) {
  }

  renderer.render(scene,camera)
  requestAnimationFrame(Animate)
}

requestAnimationFrame(Animate)


function resize(){
  camera.aspect = innerWidth/innerHeight
  camera.updateProjectionMatrix()
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  renderer.setSize(innerWidth,innerHeight)
}

window.addEventListener('resize',resize)
