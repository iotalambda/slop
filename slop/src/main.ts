import {
  CharacterSupportedState,
  Color3,
  Engine,
  HavokPlugin,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsCharacterController,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";

const hp = await HavokPhysics();
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const hk = new HavokPlugin(false, hp);
const scene = new Scene(engine);
const camera = new UniversalCamera("cam", new Vector3(0, 30, -10), scene);
camera.setTarget(new Vector3(0, 15, 0));
camera.attachControl();
const light = new HemisphericLight("light", new Vector3(3, 10, 0), scene);
light.intensity = 0.5;

scene.enablePhysics(new Vector3(0, -9.81, 0), hk);

const ground = MeshBuilder.CreateGround("ground", { width: 32, height: 32 }, scene);
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
const groundMat = new StandardMaterial("groundMat", scene);
groundMat.diffuseColor = Color3.Green();
ground.material = groundMat;

const characterGravity = new Vector3(0, -9.81, 0);

const characterCapsule = MeshBuilder.CreateCapsule(
  "character",
  {
    height: 2,
    radius: 0.5,
  },
  scene
);
const characterController = new PhysicsCharacterController(new Vector3(0, 30, 0), { capsuleHeight: 2, capsuleRadius: 0.5 }, scene);

const debugGui = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
const debugGuiTextBlock1 = new TextBlock("debug1", "...");
debugGuiTextBlock1.fontSize = 24;
debugGuiTextBlock1.top = -300;
debugGuiTextBlock1.left = -500;
debugGuiTextBlock1.color = "white";
debugGui.addControl(debugGuiTextBlock1);
const debugGuiTextBlock2 = new TextBlock("debug2", "...");
debugGuiTextBlock2.fontSize = 24;
debugGuiTextBlock2.top = -270;
debugGuiTextBlock2.left = -500;
debugGuiTextBlock2.color = "white";
debugGui.addControl(debugGuiTextBlock2);

scene.onBeforeRenderObservable.add((scene) => {
  characterCapsule.position.copyFrom(characterController.getPosition());
});

scene.onAfterRenderObservable.add((scene) => {
  if (scene.deltaTime == undefined) return;
  const dt = scene.deltaTime / 1000.0;
  if (dt == 0) return;

  const support = characterController.checkSupport(dt, Vector3.DownReadOnly);
  let velocity: Vector3;
  const prevVelocity = characterController.getVelocity();
  if (support.supportedState === CharacterSupportedState.UNSUPPORTED) {
    velocity = characterController.calculateMovement(
      dt,
      Vector3.RightHandedForwardReadOnly,
      Vector3.UpReadOnly,
      prevVelocity,
      Vector3.ZeroReadOnly,
      Vector3.ZeroReadOnly,
      Vector3.UpReadOnly
    );
    velocity.addInPlace(Vector3.UpReadOnly.scale(-velocity.dot(Vector3.UpReadOnly)));
    velocity.addInPlace(Vector3.UpReadOnly.scale(prevVelocity.dot(Vector3.UpReadOnly)));
    velocity.addInPlace(characterGravity.scale(dt));
  } else {
    velocity = Vector3.ZeroReadOnly;
  }
  characterController.setVelocity(velocity);
  characterController.integrate(dt, support, characterGravity);
  debugGuiTextBlock1.text = `${velocity.x.toPrecision(2)},${velocity.y.toPrecision(2)},${velocity.z.toPrecision(2)}`;
});

engine.runRenderLoop(() => {
  scene.render();
});
