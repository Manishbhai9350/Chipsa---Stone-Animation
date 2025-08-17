import './style.css'
import * as THREE from 'three';
import fragmentShader from './shaders/fragment.glsl'
import vertexShader from './shaders/vertex.glsl'

const {PI} = Math

const canvas = document.querySelector('canvas')

canvas.width = innerWidth;
canvas.height = innerHeight;

const scene = new THREE.Scene()

const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true})

const camera = new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,1000)
camera.position.z = 5

const material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms:{
    uTime:{value:0}
  }
})


const Manager = new THREE.LoadingManager();
const Draco = new DRACOLoader(Manager)
const GLB = new GLTFLoader(Manager)

Draco.setDecoderPath('/draco/')
Draco.setDecoderConfig({type: 'wasm'})
GLB.setDRACOLoader(Draco)



const Cube = new THREE.Mesh(
  new THREE.BoxGeometry(2,2,2),
  material
)

Cube.rotation.set(-PI/4,PI/4,PI/2)

scene.add(Cube)


function Animate(){
  Cube.rotation.z += .01
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
