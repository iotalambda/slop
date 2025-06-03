import { Color3, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Scene, Vector3 } from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials";

export class SlopTool {
  #scene: Scene;
  #boxCounter = 0;

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  createBox(width: number, height: number, depth: number, posX: number, posY: number, posZ: number, colorHex: string) {
    const count = this.#boxCounter++;
    const box = MeshBuilder.CreateBox(`llmBox${count}`, { width: width, height: height, depth: depth }, this.#scene);
    box.position = new Vector3(posX, posY, posZ);
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0, friction: 0.8, restitution: 0 }, this.#scene);
    const boxMat = new GridMaterial(`llmBox${count}Mat`, this.#scene);
    boxMat.lineColor = Color3.FromHexString(colorHex);
    boxMat.gridRatio = 0.5;
    box.material = boxMat;
  }
}
