import {
  CharacterSupportedState,
  Color3,
  Engine,
  HavokPlugin,
  HemisphericLight,
  KeyboardEventTypes,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsCharacterController,
  PhysicsShapeType,
  Quaternion,
  Scene,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { GridMaterial } from "@babylonjs/materials";

const hp = await HavokPhysics();
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const hk = new HavokPlugin(false, hp);
const scene = new Scene(engine);
const camera = new UniversalCamera("cam", new Vector3(0, 30, -10), scene);
camera.attachControl();
const light = new HemisphericLight("light", new Vector3(3, 10, 0), scene);
light.intensity = 0.5;

scene.enablePhysics(new Vector3(0, -9.81, 0), hk);

const ground = MeshBuilder.CreateGround("ground", { width: 32, height: 32 }, scene);
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
const groundMat = new GridMaterial("groundMat", scene);
groundMat.lineColor = Color3.Teal();
groundMat.gridRatio = 1;
ground.material = groundMat;
ground.material.cullBackFaces = true;

const characterGravity = new Vector3(0, -9.81, 0);
const characterInputDirection = Vector3.Zero();
const characterOrientationQuaternion = Quaternion.Zero();
const characterAirSpeed = 7.0;
const characterGroundSpeed = 8.0;
let characterWantJump = false;
const characterJumpHeight = 3.0;
const characterJumpStartVelocityY = Math.sqrt(2 * characterGravity.length() * characterJumpHeight);

const characterController = new PhysicsCharacterController(new Vector3(0, 30, 0), { capsuleHeight: 2, capsuleRadius: 0.5 }, scene);

const debugGui = AdvancedDynamicTexture.CreateFullscreenUI("ui", true, scene);
const debugGuiTextBlock1 = new TextBlock("debug1", "debug1");
debugGuiTextBlock1.fontSize = 24;
debugGuiTextBlock1.top = -300;
debugGuiTextBlock1.left = -500;
debugGuiTextBlock1.color = "white";
debugGui.addControl(debugGuiTextBlock1);
const debugGuiTextBlock2 = new TextBlock("debug2", "debug2");
debugGuiTextBlock2.fontSize = 24;
debugGuiTextBlock2.top = -270;
debugGuiTextBlock2.left = -500;
debugGuiTextBlock2.color = "white";
debugGui.addControl(debugGuiTextBlock2);

scene.onBeforeRenderObservable.add((scene) => {
  const characterPosition = characterController.getPosition();
  camera.position.copyFrom(characterPosition);
});

scene.onAfterPhysicsObservable.add((scene) => {
  if (scene.deltaTime == undefined) return;
  const dt = scene.deltaTime / 1000.0;
  if (dt == 0) return;

  const surfaceInfo = characterController.checkSupport(dt, Vector3.DownReadOnly);
  let velocity: Vector3;
  const currVelocity = characterController.getVelocity();

  if (surfaceInfo.supportedState === CharacterSupportedState.UNSUPPORTED) {
    const inputDesiredVelocity = characterInputDirection
      .scale(characterAirSpeed)
      .applyRotationQuaternion(Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, characterOrientationQuaternion));
    velocity = characterController.calculateMovement(
      dt,
      Vector3.RightHandedForwardReadOnly,
      Vector3.UpReadOnly,
      currVelocity,
      Vector3.ZeroReadOnly,
      inputDesiredVelocity,
      Vector3.UpReadOnly
    );
    velocity.y += currVelocity.y - velocity.y;
    velocity.y += characterGravity.y * dt;
  } else {
    if (characterWantJump) {
      currVelocity.y = characterJumpStartVelocityY;
      velocity = currVelocity;
    } else {
      const inputDesiredVelocity = characterInputDirection
        .scale(characterGroundSpeed)
        .applyRotationQuaternion(Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, characterOrientationQuaternion));
      velocity = characterController.calculateMovement(
        dt,
        Vector3.RightHandedForwardReadOnly,
        surfaceInfo.averageSurfaceNormal,
        currVelocity,
        surfaceInfo.averageSurfaceVelocity,
        inputDesiredVelocity,
        Vector3.UpReadOnly
      );
      velocity.addInPlace(surfaceInfo.averageSurfaceVelocity);
    }
  }
  characterController.setVelocity(velocity);
  characterController.integrate(dt, surfaceInfo, characterGravity);
});

scene.onKeyboardObservable.add((k) => {
  switch (k.type) {
    case KeyboardEventTypes.KEYDOWN:
      switch (k.event.key) {
        case "w":
        case "W":
          characterInputDirection.z = 1;
          break;
        case "s":
        case "S":
          characterInputDirection.z = -1;
          break;
        case "a":
        case "A":
          characterInputDirection.x = -1;
          break;
        case "d":
        case "D":
          characterInputDirection.x = 1;
          break;
        case " ":
          characterWantJump = true;
          break;
      }
      break;
    case KeyboardEventTypes.KEYUP:
      switch (k.event.key) {
        case "w":
        case "W":
        case "s":
        case "S":
          characterInputDirection.z = 0;
          break;
        case "a":
        case "A":
        case "d":
        case "D":
          characterInputDirection.x = 0;
          break;
        case " ":
          characterWantJump = false;
          break;
      }
  }
});

canvas.addEventListener("click", () => {
  if (!engine.isPointerLock) {
    engine.enterPointerlock();
  }
});

engine.runRenderLoop(() => {
  scene.render();
});
