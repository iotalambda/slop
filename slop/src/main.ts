import {
  ArcRotateCamera,
  Axis,
  Camera,
  Color3,
  Engine,
  HavokPlugin,
  HemisphericLight,
  IBasePhysicsCollisionEvent,
  KeyboardEventTypes,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsBody,
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
import { AdvancedDynamicTexture, Checkbox, Control, StackPanel, TextBlock } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";
import { GridMaterial } from "@babylonjs/materials";

HavokPhysics().then((hp) => {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const hk = new HavokPlugin(false, hp);
  const scene = new Scene(engine);

  const light = new HemisphericLight("light", new Vector3(3, 10, 0), scene);
  light.intensity = 0.5;

  scene.enablePhysics(new Vector3(0, -9.81, 0), hk);
  const physicsViewer = new PhysicsViewer(scene);

  const quaternionZeroReadonly = Quaternion.Zero();
  const leftHandedForwardX4ReadOnly = Vector3.Forward(false).scaleInPlace(4);

  const ground = MeshBuilder.CreateGround("ground", { width: 32, height: 32 }, scene);
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.5, restitution: 0 }, scene);
  const groundMat = new GridMaterial("groundMat", scene);
  groundMat.lineColor = Color3.Teal();
  groundMat.gridRatio = 1;
  ground.material = groundMat;

  const wasdKeysDown = { w: false, a: false, s: false, d: false };

  const character = MeshBuilder.CreateCapsule("character", { height: 2, radius: 0.5 }, scene);
  character.position = new Vector3(0, 3, 0);
  character.visibility = 0.5;
  const characterWasdDirection = Vector3.Zero();
  const characterWasdVelocity = Vector3.Zero();
  const characterLinearVelocity = Vector3.Zero();
  const characterOrientationQuaternion = Quaternion.Zero();
  const characterJumpImpulse = Vector3.Zero();
  const characterJumpImpulseSize = 7.5;
  const characterWasdMaxSpeed = 4.0;
  let characterWantJump = false;
  let characterCanJump = false;
  const characterAgg = new PhysicsAggregate(character, PhysicsShapeType.CAPSULE, { mass: 1, friction: 1, restitution: 0 }, scene);
  characterAgg.body.setMassProperties({
    ...characterAgg.body.getMassProperties(),
    inertia: new Vector3(99, 99, 99),
  });

  const characterFeet = MeshBuilder.CreateSphere("characterFeet", { diameter: 0.2, segments: 1 }, scene);
  characterFeet.position = new Vector3(0, -1.5);
  const characterFeetMat = new StandardMaterial("characterFeetMat", scene);
  characterFeetMat.diffuseColor = Color3.Red();
  characterFeet.material = characterFeetMat;
  const characterFeetAgg = new PhysicsAggregate(characterFeet, PhysicsShapeType.SPHERE, { mass: 0 }, scene);
  characterFeetAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
  characterFeetAgg.body.disablePreStep = false;
  characterFeetAgg.shape.isTrigger = true;

  let camera: Camera;
  const cameraRotationQuaternion = Quaternion.Zero();
  function replaceWithFirstPersonCamera() {
    if (camera?.isDisposed() === false) {
      camera.dispose();
    }
    const c = new UniversalCamera("cam", new Vector3(0, 30, -10), scene);
    c.rotation.y = characterOrientationQuaternion.toEulerAngles().y;
    c.attachControl();
    c.minZ = 0;
    camera = c;
  }
  function replaceWithArcRotateCamera() {
    if (camera?.isDisposed() === false) {
      camera.dispose();
    }
    const c = new ArcRotateCamera("cam", -characterOrientationQuaternion.toEulerAngles().y - Math.PI / 2, 0.5, 10, characterAgg.transformNode.position, scene);
    c.attachControl();
    c.minZ = 0;
    camera = c;
  }
  character.isVisible = false;
  characterFeet.isVisible = false;
  characterOrientationQuaternion.copyFrom(Quaternion.RotationAxis(Axis.Y, Math.PI / 1.5));
  replaceWithFirstPersonCamera();

  const xyzIndicator = MeshBuilder.CreateSphere("xyzIndicator", { diameter: 0.2, segments: 1 }, scene);
  const xyzIndicatorPositionPrev = xyzIndicator.position.clone();
  const xyzIndicatorMat = new StandardMaterial("xyzIndicatorMat", scene);
  xyzIndicatorMat.diffuseColor = Color3.Blue();
  xyzIndicatorMat.emissiveColor = Color3.Blue();
  xyzIndicator.material = xyzIndicatorMat;
  xyzIndicator.setEnabled(false);

  const xyzIndicatorInfo = MeshBuilder.CreatePlane("xyzIndicatorInfo", { width: 3, height: 1.5 }, scene);
  xyzIndicatorInfo.renderingGroupId = 1;
  xyzIndicatorInfo.parent = xyzIndicator;
  xyzIndicatorInfo.rotationQuaternion = cameraRotationQuaternion;
  const xyzIndicatorInfoTxt = AdvancedDynamicTexture.CreateForMesh(xyzIndicatorInfo, 3 * 256, 1.5 * 256);
  const xyzIndicatorInfoTxtTextBlock = new TextBlock("xyz", "xyz");
  xyzIndicatorInfoTxtTextBlock.fontSizeInPixels = 64;
  xyzIndicatorInfoTxtTextBlock.color = "blue";
  xyzIndicatorInfoTxtTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  xyzIndicatorInfoTxtTextBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  xyzIndicatorInfoTxt.addControl(xyzIndicatorInfoTxtTextBlock);

  const block = MeshBuilder.CreateBox("block", { size: 7 }, scene);
  block.position = new Vector3(0, 3.5, 5);
  new PhysicsAggregate(block, PhysicsShapeType.BOX, { mass: 0, friction: 1, restitution: 0 }, scene);
  const blockMat = new GridMaterial("blockMat", scene);
  blockMat.lineColor = Color3.Yellow();
  blockMat.gridRatio = 0.5;
  block.material = blockMat;

  const platform1 = MeshBuilder.CreateBox("platform1", { width: 2, height: 0.5, depth: 2 }, scene);
  platform1.position = new Vector3(4.5, 0.25, 4.5);
  const platform1Agg = new PhysicsAggregate(platform1, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
  platform1Agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platform1Agg.body.disablePreStep = false;
  const platform1Mat = new GridMaterial("platform1Mat", scene);
  platform1Mat.lineColor = Color3.Green();
  platform1Mat.gridRatio = 0.5;
  platform1.material = platform1Mat;
  let platform1GoingUp = true;
  const platform1Transform = Vector3.Zero();

  const platform2 = MeshBuilder.CreateBox("platform2", { width: 2, height: 0.5, depth: 2 }, scene);
  platform2.position = new Vector3(8.5, 0.25, 4.5);
  const platform2Agg = new PhysicsAggregate(platform2, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
  platform2Agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platform2Agg.body.disablePreStep = false;
  const platform2Mat = new GridMaterial("platform2Mat", scene);
  platform2Mat.lineColor = Color3.Purple();
  platform2Mat.gridRatio = 0.5;
  platform2.material = platform2Mat;
  let platform2GoingUp = true;
  const platform2Transform = Vector3.Zero();

  const box1 = MeshBuilder.CreateBox("box1", { width: 2, height: 0.5, depth: 2 }, scene);
  box1.position = new Vector3(-4, 10, -7);
  const box1Agg = new PhysicsAggregate(box1, PhysicsShapeType.BOX, { mass: 5, friction: 0.4, restitution: 0 }, scene);

  const box2 = MeshBuilder.CreateBox("box2", { width: 2, height: 0.5, depth: 2 }, scene);
  box2.position = new Vector3(-4, 15, -7);
  const box2Agg = new PhysicsAggregate(box2, PhysicsShapeType.BOX, { mass: 5, friction: 0.4, restitution: 0 }, scene);

  const platform3 = MeshBuilder.CreateCylinder("platform3", { diameter: 5, height: 0.5, tessellation: 8 }, scene);
  platform3.position = new Vector3(10, 0.25, -7);
  const platform3Agg = new PhysicsAggregate(platform3, PhysicsShapeType.CYLINDER, { mass: 0, friction: 10 }, scene);
  platform3Agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platform3Agg.body.setPrestepType(PhysicsPrestepType.ACTION);
  const platform3Mat = new GridMaterial("platform3Mat", scene);
  platform3Mat.lineColor = Color3.Red();
  platform3Mat.gridRatio = 0.5;
  platform3.material = platform3Mat;
  // physicsViewer.showBody(platform3Agg.body);

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

  const debugGui = AdvancedDynamicTexture.CreateFullscreenUI("gui", true, scene);

  const debugPanel = new StackPanel();
  debugPanel.widthInPixels = 200;
  debugPanel.isVertical = true;
  debugPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  debugPanel.paddingTop = "10px";
  debugGui.addControl(debugPanel);

  const debugToggleCameraPanel = new StackPanel();
  debugToggleCameraPanel.widthInPixels = 200;
  debugToggleCameraPanel.heightInPixels = 30;
  debugToggleCameraPanel.isVertical = false;
  debugToggleCameraPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  debugToggleCameraPanel.paddingLeftInPixels = 5;
  debugPanel.addControl(debugToggleCameraPanel);
  const debugToggleCameraCheckbox = new Checkbox("toggleCameraCheckbox");
  debugToggleCameraCheckbox.color = "white";
  debugToggleCameraCheckbox.fontSize = 20;
  debugToggleCameraCheckbox.isChecked = false;
  debugToggleCameraCheckbox.widthInPixels = 20;
  debugToggleCameraCheckbox.heightInPixels = 20;
  debugToggleCameraCheckbox.onIsCheckedChangedObservable.add((v, ev) => {
    ev.skipNextObservers = true;
    if (v) {
      character.isVisible = true;
      characterFeet.isVisible = true;
      replaceWithArcRotateCamera();
    } else {
      character.isVisible = false;
      characterFeet.isVisible = false;
      replaceWithFirstPersonCamera();
    }
  });
  debugToggleCameraPanel.addControl(debugToggleCameraCheckbox);
  const debugToggleCameraTextBlock = new TextBlock("toggleCameraTextBlock", "ArcRotateCam");
  debugToggleCameraTextBlock.heightInPixels = 30;
  debugToggleCameraTextBlock.color = "white";
  debugToggleCameraTextBlock.fontSize = 20;
  debugToggleCameraTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugToggleCameraTextBlock.paddingLeftInPixels = 5;
  debugToggleCameraPanel.addControl(debugToggleCameraTextBlock);

  const debugToggleXYZIndicatorPanel = new StackPanel();
  debugToggleXYZIndicatorPanel.widthInPixels = 200;
  debugToggleXYZIndicatorPanel.heightInPixels = 30;
  debugToggleXYZIndicatorPanel.isVertical = false;
  debugToggleXYZIndicatorPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  debugToggleXYZIndicatorPanel.paddingLeftInPixels = 5;
  debugPanel.addControl(debugToggleXYZIndicatorPanel);
  const debugToggleXYZIndicatorCheckbox = new Checkbox("toggleXYZIndicatorCheckbox");
  debugToggleXYZIndicatorCheckbox.color = "white";
  debugToggleXYZIndicatorCheckbox.fontSize = 20;
  debugToggleXYZIndicatorCheckbox.isChecked = xyzIndicator.isEnabled();
  debugToggleXYZIndicatorCheckbox.widthInPixels = 20;
  debugToggleXYZIndicatorCheckbox.heightInPixels = 20;
  debugToggleXYZIndicatorCheckbox.onIsCheckedChangedObservable.add((v, ev) => {
    ev.skipNextObservers = true;
    xyzIndicator.setEnabled(v);
  });
  debugToggleXYZIndicatorPanel.addControl(debugToggleXYZIndicatorCheckbox);
  const debugToggleXYZIndicatorTextBlock = new TextBlock("toggleXYZIndixatorTextBlock", "XyzIndicator");
  debugToggleXYZIndicatorTextBlock.heightInPixels = 30;
  debugToggleXYZIndicatorTextBlock.color = "white";
  debugToggleXYZIndicatorTextBlock.fontSize = 20;
  debugToggleXYZIndicatorTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugToggleXYZIndicatorTextBlock.paddingLeftInPixels = 5;
  debugToggleXYZIndicatorPanel.addControl(debugToggleXYZIndicatorTextBlock);

  const debugGuiTextBlock1 = new TextBlock("debug1", "debug1");
  debugGuiTextBlock1.height = "30px";
  debugGuiTextBlock1.color = "white";
  debugGuiTextBlock1.fontSize = 20;
  debugGuiTextBlock1.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugPanel.addControl(debugGuiTextBlock1);

  const debugGuiFpsTextBlock = new TextBlock("fps", "fps");
  debugGuiFpsTextBlock.height = "30px";
  debugGuiFpsTextBlock.color = "white";
  debugGuiFpsTextBlock.fontSize = 20;
  debugGuiFpsTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugPanel.addControl(debugGuiFpsTextBlock);

  function createThrottler(ms: number) {
    let endAtMs: number | undefined;
    return function (): boolean {
      if (!endAtMs) {
        endAtMs = Date.now() + ms;
      }
      if (Date.now() > endAtMs) {
        endAtMs = undefined;
        return true;
      }
      return false;
    };
  }

  const onBeforeRenderObservableEveryQrtrSecond = createThrottler(250);
  const onBeforeRenderObservableEveryHalfSecond = createThrottler(500);
  scene.onBeforeRenderObservable.add((scene) => {
    if (scene.deltaTime == undefined) return;
    const deltaTimeS = scene.deltaTime / 1000.0;
    if (deltaTimeS == 0) return;

    camera.position.copyFrom(character.position);
    characterAgg.body.setAngularVelocity(Vector3.ZeroReadOnly);

    characterFeet.position.x = character.position.x;
    characterFeet.position.y = character.position.y - 0.996;
    characterFeet.position.z = character.position.z;

    let cameraPitch: number;
    let cameraYaw: number;
    if (camera instanceof UniversalCamera) {
      cameraPitch = camera.rotation.x;
      cameraYaw = camera.rotation.y;
    } else if (camera instanceof ArcRotateCamera) {
      cameraPitch = -camera.beta + Math.PI / 2;
      cameraYaw = -camera.alpha - Math.PI / 2;
    } else {
      throw Error("SLOP: Camera not supported");
    }

    Quaternion.FromEulerAnglesToRef(cameraPitch, cameraYaw, 0, cameraRotationQuaternion);
    Quaternion.FromEulerAnglesToRef(0, cameraYaw, 0, characterOrientationQuaternion);

    if (onBeforeRenderObservableEveryQrtrSecond()) {
      if (xyzIndicator.isEnabled()) {
        xyzIndicator.position.copyFrom(character.position);
        xyzIndicator.position.addInPlace(leftHandedForwardX4ReadOnly);
        xyzIndicator.position.rotateByQuaternionAroundPointToRef(cameraRotationQuaternion, character.position, xyzIndicator.position);
        xyzIndicator.position.x = Math.round(xyzIndicator.position.x);
        xyzIndicator.position.y = Math.round(xyzIndicator.position.y);
        xyzIndicator.position.z = Math.round(xyzIndicator.position.z);
        if (!xyzIndicatorPositionPrev.equals(xyzIndicator.position)) {
          xyzIndicatorPositionPrev.copyFrom(xyzIndicator.position);
          xyzIndicatorInfoTxtTextBlock.text = `X:${xyzIndicator.position.x}, Y:${xyzIndicator.position.y}, Z:${xyzIndicator.position.z}`;
        }
      }
    }

    if (onBeforeRenderObservableEveryHalfSecond()) {
      debugGuiFpsTextBlock.text = `FPS: ${Math.round(engine.getFps())}`;
    }
  });

  const onAfterPhysicsObservableEvery50Ms = createThrottler(50);
  scene.onAfterPhysicsObservable.add((scene) => {
    if (platform1GoingUp) {
      if (platform1Agg.transformNode.position.y >= 6.75) platform1GoingUp = false;
    } else {
      if (platform1Agg.transformNode.position.y <= 0.25) platform1GoingUp = true;
    }
    platform1Agg.body.setTargetTransform(
      platform1Transform.set(platform1.position.x, platform1.position.y + (platform1GoingUp ? 1 : -1) * 0.01, platform1.position.z),
      quaternionZeroReadonly
    );

    if (platform2GoingUp) {
      if (platform2Agg.transformNode.position.y >= 6.75) platform2GoingUp = false;
    } else {
      if (platform2Agg.transformNode.position.y <= 0.25) platform2GoingUp = true;
    }
    platform2Agg.body.setTargetTransform(
      platform2Transform.set(platform2.position.x, platform2.position.y + (platform2GoingUp ? 6 * platform2.position.y : -1) * 0.01, platform2.position.z),
      quaternionZeroReadonly
    );

    platform3.addRotation(0, 0.05, 0);

    characterWasdDirection.applyRotationQuaternionToRef(characterOrientationQuaternion, characterWasdVelocity).normalize(); // characterWasdVelocity has still an intermediate value, not the final one
    if (characterWantJump && characterCanJump) {
      characterJumpImpulse.copyFrom(Vector3.UpReadOnly).scaleInPlace(characterJumpImpulseSize);
      characterAgg.body.applyImpulse(characterJumpImpulse, character.position);
      characterCanJump = false;
    }

    if (onAfterPhysicsObservableEvery50Ms()) {
      characterAgg.body.getLinearVelocityToRef(characterLinearVelocity);
      if (Math.sqrt(Math.pow(characterLinearVelocity.x, 2) + Math.pow(characterLinearVelocity.z, 2)) < characterWasdMaxSpeed) {
        characterAgg.body.applyImpulse(characterWasdVelocity, character.position);
      }
    }
  });

  scene.onKeyboardObservable.add((k) => {
    switch (k.type) {
      case KeyboardEventTypes.KEYDOWN:
        switch (k.event.key) {
          case "w":
          case "W":
            characterWasdDirection.z = 1;
            wasdKeysDown.w = true;
            break;
          case "s":
          case "S":
            characterWasdDirection.z = -1;
            wasdKeysDown.s = true;
            break;
          case "a":
          case "A":
            characterWasdDirection.x = -1;
            wasdKeysDown.a = true;
            break;
          case "d":
          case "D":
            characterWasdDirection.x = 1;
            wasdKeysDown.d = true;
            break;
          case " ":
            characterWantJump = true;
            break;
          case "§":
            if (Inspector.IsVisible) {
              Inspector.Hide();
            } else {
              Inspector.Show(scene, { embedMode: true });
            }
        }
        break;
      case KeyboardEventTypes.KEYUP:
        switch (k.event.key) {
          case "w":
          case "W":
            wasdKeysDown.w = false;
            characterWasdDirection.z = wasdKeysDown.s ? -1 : 0;
            break;
          case "s":
          case "S":
            wasdKeysDown.s = false;
            characterWasdDirection.z = wasdKeysDown.w ? 1 : 0;
            break;
          case "a":
          case "A":
            wasdKeysDown.a = false;
            characterWasdDirection.x = wasdKeysDown.d ? 1 : 0;
            break;
          case "d":
          case "D":
            wasdKeysDown.d = false;
            characterWasdDirection.x = wasdKeysDown.a ? -1 : 0;
            break;
          case " ":
            characterWantJump = false;
            break;
        }
    }
  });

  scene.onPointerObservable.add((p) => {
    if (p.event.button === 0) {
      if (!engine.isPointerLock) {
        engine.enterPointerlock();
      }
    }
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });

  engine.runRenderLoop(() => {
    scene.render();
  });
});
