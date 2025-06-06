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
  PhysicsShapeContainer,
  PhysicsShapeCylinder,
  PhysicsShapeType,
  PhysicsViewer,
  Quaternion,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Button, Checkbox, Control, Grid, InputText, RadioButton, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";
import { GridMaterial } from "@babylonjs/materials";
import { initMLCEngineOrFalse, SLOP_LLM_MLCMODELS, SlopLLM, SlopLLMMLCModel } from "./slop-llm";
import { SlopTool } from "./slop-tool";

HavokPhysics().then((hp) => {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const hkTimeStep = 1 / 30;
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 9999 });
  const hk = new HavokPlugin(false, hp);
  const scene = new Scene(engine);
  scene.enablePhysics(new Vector3(0, -9.81, 0), hk);
  hk.setTimeStep(hkTimeStep);
  const physicsViewer = new PhysicsViewer(scene);

  const light = new HemisphericLight("light", new Vector3(3, 10, 0), scene);
  light.intensity = 0.5;

  const quaternionZeroReadonly = Quaternion.Zero();
  const leftHandedForwardX4ReadOnly = Vector3.Forward(false).scaleInPlace(4);

  const ground = MeshBuilder.CreateGround("ground", { width: 64, height: 64 }, scene);
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.5, restitution: 0 }, scene);
  const groundMat = new GridMaterial("groundMat", scene);
  groundMat.lineColor = Color3.Teal();
  groundMat.gridRatio = 1;
  groundMat.backFaceCulling = false;
  ground.material = groundMat;

  const wasdKeysDown = { w: false, a: false, s: false, d: false };

  const characterDiameter = 0.9;
  const character = MeshBuilder.CreateCylinder("character", { diameter: characterDiameter, height: 1.8 }, scene);
  character.position = new Vector3(9, 13, 5);
  character.setPivotPoint(new Vector3(0, -0.2, 0));
  character.visibility = 0.5;
  const characterWasdDirectionLocal = Vector3.Zero();
  const characterWasdDirectionWorld = Vector3.Zero();
  const characterLinearVelocity = Vector3.Zero();
  const characterLinearVelocityXZ = Vector3.Zero();
  const characterLinearVelocityXZMinusWasdVelocity = Vector3.Zero();
  const characterOrientationQuaternion = Quaternion.Zero();
  const characterRotation = character.rotation;
  const characterJumpImpulse = Vector3.Zero();
  const characterJumpImpulseSize = 9.0;
  const characterWasdMaxSpeed = 5.0;
  const characterInertiaXZUprightGround = 999999;
  const characterInertiaXZAirOrFallen = 9;
  const characterInertiaYNotOnAnimated = 999;
  const characterInertiaYOnAnimated = 0.01;
  let characterWantJump = false;
  let characterCanJump = false;
  let characterOnJumpablePlatform = false;
  let characterMsSinceJump = 0;
  let characterDisableWasd = false;
  const characterMinMsBetweenJumps = 500;
  const characterStepImpulseSize = 1.2;
  const characterShpCtr = new PhysicsShapeContainer(scene);
  characterShpCtr.material = { ...characterShpCtr.material, friction: 0 };
  const characterShp = PhysicsShapeCylinder.FromMesh(character);
  characterShp.material = { ...characterShp.material, friction: 0 };
  characterShpCtr.addChild(characterShp);
  const characterAgg = new PhysicsAggregate(character, characterShpCtr, { mass: 1, restitution: 0 }, scene);
  characterAgg.body.setMassProperties({
    ...characterAgg.body.getMassProperties(),
    inertia: new Vector3(characterInertiaXZUprightGround, characterInertiaYOnAnimated, characterInertiaXZUprightGround),
  });
  characterAgg.body.setLinearDamping(0.15);
  characterAgg.body.setAngularDamping(0.5);

  const characterShoesShp = new PhysicsShapeCylinder(new Vector3(0, 0, 0), new Vector3(0, -1.0, 0), characterDiameter * 0.4, scene);
  characterShoesShp.material = { ...characterShoesShp.material, friction: 1 };
  characterShpCtr.addChild(characterShoesShp);

  const characterFeet = MeshBuilder.CreateCylinder("characterFeet", { diameter: characterDiameter * 0.16, height: 1.25 }, scene);
  const characterFeetY = -0.6;
  characterFeet.position = new Vector3(0, characterFeetY);
  const characterFeetMat = new StandardMaterial("characterFeetMat", scene);
  characterFeetMat.diffuseColor = Color3.Red();
  characterFeet.material = characterFeetMat;
  const characterFeetAgg = new PhysicsAggregate(characterFeet, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
  characterFeetAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
  characterFeetAgg.body.disablePreStep = false;
  characterFeetAgg.shape.isTrigger = true;

  let camera: Camera;
  const cameraRotationQuaternion = Quaternion.Zero();
  const cameraInitFirstPerson = false;
  function replaceWithFirstPersonCamera() {
    if (camera?.isDisposed() === false) {
      camera.dispose();
    }
    const c = new UniversalCamera("cam", Vector3.Zero(), scene);
    c.rotation.y = characterOrientationQuaternion.toEulerAngles().y - character.rotation.y;
    c.attachControl();
    c.minZ = 0;
    c.parent = character;
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
  if (cameraInitFirstPerson) {
    character.isVisible = false;
    characterFeet.isVisible = false;
    characterOrientationQuaternion.copyFrom(Quaternion.RotationAxis(Axis.Y, Math.PI / 1.5));
    replaceWithFirstPersonCamera();
  } else {
    character.isVisible = true;
    characterFeet.isVisible = true;
    replaceWithArcRotateCamera();
  }

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
  new PhysicsAggregate(block, PhysicsShapeType.BOX, { mass: 0, friction: 0.8, restitution: 0 }, scene);
  const blockMat = new GridMaterial("blockMat", scene);
  blockMat.lineColor = Color3.Yellow();
  blockMat.gridRatio = 0.5;
  block.material = blockMat;

  for (let i = 0; i < 10; i++) {
    const slope = MeshBuilder.CreateBox(`slope${i}`, { width: 24, height: 0.5, depth: 3 }, scene);
    slope.position = new Vector3(-28, 1, -5 + 4 * i);
    slope.rotation.set(0, 0, -0.2 + -0.15 * i);
    const slopeMat = new GridMaterial(`slope${i}Mat`, scene);
    slopeMat.lineColor = Color3.White();
    slopeMat.gridRatio = 0.5;
    slope.material = slopeMat;
    const slopeAgg = new PhysicsAggregate(slope, PhysicsShapeType.BOX, { mass: 0, friction: 0.6, restitution: 0 });
  }

  const platform1 = MeshBuilder.CreateBox("platform1", { width: 2, height: 0.5, depth: 2 }, scene);
  platform1.position = new Vector3(4.5, 0.25, 4.5);
  const platform1Agg = new PhysicsAggregate(platform1, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
  platform1Agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platform1.physicsBody?.setLinearVelocity(Vector3.Up());
  const platform1Mat = new GridMaterial("platform1Mat", scene);
  platform1Mat.lineColor = Color3.Green();
  platform1Mat.gridRatio = 0.5;
  platform1.material = platform1Mat;
  let platform1GoingUp = true;

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

  const box1 = MeshBuilder.CreateBox("box1", { width: 0.5, height: 4.5, depth: 0.5 }, scene);
  box1.position = new Vector3(-4, 3, -7);
  const box1Agg = new PhysicsAggregate(box1, PhysicsShapeType.BOX, { mass: 2, friction: 0.4, restitution: 0 }, scene);
  const box1Mat = new StandardMaterial("box1Mat", scene);
  box1Mat.diffuseColor = new Color3(1, 0.5, 0);
  box1.material = box1Mat;

  const box2 = MeshBuilder.CreateBox("box2", { width: 2, height: 2, depth: 2 }, scene);
  box2.position = new Vector3(-4, 10, -7);
  const box2Agg = new PhysicsAggregate(box2, PhysicsShapeType.BOX, { mass: 2, friction: 0.4, restitution: 0 }, scene);
  const box2Mat = new StandardMaterial("box2Mat", scene);
  box2Mat.diffuseColor = new Color3(0, 0.5, 0);
  box2.material = box2Mat;

  // for (let i = 0; i < 500; i++) {
  //   const boxN = MeshBuilder.CreateSphere(`box${i}`, { diameter: 3 }, scene);
  //   boxN.position = new Vector3(-8 + 0.01 * (i % 2), 0.5 + i * 10, -8);
  //   const boxNAgg = new PhysicsAggregate(boxN, PhysicsShapeType.SPHERE, { mass: 0.2, friction: 0.4, restitution: 0 }, scene);
  //   const boxNMat = new StandardMaterial(`box${i}Mat`, scene);
  //   boxNMat.diffuseColor = new Color3(0, 0.5, 0);
  //   boxN.material = boxNMat;
  // }

  const platform3 = MeshBuilder.CreateCylinder("platform3", { diameter: 10, height: 0.5, tessellation: 8 }, scene);
  platform3.position = new Vector3(10, 2.25, -7);
  const platform3Agg = new PhysicsAggregate(platform3, PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.9 }, scene);
  platform3Agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  platform3Agg.body.setPrestepType(PhysicsPrestepType.ACTION);
  const platform3Mat = new GridMaterial("platform3Mat", scene);
  platform3Mat.lineColor = Color3.Red();
  platform3Mat.gridRatio = 0.5;
  platform3.material = platform3Mat;
  let platform3Clockwise = true;
  let platform3Acc = 0;

  function inCollision(ev: IBasePhysicsCollisionEvent, collider: PhysicsBody) {
    return ev.collider === collider || ev.collidedAgainst === collider;
  }

  function getOtherInCollision(ev: IBasePhysicsCollisionEvent, collider: PhysicsBody) {
    if (ev.collider === collider) return ev.collidedAgainst;
    return ev.collider;
  }

  let platformCounter = 0;
  let animatedPlatformCounter = 0;
  hk.onTriggerCollisionObservable.add((ev) => {
    if (inCollision(ev, characterFeetAgg.body)) {
      if (!inCollision(ev, characterAgg.body)) {
        if (ev.type === PhysicsEventType.TRIGGER_ENTERED) {
          platformCounter++;
          const other = getOtherInCollision(ev, characterFeetAgg.body);
          if (other.getMotionType() === PhysicsMotionType.ANIMATED) {
            animatedPlatformCounter++;
            if (animatedPlatformCounter === 1) {
              standsOnAnimated = true;
            }
          }
          if (platformCounter === 1) {
            characterOnJumpablePlatform = true;
            characterAgg.body.setMassProperties({
              ...characterAgg.body.getMassProperties(),
              inertia: new Vector3(
                characterInertiaXZUprightGround,
                standsOnAnimated ? characterInertiaYOnAnimated : characterInertiaYNotOnAnimated,
                characterInertiaXZUprightGround
              ),
            });
          }
        } else if (ev.type === PhysicsEventType.TRIGGER_EXITED) {
          platformCounter--;
          const other = getOtherInCollision(ev, characterFeetAgg.body);
          if (platformCounter === 0) {
            characterOnJumpablePlatform = false;
            characterCanJump = false;
            characterAgg.body.setMassProperties({
              ...characterAgg.body.getMassProperties(),
              inertia: new Vector3(characterInertiaXZAirOrFallen, characterInertiaYNotOnAnimated, characterInertiaXZAirOrFallen),
            });
          }
          if (other.getMotionType() === PhysicsMotionType.ANIMATED) {
            animatedPlatformCounter--;
            if (animatedPlatformCounter === 0) {
              standsOnAnimated = false;
              characterAgg.body.setMassProperties({
                ...characterAgg.body.getMassProperties(),
                inertia: new Vector3(
                  characterOnJumpablePlatform ? characterInertiaXZUprightGround : characterInertiaXZAirOrFallen,
                  characterInertiaYNotOnAnimated,
                  characterOnJumpablePlatform ? characterInertiaXZUprightGround : characterInertiaXZAirOrFallen
                ),
              });
            }
          }
        }
      }
    }
  });

  const debugGui = AdvancedDynamicTexture.CreateFullscreenUI("gui", true, scene);

  const debugPanelWidth = 640;
  const debugPanelCheckBoxWidth = 20;
  const debugPanelTextWidth = debugPanelWidth - debugPanelCheckBoxWidth;
  const debugPanel = new StackPanel();
  debugPanel.widthInPixels = debugPanelWidth;
  debugPanel.isVertical = true;
  debugPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  debugPanel.paddingTop = "10px";
  debugGui.addControl(debugPanel);

  const debugToggleCameraPanel = new StackPanel();
  debugToggleCameraPanel.widthInPixels = debugPanelWidth;
  debugToggleCameraPanel.heightInPixels = 30;
  debugToggleCameraPanel.isVertical = false;
  debugToggleCameraPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugToggleCameraPanel.paddingLeftInPixels = 5;
  debugPanel.addControl(debugToggleCameraPanel);
  const debugToggleCameraCheckbox = new Checkbox("toggleCameraCheckbox");
  debugToggleCameraCheckbox.color = "white";
  debugToggleCameraCheckbox.fontSize = 20;
  debugToggleCameraCheckbox.isChecked = !cameraInitFirstPerson;
  debugToggleCameraCheckbox.widthInPixels = debugPanelCheckBoxWidth;
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
  debugToggleCameraTextBlock.widthInPixels = debugPanelTextWidth;
  debugToggleCameraTextBlock.heightInPixels = 30;
  debugToggleCameraTextBlock.color = "white";
  debugToggleCameraTextBlock.fontSize = 20;
  debugToggleCameraTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugToggleCameraTextBlock.paddingLeftInPixels = 5;
  debugToggleCameraPanel.addControl(debugToggleCameraTextBlock);

  const debugToggleXYZIndicatorPanel = new StackPanel();
  debugToggleXYZIndicatorPanel.widthInPixels = debugPanelTextWidth;
  debugToggleXYZIndicatorPanel.heightInPixels = 30;
  debugToggleXYZIndicatorPanel.isVertical = false;
  debugToggleXYZIndicatorPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debugToggleXYZIndicatorPanel.paddingLeftInPixels = 5;
  debugPanel.addControl(debugToggleXYZIndicatorPanel);
  const debugToggleXYZIndicatorCheckbox = new Checkbox("toggleXYZIndicatorCheckbox");
  debugToggleXYZIndicatorCheckbox.color = "white";
  debugToggleXYZIndicatorCheckbox.fontSize = 20;
  debugToggleXYZIndicatorCheckbox.isChecked = xyzIndicator.isEnabled();
  debugToggleXYZIndicatorCheckbox.widthInPixels = debugPanelCheckBoxWidth;
  debugToggleXYZIndicatorCheckbox.heightInPixels = 20;
  debugToggleXYZIndicatorCheckbox.onIsCheckedChangedObservable.add((v, ev) => {
    ev.skipNextObservers = true;
    xyzIndicator.setEnabled(v);
  });
  debugToggleXYZIndicatorPanel.addControl(debugToggleXYZIndicatorCheckbox);
  const debugToggleXYZIndicatorTextBlock = new TextBlock("toggleXYZIndixatorTextBlock", "XyzIndicator");
  debugToggleXYZIndicatorTextBlock.widthInPixels = debugPanelTextWidth;
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

  const promptPanel = new StackPanel();
  promptPanel.widthInPixels = debugPanelWidth;
  promptPanel.isVertical = false;
  promptPanel.height = ".3";
  promptPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  promptPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  debugGui.addControl(promptPanel);

  const localStorageSelectedModel = localStorage.getItem("selectedModel");
  const defaultModel: SlopLLMMLCModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
  let selectedModel: SlopLLMMLCModel = defaultModel;
  if (SLOP_LLM_MLCMODELS.includes(localStorageSelectedModel as any)) {
    selectedModel = localStorageSelectedModel as any;
  }
  async function initPrompt() {
    const slopTool = new SlopTool(scene);
    const slopLLM = new SlopLLM(slopTool);
    async function initSlopLLMWithMLCEngine() {
      promptStateTextBlock.isVisible = true;
      promptInputText.isVisible = false;
      debugGui.update();
      const engineOrFalse = await initMLCEngineOrFalse(selectedModel, (p) => {
        const percentage = Math.round(p.progress * 100);
        if (percentage === 0) {
          promptStateTextBlock.text = `Ensuring ${selectedModel}...`;
        } else if (p.text.includes("Fetching param cache")) {
          promptStateTextBlock.text = `Downloading ${selectedModel}... ${percentage}%`;
        } else {
          promptStateTextBlock.text = `Preparing ${selectedModel}... ${percentage}%`;
        }
        debugGui.update();
      });
      if (engineOrFalse === false) {
        promptStateTextBlock.text =
          "Something went wrong. If you're using Firefox or similar, it did not yet support WebGPU in Service Workers as of June 2025.";
        debugGui.update();
        return false;
      }
      slopLLM.configMLC(engineOrFalse, selectedModel, 4096);
      promptStateTextBlock.isVisible = false;
      promptInputText.isVisible = true;
      debugGui.update();
      return true;
    }
    const promptModalButton = Button.CreateSimpleButton("promptModal", "⚙️");
    promptModalButton.widthInPixels = 33 + 10;
    promptModalButton.heightInPixels = 33 + 10;
    promptModalButton.paddingLeftInPixels = 10;
    promptModalButton.paddingBottomInPixels = 10;
    promptModalButton.color = "white";
    promptModalButton.cornerRadius = 10;
    promptModalButton.background = "black";
    promptModalButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    promptModalButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    promptModalButton.onPointerClickObservable.add(async () => {
      characterDisableWasd = true;
      const promptModalOverlayGui = AdvancedDynamicTexture.CreateFullscreenUI("promptModalOverlay", true, scene);
      const promptModalOverlayGrid = new Grid("promptModalOverlay").addRowDefinition(1).addColumnDefinition(1);
      promptModalOverlayGrid.background = "rgba(0, 0, 0, 0.5)";
      promptModalOverlayGrid.isPointerBlocker = true;
      promptModalOverlayGui.addControl(promptModalOverlayGrid);
      const escapeObs = scene.onKeyboardObservable.add((ev) => {
        if (ev.type === KeyboardEventTypes.KEYDOWN && ev.event.key === "Escape") {
          promptModalOverlayGui.dispose();
        }
      });
      promptModalOverlayGrid.onDisposeObservable.addOnce(() => {
        characterDisableWasd = false;
        escapeObs.remove();
      });
      promptModalOverlayGui.addControl(promptModalOverlayGrid);
      const promptModalRectancle = new Rectangle("promptModal");
      promptModalRectancle.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      promptModalRectancle.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      promptModalRectancle.widthInPixels = 640;
      promptModalRectancle.heightInPixels = 480;
      promptModalRectancle.background = "rgba(0, 0, 0, 0.5)";
      promptModalOverlayGrid.addControl(promptModalRectancle, 0, 0);
      const promptModalTitleTextBlock = new TextBlock("promptModalTitle", "PROMPT SETTINGS");
      promptModalTitleTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      promptModalTitleTextBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      promptModalTitleTextBlock.color = "white";
      promptModalTitleTextBlock.paddingTopInPixels = 16;
      promptModalTitleTextBlock.paddingLeftInPixels = 16;
      promptModalRectancle.addControl(promptModalTitleTextBlock);
      const promptModalCloseButton = Button.CreateSimpleButton("promptModalCloseButton", "❌");
      promptModalCloseButton.widthInPixels = 43;
      promptModalCloseButton.heightInPixels = 43;
      promptModalCloseButton.thickness = 0;
      promptModalCloseButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      promptModalCloseButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      promptModalCloseButton.onPointerClickObservable.addOnce(() => {
        promptModalOverlayGui.dispose();
      });
      promptModalRectancle.addControl(promptModalCloseButton);
      let promptModalFormWidth = 300 + 300;
      let promptModalFormHeight = 43 * SLOP_LLM_MLCMODELS.length;
      const promptModalFormGrid = new Grid("promptModalForm")
        .addColumnDefinition(300, true)
        .addColumnDefinition(300, true)
        .addRowDefinition(43 * SLOP_LLM_MLCMODELS.length, true);
      promptModalFormGrid.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      promptModalFormGrid.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      promptModalFormGrid.widthInPixels = promptModalFormWidth;
      promptModalFormGrid.heightInPixels = promptModalFormHeight;
      promptModalRectancle.addControl(promptModalFormGrid);
      const promptModalSelectModelTextBlock = new TextBlock("promptModalSelectModel", "language model:");
      promptModalSelectModelTextBlock.color = "white";
      promptModalSelectModelTextBlock.paddingTopInPixels = 3;
      promptModalSelectModelTextBlock.paddingRightInPixels = 10;
      promptModalSelectModelTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      promptModalSelectModelTextBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      promptModalFormGrid.addControl(promptModalSelectModelTextBlock, 0, 0);
      const promptModalSelectModelStackPanel = new StackPanel("selectModel");
      promptModalSelectModelStackPanel.isVertical = true;
      promptModalSelectModelStackPanel.width = 1;
      promptModalSelectModelStackPanel.height = 1;
      promptModalFormGrid.addControl(promptModalSelectModelStackPanel, 0, 1);
      let formSelectedModel = selectedModel;
      for (const [mlcModel, ix] of SLOP_LLM_MLCMODELS.map((x, ix) => [x, ix] as const)) {
        const promptModalSelectModelRadioButton = new RadioButton(`selectModel${ix}`);
        promptModalSelectModelRadioButton.widthInPixels = 20;
        promptModalSelectModelRadioButton.heightInPixels = 20;
        promptModalSelectModelRadioButton.color = "black";
        promptModalSelectModelRadioButton.background = "white";
        promptModalSelectModelRadioButton.group = "selectModel";
        promptModalSelectModelRadioButton.isChecked = mlcModel === formSelectedModel;
        promptModalSelectModelRadioButton.onIsCheckedChangedObservable.add((v) => {
          if (v) {
            formSelectedModel = mlcModel;
          }
        });
        const promptModalSelectModelRadioButtonHeader = Control.AddHeader(promptModalSelectModelRadioButton, mlcModel, "270px", {
          isHorizontal: true,
          controlFirst: true,
        }) as StackPanel;
        promptModalSelectModelRadioButtonHeader.color = "white";
        promptModalSelectModelRadioButtonHeader.heightInPixels = 30;
        promptModalSelectModelRadioButtonHeader.fontSize = 16;
        promptModalSelectModelRadioButtonHeader.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        promptModalSelectModelStackPanel.addControl(promptModalSelectModelRadioButtonHeader);
      }
      const promptModalSaveButton = Button.CreateSimpleButton("promptModalSaveButton", "Save");
      promptModalSaveButton.widthInPixels = 100;
      promptModalSaveButton.heightInPixels = 43 + 16;
      promptModalSaveButton.paddingBottomInPixels = 16;
      promptModalSaveButton.cornerRadius = 10;
      promptModalSaveButton.color = "white";
      promptModalSaveButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
      promptModalSaveButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      promptModalSaveButton.onPointerClickObservable.addOnce(async () => {
        promptModalOverlayGui.dispose();
        if (formSelectedModel !== selectedModel) {
          selectedModel = formSelectedModel;
          localStorage.setItem("selectedModel", formSelectedModel);
          await initSlopLLMWithMLCEngine();
        }
      });
      promptModalRectancle.addControl(promptModalSaveButton);
    });
    promptPanel.addControl(promptModalButton);
    const promptStateTextBlock = new TextBlock("promptState", "Initializing prompt...");
    promptStateTextBlock.widthInPixels = debugPanelWidth - 33;
    promptStateTextBlock.heightInPixels = 60 + 10;
    promptStateTextBlock.paddingLeftInPixels = 10;
    promptStateTextBlock.paddingBottomInPixels = 15;
    promptStateTextBlock.color = "white";
    promptStateTextBlock.fontSize = 20;
    promptStateTextBlock.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    promptStateTextBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    promptStateTextBlock.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    promptStateTextBlock.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    promptStateTextBlock.textWrapping = true;
    promptPanel.addControl(promptStateTextBlock);
    const promptInputText = new InputText("promptInput", "");
    promptInputText.placeholderText = "Type your prompt here";
    promptInputText.placeholderColor = "gray";
    promptInputText.color = "white";
    promptInputText.widthInPixels = 512;
    promptInputText.heightInPixels = 32 + 10;
    promptInputText.paddingLeftInPixels = 10;
    promptInputText.paddingBottomInPixels = 10;
    promptInputText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    promptInputText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    promptInputText.onEnterPressedObservable.add(async () => {
      const promptUserMessage = promptInputText.text;
      promptInputText.text = "";
      promptInputText.isVisible = false;
      promptModalButton.isVisible = false;
      try {
        const trueOrMessage = await slopLLM.promptMlcTrueOrMessage(promptUserMessage, (progress) => {
          if (progress.kind === "InvokingChatCompletionsCreate") {
            promptStateTextBlock.text = `${
              progress.attempt > 1 ? `ATTEMPT ${progress.attempt}: ` : ""
            }Thinking... (this may take couple of minutes and your GPU will spike)`;
            promptStateTextBlock.isVisible = true;
            debugGui.update();
          }
        });

        if (trueOrMessage !== true) {
          console.error(`SLOP: inference failed: ${trueOrMessage}`);
          return;
        }
      } catch (error) {
        console.error("SLOP: inference failed");
        console.error(error);
        return;
      } finally {
        promptInputText.isVisible = true;
        promptModalButton.isVisible = true;
        promptStateTextBlock.isVisible = false;
        debugGui.update();
      }
    });
    promptPanel.addControl(promptInputText);
    const mlcEngineOk = await initSlopLLMWithMLCEngine();
    if (!mlcEngineOk) {
      return;
    }
    debugGui.update();
  }
  if (localStorageSelectedModel) {
    scene.onAfterRenderObservable.addOnce(async () => await initPrompt());
  } else {
    const promptUsePromptButton = Button.CreateSimpleButton("usePrompt", "Use prompt");
    promptUsePromptButton.widthInPixels = 150 + 10;
    promptUsePromptButton.heightInPixels = 40 + 10;
    promptUsePromptButton.paddingBottomInPixels = 10;
    promptUsePromptButton.paddingLeftInPixels = 10;
    promptUsePromptButton.color = "white";
    promptUsePromptButton.cornerRadius = 10;
    promptUsePromptButton.background = "black";
    promptUsePromptButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    promptUsePromptButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    promptUsePromptButton.onPointerClickObservable.addOnce(async () => {
      promptUsePromptButton.dispose();
      localStorage.setItem("selectedModel", defaultModel);
      await initPrompt();
    });
    promptPanel.addControl(promptUsePromptButton);
  }

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
  let gettingUp = false;
  let gettingUpFinalize = false;
  let standsOnAnimated = false;
  scene.onBeforeRenderObservable.add((scene) => {
    characterFeet.position.x = character.position.x;
    characterFeet.position.y = character.position.y + characterFeetY;
    characterFeet.position.z = character.position.z;

    let cameraPitch: number;
    let cameraYaw: number;
    const characterRotationPrevY = characterRotation.y;
    character.rotationQuaternion?.toEulerAnglesToRef(characterRotation);

    if (camera instanceof UniversalCamera) {
      cameraPitch = camera.rotation.x + character.rotation.x;
      cameraYaw = camera.rotation.y + character.rotation.y;
    } else if (camera instanceof ArcRotateCamera) {
      camera.position.copyFrom(character.position);
      camera.alpha += characterRotationPrevY - character.rotation.y;
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
      debugGuiFpsTextBlock.text = `FPS: ${Math.round(engine.getFps())}, D: ${scene.deltaTime}`;
    }
  });

  const onAfterPhysicsObservableEvery50Ms = createThrottler(50);
  scene.onAfterPhysicsObservable.add((scene) => {
    if (platform1GoingUp) {
      if (platform1Agg.transformNode.position.y >= 6.75) {
        platform1.physicsBody?.setLinearVelocity(Vector3.Down());
        platform1GoingUp = false;
      }
    } else {
      if (platform1Agg.transformNode.position.y <= 0.25) {
        platform1.physicsBody?.setLinearVelocity(Vector3.Up());
        platform1GoingUp = true;
      }
    }

    if (platform2GoingUp) {
      if (platform2Agg.transformNode.position.y >= 6.75) platform2GoingUp = false;
    } else {
      if (platform2Agg.transformNode.position.y <= 0.25) platform2GoingUp = true;
    }
    platform2Agg.body.setTargetTransform(
      platform2Transform.set(platform2.position.x, platform2.position.y + (platform2GoingUp ? 6 * platform2.position.y : -1) * 0.03, platform2.position.z),
      quaternionZeroReadonly
    );

    platform3Acc += (platform3Clockwise ? 1 : -1) * 0.0002;
    if (platform3Acc > 0.1 || platform3Acc < -0.1) {
      platform3Clockwise = !platform3Clockwise;
    }
    platform3Agg.transformNode.addRotation(0, platform3Acc, 0);

    const tilt = Math.abs(Math.acos(Math.cos(character.rotation.x) * Math.cos(character.rotation.z)));

    if (characterWantJump && characterCanJump && tilt < 0.05) {
      characterJumpImpulse.copyFrom(Vector3.UpReadOnly).scaleInPlace(characterJumpImpulseSize);
      characterAgg.body.applyImpulse(characterJumpImpulse, character.position);
      characterCanJump = false;
      characterMsSinceJump = 0;
    }

    if (!characterCanJump) {
      if (characterMsSinceJump < characterMinMsBetweenJumps) {
        characterMsSinceJump += scene.deltaTime;
      } else if (characterOnJumpablePlatform) {
        characterCanJump = true;
      }
    }

    if (onAfterPhysicsObservableEvery50Ms()) {
      const anyWasdKeyDown = wasdKeysDown.w || wasdKeysDown.a || wasdKeysDown.s || wasdKeysDown.d;
      if (anyWasdKeyDown) {
        characterAgg.body.getLinearVelocityToRef(characterLinearVelocity);
        characterWasdDirectionLocal.applyRotationQuaternionToRef(characterOrientationQuaternion, characterWasdDirectionWorld).normalize();
        characterLinearVelocityXZ.x = characterLinearVelocity.x;
        characterLinearVelocityXZ.z = characterLinearVelocity.z;
        const speedsUpWithinLimits = Math.sqrt(Math.pow(characterLinearVelocity.x, 2) + Math.pow(characterLinearVelocity.z, 2)) < characterWasdMaxSpeed;
        const slowsDown =
          characterLinearVelocityXZ.length() <
          characterLinearVelocityXZ.subtractToRef(characterWasdDirectionWorld, characterLinearVelocityXZMinusWasdVelocity).length();
        if (!gettingUp && (speedsUpWithinLimits || slowsDown)) {
          if (!characterWantJump && characterCanJump) characterWasdDirectionWorld.y += characterStepImpulseSize;
          characterAgg.body.applyImpulse(characterWasdDirectionWorld, character.position);
          if (!characterWantJump && characterCanJump) characterWasdDirectionWorld.y -= characterStepImpulseSize;
        }
      }

      if (gettingUpFinalize) {
        gettingUpFinalize = false;
        characterAgg.body.setPrestepType(PhysicsPrestepType.DISABLED);
        characterAgg.body.setMotionType(PhysicsMotionType.DYNAMIC);
      }

      if (characterOnJumpablePlatform && tilt > 0.0001 && !gettingUp) {
        gettingUp = true;
        characterAgg.body.setPrestepType(PhysicsPrestepType.TELEPORT);
      } else if (gettingUp) {
        gettingUp = false;
        if (tilt <= 0.0001 && !standsOnAnimated && characterLinearVelocityXZ.length() < 0.01) {
          gettingUpFinalize = true;
          characterAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
        } else {
          characterAgg.body.setPrestepType(PhysicsPrestepType.DISABLED);
        }
      }
    }

    if (gettingUp || gettingUpFinalize) {
      characterAgg.body.setAngularVelocity(new Vector3(0, 0, 0));
      if (tilt >= 0.2) {
        character.addRotation(-0.1 * character.rotation.x, 0, -0.1 * character.rotation.z);
      } else {
        character.addRotation(-character.rotation.x, 0, -character.rotation.z);
      }
    }
  });

  scene.onKeyboardObservable.add((k) => {
    if (characterDisableWasd) {
      return;
    }

    switch (k.type) {
      case KeyboardEventTypes.KEYDOWN:
        switch (k.event.key) {
          case "w":
          case "W":
            characterWasdDirectionLocal.z = 1;
            wasdKeysDown.w = true;
            break;
          case "s":
          case "S":
            characterWasdDirectionLocal.z = -1;
            wasdKeysDown.s = true;
            break;
          case "a":
          case "A":
            characterWasdDirectionLocal.x = -1;
            wasdKeysDown.a = true;
            break;
          case "d":
          case "D":
            characterWasdDirectionLocal.x = 1;
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
            characterWasdDirectionLocal.z = wasdKeysDown.s ? -1 : 0;
            break;
          case "s":
          case "S":
            wasdKeysDown.s = false;
            characterWasdDirectionLocal.z = wasdKeysDown.w ? 1 : 0;
            break;
          case "a":
          case "A":
            wasdKeysDown.a = false;
            characterWasdDirectionLocal.x = wasdKeysDown.d ? 1 : 0;
            break;
          case "d":
          case "D":
            wasdKeysDown.d = false;
            characterWasdDirectionLocal.x = wasdKeysDown.a ? -1 : 0;
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
