import { Color3, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Scene, Vector3 } from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials";

type SlopToolAddCubeParams = { width: number; xCoordinate: number; yCoordinate: number; zCoordinate: number; colorHex: string };
type SlopToolAddPoleParams = { height: number; xCoordinate: number; yCoordinate: number; zCoordinate: number; colorHex: string };
const SLOP_TOOL_NAMES = ["addCube", "addPole"] as const;

export class SlopTool {
  #scene: Scene;
  #boxCounter = 0;

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  applyTrueOrFeedback(name: string, parameters: any): true | string {
    switch (name as (typeof SLOP_TOOL_NAMES)[number]) {
      case "addCube":
        return this.addCubeTrueOrFeedback(parameters);
      case "addPole":
        return this.addPoleTrueOrFeedback(parameters);
      default:
        return `There is no tool called '${name}'.`;
    }
  }

  addBox(parameters: { sizeX: number; sizeY: number; sizeZ: number; xCoordinate: number; yCoordinate: number; zCoordinate: number; colorHex: string }) {
    const count = this.#boxCounter++;
    const box = MeshBuilder.CreateBox(`stBox${count}`, { width: parameters.sizeX, height: parameters.sizeY, depth: parameters.sizeZ }, this.#scene);
    box.position = new Vector3(parameters.xCoordinate, parameters.yCoordinate, parameters.zCoordinate);
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0, friction: 0.8, restitution: 0 }, this.#scene);
    const boxMat = new GridMaterial(`stBox${count}Mat`, this.#scene);
    boxMat.lineColor = Color3.FromHexString(parameters.colorHex);
    boxMat.gridRatio = 0.5;
    box.material = boxMat;
  }

  addCubeTrueOrFeedback(parameters: SlopToolAddCubeParams): true | string {
    const feedback: string[] = [];
    if (parameters.width <= 0) {
      feedback.push("width must be >0.");
    }
    if (parameters.colorHex) {
      parameters.colorHex = parameters.colorHex.replace(new RegExp(" "), "");
      if (parameters.colorHex.length === 6 && !parameters.colorHex.startsWith("#")) {
        parameters.colorHex = `#${parameters.colorHex}`;
      }
    }
    if (!parameters.colorHex || parameters.colorHex.length !== 7) {
      feedback.push("colorHex value must be like `#` plus 6 hex digits.");
    }
    if (feedback.length > 0) {
      return feedback.join(" ");
    }
    this.addBox({
      colorHex: parameters.colorHex,
      xCoordinate: parameters.xCoordinate,
      yCoordinate: parameters.yCoordinate,
      zCoordinate: parameters.zCoordinate,
      sizeX: parameters.width,
      sizeY: parameters.width,
      sizeZ: parameters.width,
    });
    return true;
  }

  static readonly ADDCUBE_TOOLSCHEMA = {
    type: "function",
    function: {
      name: "addCube",
      description: "Add a new cube to the 3D space.",
      parameters: {
        xCoordinate: {
          type: "decimal",
          description: "X-coordinate of the new cube.",
        },
        yCoordinate: {
          type: "decimal",
          description: "Y-coordinate of the new cube.",
        },
        zCoordinate: {
          type: "decimal",
          description: "Z-coordinate of the new cube.",
        },
        width: {
          type: "decimal",
          description: "The new cube's width. Must be >0.",
        },
        colorHex: {
          type: "string",
          description: "The cube's color. For example `#00FF00` for green. Must start with `#` and then have 6 hex digits.",
        },
        required: ["xCoordinate", "yCoordinate", "zCoordinate", "width", "colorHex"],
      },
    },
  };

  addPoleTrueOrFeedback(parameters: SlopToolAddPoleParams): true | string {
    let feedback: string[] = [];
    if (parameters.height <= 0) {
      feedback.push("height must be >0.");
    }
    if (parameters.colorHex) {
      parameters.colorHex = parameters.colorHex.replace(new RegExp(" "), "");
      if (parameters.colorHex.length === 6 && !parameters.colorHex.startsWith("#")) {
        parameters.colorHex = `#${parameters.colorHex}`;
      }
    }
    if (!parameters.colorHex || parameters.colorHex.length !== 7) {
      feedback.push("colorHex value must be like `#` plus 6 hex digits.");
    }
    if (parameters.height <= 4) {
      feedback.push("Make height be greater than 4, so it's tall like a pole (check what I requested).");
    }
    if (feedback.length > 0) {
      return feedback.join(" ");
    }
    this.addBox({
      colorHex: parameters.colorHex,
      xCoordinate: parameters.xCoordinate,
      yCoordinate: parameters.yCoordinate,
      zCoordinate: parameters.zCoordinate,
      sizeX: Math.pow(parameters.height, 1 / 3),
      sizeY: parameters.height,
      sizeZ: Math.pow(parameters.height, 1 / 3),
    });
    return true;
  }

  static readonly ADDPOLE_TOOLSCHEMA = {
    type: "function",
    function: {
      name: "addPole",
      description: "Add a new pole to the 3D space.",
      parameters: {
        xCoordinate: {
          type: "decimal",
          description: "X-coordinate of the pole.",
        },
        yCoordinate: {
          type: "decimal",
          description: "Y-coordinate of the pole.",
        },
        zCoordinate: {
          type: "decimal",
          description: "Z-coordinate of the pole.",
        },
        height: {
          type: "decimal",
          description: "Height of the pole.",
        },
        colorHex: {
          type: "string",
          description: "The pole's color. For example `#00FF00` for green. Must start with `#` and then have 6 hex digits.",
        },
        required: ["xCoordinate", "yCoordinate", "zCoordinate", "height", "colorHex"],
      },
    },
  };

  static readonly SCHEMAS = [SlopTool.ADDCUBE_TOOLSCHEMA, SlopTool.ADDPOLE_TOOLSCHEMA].map((s) => JSON.stringify(s)).join("\n");
}
