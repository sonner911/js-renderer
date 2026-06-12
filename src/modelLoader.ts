import type {Material, Model, Texture} from "./models.ts";
import type {Vec3d, Vec4d} from "./matops.ts";

const BASE_URL = `${import.meta.env.BASE_URL}/models`

export async function fetchModel(filename: string): Promise<Model> {
    const response = await fetch(`${BASE_URL}/${filename}`)
    if (!response.ok) {
        throw new Error(`Could not fetch model ${filename}: status: ${response.status}`)
    }
    const text = await response.text()
    const result = makeModel()

    let currentGroup: {groupName: string, start: number} = {groupName: "base", start: 0}
    function finishGroup() {
        if (currentGroup === null) return

        result.groups.set(currentGroup.groupName, [
            currentGroup.start,
            result.faces.length,
        ])
    }

    function checkGroup(group: typeof currentGroup): asserts group is Exclude<typeof currentGroup, null>  {
        if (group === null) throw new Error("Could not find group name");
    }
    for (const line of text.split("\n")) {
        if (line.startsWith("#")) continue
        const parts = line.split(/\s+/)
        if (parts.length === 0) continue

        const [command, ...args] = parts
        switch (command) {
            case "g": {
                finishGroup()
                if (args.length !== 1) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                currentGroup = {groupName: args[0], start: result.faces.length}
                break
            }
            case "v": {
                if (args.length < 3) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                const x = Number.parseFloat(args[0])
                const y = Number.parseFloat(args[1])
                const z = Number.parseFloat(args[2])
                checkGroup(currentGroup)
                result.vertexes.push([x, y, z])
                break
            }
            case "vt": {
                if (args.length < 2) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                const x = Number.parseFloat(args[0])
                const y = Number.parseFloat(args[1])
                checkGroup(currentGroup)
                result.textureCoords.push([x, y])
                break
            }
            case "vn": {
                if (args.length < 3) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                const x = Number.parseFloat(args[0])
                const y = Number.parseFloat(args[1])
                const z = Number.parseFloat(args[2])
                checkGroup(currentGroup)
                result.normals.push([x, y, z])
                break
            }
            case "f": {
                if (args.length < 3) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                const v0 = parseFace(args[0])
                const v1 = parseFace(args[1])
                const v2 = parseFace(args[2])
                checkGroup(currentGroup)
                result.faces.push([v0, v1, v2])
                break
            }
            case "mtllib": {
                if (args.length !== 1) {
                    throw new Error(`Wrong args count: ${line}`)
                }
                const libFileName = args[0]
                const materials = await loadMTL(libFileName)
                for (const [key, value] of materials.entries()) {
                    result.materials.set(key, value)
                }

                break
            }
            default:
                break
        }
    }

    finishGroup()

    return result
}

async function loadMTL(filename: string): Promise<Map<string, Material>> {
    const response = await fetch(`${BASE_URL}/${filename}`)
    if (!response.ok) {
        throw new Error(`Could not fetch model ${filename}: status: ${response.status}`)
    }
    const text = await response.text()

    const result = new Map<string, Material>()
    let currentMaterial: Material = {}

    for (const line of text.split("\n")) {
        if (line.startsWith("#")) continue
        const parts = line.split(/\s+/)
        if (parts.length === 0) continue

        const [command, ...args] = parts
        switch (command) {
            case "newmtl": {
                currentMaterial = {}
                result.set(args[0], currentMaterial)
                break
            }
            case "map_Kd": {
                const filename = args[0]
                currentMaterial.mapKd = await loadTexture(`${BASE_URL}/${filename}`)
                break
            }
        }
    }

    return result
}

function parseFace(face: string): Vec3d {
    const parts = face.split("/")
    if (parts.length !== 3) throw new Error(`Wrongs parts for face: ${face}`)
    const p1 = Number.parseInt(parts[0], 10)
    const p2 = (parts[1] === "") ? -1 : Number.parseInt(parts[1], 10)
    const p3 = Number.parseInt(parts[2], 10)

    return [p1, p2, p3]
}

function makeModel(): Model {
    return {
        vertexes: [[0, 0, 0]],
        normals: [[0, 0, 0]],
        textureCoords: [[0, 0]],
        faces: [],
        groups: new Map<string, [number, number]>(),
        materials: new Map<string, Material>(),
    }
}

async function loadTexture(src: string) : Promise<Texture> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = src

        img.addEventListener("load", () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")!

            ctx.drawImage(img, 0, 0);
            img.style.display = "none";
            const imageData = ctx.getImageData(0, 0, img.width, img.height)

            if (imageData === null) {
                reject("Could not load texture");
            } else {
                resolve({
                    get(ux:  number, uy: number) {
                        const x = Math.round(img.width * ux)
                        const y = Math.round(img.height * (1 - uy))

                        const index = y * imageData.width + x
                        const i = index*4
                        const d = imageData.data
                        const f = 255
                        return [d[i] / f,d[i+1] / f,d[i+2] / f,d[i+3] / f] as Vec4d
                    }
                })
            }

        })
    })
}
