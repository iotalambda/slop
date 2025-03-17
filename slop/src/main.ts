import {
  ActionManager,
  CannonJSPlugin,
  CreateBox,
  KeyboardEventTypes,
  MeshBuilder,
  PhysicsEngine,
  PhysicsImpostor,
  UniversalCamera,
} from "@babylonjs/core";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders";

import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";
import * as CANNON from "cannon";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

const gravityVector = new Vector3(0, 2 * -9.81, 0);
const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
scene.enablePhysics(gravityVector, physicsPlugin);

const player = MeshBuilder.CreateCylinder(
  "player",
  { height: 1.8, diameter: 3 },
  scene
);
player.isVisible = false;
player.position = new Vector3(0, 2, 0);
player.physicsImpostor = new PhysicsImpostor(
  player,
  PhysicsImpostor.CylinderImpostor,
  {
    mass: 5,
    restitution: 0,
    friction: 0.2,
  },
  scene
);

const camera = new UniversalCamera("camera", player.position, scene);
camera.rotationQuaternion = new Quaternion();
camera.attachControl(canvas, false);
camera.parent = player;

const inputMap: { [key: string]: boolean } = {};
scene.actionManager = new ActionManager(scene);

scene.onKeyboardObservable.add((kbInfo) => {
  const key = kbInfo.event.key.toLowerCase();
  if (kbInfo.type === KeyboardEventTypes.KEYDOWN) inputMap[key] = true;
  if (kbInfo.type === KeyboardEventTypes.KEYUP) inputMap[key] = false;
});

const moveSpeed = 20;
const jumpForce = 20;
let canJump = false;

scene.onBeforeRenderObservable.add(() => {
  let moveDirection = new Vector3(0, 0, 0);
  const forward = camera.getDirection(Vector3.Forward());
  forward.y = 0;
  forward.normalize;
  const right = camera.getDirection(Vector3.Right());

  if (inputMap["w"]) moveDirection.addInPlace(forward);
  if (inputMap["s"]) moveDirection.addInPlace(forward.scale(-1));
  if (inputMap["a"]) moveDirection.addInPlace(right.scale(-1));
  if (inputMap["d"]) moveDirection.addInPlace(right);

  moveDirection.normalize().scaleInPlace(moveSpeed);

  player.physicsImpostor?.setLinearVelocity(
    new Vector3(
      moveDirection.x,
      player.physicsImpostor.getLinearVelocity()?.y,
      moveDirection.z
    )
  );

  if (inputMap[" "] && canJump) {
    canJump = false;
    player.physicsImpostor?.setLinearVelocity(new Vector3(0, jumpForce, 0));
  }
});

var light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

var material = new GridMaterial("grid", scene);

function addBox(
  width: number,
  height: number,
  depth: number,
  x: number,
  z: number
) {
  var box1 = CreateBox(
    "box1",
    { width: width, height: height, depth: depth },
    scene
  );
  box1.position = new Vector3(x, height / 2, z);
  box1.material = material;
  box1.physicsImpostor = new PhysicsImpostor(
    box1,
    PhysicsImpostor.BoxImpostor,
    { mass: 0 },
    scene
  );
}

addBox(10, 30, 7, 30, 10);
addBox(4, 8, 4, 24, 19);
addBox(4, 14, 2, 15, 28);
addBox(2, 20, 4, 15, 20);
addBox(8, 40, 8, 10, 40);

var ground = CreateGround(
  "ground1",
  { width: 80, height: 80, subdivisions: 2 },
  scene
);
ground.material = material;
ground.physicsImpostor = new PhysicsImpostor(
  ground,
  PhysicsImpostor.BoxImpostor,
  { mass: 0 },
  scene
);

player.physicsImpostor.registerBeforePhysicsStep((impostor) => {
  impostor.setAngularVelocity(Vector3.Zero());
});

player.physicsImpostor.registerOnPhysicsCollide(
  (scene.getPhysicsEngine()! as PhysicsEngine).getImpostors(),
  (collider, collidedWith) => {
    const contactNormal = collider.object.position.subtract(
      collidedWith.object.position
    );
    if (contactNormal.y > 0) {
      canJump = true;
    }
  }
);

engine.runRenderLoop(() => {
  scene.render();
});

canvas.addEventListener("click", () => {
  canvas.requestPointerLock();
});

window.addEventListener("resize", () => {
  engine.resize();
});
