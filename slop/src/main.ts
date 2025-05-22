import {
  CharacterSupportedState,
  Color3,
  Engine,
  HavokPlugin,
  HemisphericLight,
  IBasePhysicsCollisionEvent,
  KeyboardEventTypes,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsBody,
  PhysicsCharacterController,
  PhysicsEventType,
  PhysicsMotionType,
  PhysicsPrestepType,
  PhysicsShapeType,
  PhysicsViewer,
  Quaternion,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { GridMaterial } from "@babylonjs/materials";

HavokPhysics().then((hp) => {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const hk = new HavokPlugin(false, hp);
  const scene = new Scene(engine);
  const camera = new UniversalCamera("cam", new Vector3(0, 30, -10), scene);
  camera.attachControl();
  camera.minZ = 0;
  const light = new HemisphericLight("light", new Vector3(3, 10, 0), scene);
  light.intensity = 0.5;

  scene.enablePhysics(new Vector3(0, -9.81, 0), hk);

  const ground = MeshBuilder.CreateGround("ground", { width: 32, height: 32 }, scene);
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.1 }, scene);
  const groundMat = new GridMaterial("groundMat", scene);
  groundMat.lineColor = Color3.Teal();
  groundMat.gridRatio = 1;
  ground.material = groundMat;

  const character = MeshBuilder.CreateCapsule("character", { height: 2, radius: 0.5 }, scene);
  character.position = new Vector3(0, 3, 0);
  const characterInputDirection = Vector3.Zero();
  const characterOrientationQuaternion = Quaternion.Zero();
  const characterAirSpeed = 3.0;
  const characterGroundSpeed = 4.0;
  const characterJumpVelocity = 8.0;
  let characterWantJump = false;
  let characterCanJump = false;
  const characterAgg = new PhysicsAggregate(character, PhysicsShapeType.CAPSULE, { mass: 3, friction: 0, restitution: 0 }, scene);
  characterAgg.body.setMassProperties({
    inertia: Vector3.ZeroReadOnly,
  });

  const characterFeet = MeshBuilder.CreateSphere("characterFeet", { diameter: 0.05 }, scene);
  characterFeet.position = new Vector3(0, -1.5);
  const characterFeetMat = new StandardMaterial("characterFeetMat", scene);
  characterFeetMat.diffuseColor = Color3.Red();
  characterFeet.material = characterFeetMat;
  const characterFeetAgg = new PhysicsAggregate(characterFeet, PhysicsShapeType.SPHERE, { mass: 0 }, scene);
  characterFeetAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
  characterFeetAgg.body.disablePreStep = false;
  characterFeetAgg.shape.isTrigger = true;

  const block = MeshBuilder.CreateBox("block", { size: 7 }, scene);
  block.position = new Vector3(0, 3.5, 5);
  new PhysicsAggregate(block, PhysicsShapeType.BOX, { mass: 0, friction: 0.1, restitution: 0.1 }, scene);
  const blockMat = new GridMaterial("blockMat", scene);
  blockMat.lineColor = Color3.Yellow();
  blockMat.gridRatio = 0.5;
  block.material = blockMat;

  const platform = MeshBuilder.CreateBox("platform", { width: 2, height: 0.5, depth: 2 }, scene);
  platform.position = new Vector3(4.5, 0.25, 4.5);
  const platformAgg = new PhysicsAggregate(platform, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
  platformAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platformAgg.body.disablePreStep = false;
  const platformMat = new GridMaterial("platformMat", scene);
  platformMat.lineColor = Color3.Green();
  platformMat.gridRatio = 0.5;
  platform.material = platformMat;
  let platformGoingUp = true;

  function inCollision(ev: IBasePhysicsCollisionEvent, collider: PhysicsBody) {
    return ev.collider === collider || ev.collidedAgainst === collider;
  }

  hk.onTriggerCollisionObservable.add((ev) => {
    if (inCollision(ev, characterFeetAgg.body)) {
      if (!inCollision(ev, characterAgg.body)) {
        if (ev.type === PhysicsEventType.TRIGGER_ENTERED) {
          characterCanJump = true;
        } else if (ev.type === PhysicsEventType.TRIGGER_EXITED) {
          characterCanJump = false;
        }
      }
    }
  });

  const physicsViewer = new PhysicsViewer();
  physicsViewer.showBody(platformAgg.body);

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
    if (scene.deltaTime == undefined) return;
    const deltaTimeS = scene.deltaTime / 1000.0;
    if (deltaTimeS == 0) return;

    camera.position.copyFrom(character.position);
    characterAgg.body.setAngularVelocity(Vector3.ZeroReadOnly);

    characterFeet.position.x = character.position.x;
    characterFeet.position.y = character.position.y - 0.996;
    characterFeet.position.z = character.position.z;
  });

  scene.onAfterPhysicsObservable.add((scene) => {
    if (scene.deltaTime == undefined) return;
    const deltaTimeS = scene.deltaTime / 1000.0;
    if (deltaTimeS == 0) return;

    if (platformGoingUp) {
      if (platformAgg.transformNode.position.y >= 6.75) platformGoingUp = false;
    } else {
      if (platformAgg.transformNode.position.y <= 0.25) platformGoingUp = true;
    }
    platformAgg.body.setTargetTransform(
      new Vector3(platform.position.x, platform.position.y + (platformGoingUp ? 1 : -1) * 0.01, platform.position.z),
      Quaternion.Zero()
    );

    const velocity = characterInputDirection
      .applyRotationQuaternion(Quaternion.FromEulerAnglesToRef(0, camera.rotation.y, 0, characterOrientationQuaternion))
      .normalize()
      .scale(characterCanJump ? characterGroundSpeed : characterAirSpeed);
    velocity.y = characterAgg.body.getLinearVelocity().y;

    if (characterWantJump && characterCanJump) {
      characterCanJump = false;
      velocity.y += characterJumpVelocity;
    }

    characterAgg.body.setLinearVelocity(velocity);
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
});
