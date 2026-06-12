import {
    type Color,
    getMat4Identity,
    getRotateX,
    getRotateY,
    getRotateZ,
    getTranslate, GTransform,
    type Mat4d,
    matApply,
    matMul, type Vec2d,
    type Vec3d, vec3Diff, vec3Normalized,
    type Vec4d, vec4MulScalar, vec3VecProd, vec3DotProd, vec3MulScalar, vec3Plus, vec4Weighted, vec3Weighted
} from "./matops.ts";
import type {Renderer2D} from "./render2d.ts";
import type {Model, Texture} from "./models.ts";
import {TransformStack} from "./transformStack.ts";

export type Shader = (w1: number, w2: number, w3: number) => Color

export type LightSource = {
    // direction: Vec3d,
    location: Vec3d,
    ambient: number,
    diffuse: number,
    specular?: number,
}

export class Renderer3D {
    private renderer: Renderer2D
    private readonly transforms = new TransformStack()
    private zBuffer: number[][]
    private lightSources: LightSource[] = []
    private fallbackColor?: Color
    meshOnly: boolean = false

    constructor(renderer: Renderer2D) {
        this.renderer = renderer
        this.zBuffer = Array(renderer.width).fill(null).map(() => {
            return Array(renderer.height).fill(Number.NEGATIVE_INFINITY)
        })
    }

    setFallbackColor(color: Color) {
        this.fallbackColor = color
    }

    addLightSource(source: LightSource): void {
        this.lightSources.push({
            location: this.applyTransformToCamera(source.location).slice(0, 3) as Vec3d,
            ambient: source.ambient,
            diffuse: source.diffuse,
            specular: source.specular,
        })
    }

    with(transforms: GTransform[], block: () => void) {
        this.transforms.with(transforms, block)
    }

    withCamera(transforms: GTransform[], block: () => void) {
        this.transforms.with(transforms.map(t => t.inverse).toReversed(), block)
    }

    renderLine(pt1: Vec3d, pt2: Vec3d, color: Color): void {
        const dot1 = this.applyTransform(pt1)
        if (dot1 == null) return

        const dot2 = this.applyTransform(pt2)
        if (dot2 == null) return

        for (const dot of [dot1, dot2]) {
            if (dot[0] < -this.renderer.width || dot[0] > 2 * this.renderer.width) return
            if (dot[1] < -this.renderer.height || dot[1] > 2 * this.renderer.height) return
        }

        this.renderer.drawLine(
            vec3to2(dot1),
            vec3to2(dot2),
            color,
        )
    }

    renderTriangle(
        pt1: Vec3d, pt2: Vec3d, pt3: Vec3d,
        shader: Shader,
    ) {
        const [r1, r2, r3] = [pt1, pt2, pt3].map(pt => this.applyTransformToCamera(pt))
        this.renderTriangleTransformed(
            vec4to3(r1),
            vec4to3(r2),
            vec4to3(r3),
            shader,
        )
    }

    renderTriangleTransformed(vec1: Vec3d, vec2: Vec3d, vec3: Vec3d, shader: Shader) {
        const pt1 = this.toPerspective(vec1)
        if (pt1 == null) return
        const pt2 = this.toPerspective(vec2)
        if (pt2 == null) return
        const pt3 = this.toPerspective(vec3)
        if (pt3 == null) return

        const cullZ = vec3VecProd(
            vec3Diff(pt2, pt1),
            vec3Diff(pt3, pt1),
        )[2]
        if (cullZ < 0) return

        const points = [pt1, pt2, pt3].map(pt => this.toScreen([pt[0], pt[1]]))

        points.sort((a, b) => a[1] - b[1])

        const [[x1, y1], [x2, y2], [x3, y3]] = points
        if (Math.abs(y3 - y1) < EPS) return
        // const x0 = x1 + (x3 - x1) * Math.floor((y2 - y1) / (y3 - y1))

        const y_min = Math.max(0, Math.ceil(y1))
        const y_max = Math.min(this.renderer.height, Math.floor(y3))

        for (let y = y_min; y <= y_max; y++) {
            let xa = getXIntersect(y, [x1, y1], [x3, y3])!
            const xbt: number[] = []
            const xt = getXIntersect(y, [x1, y1], [x2, y2])
            if (xt !== null && Math.abs(xt) >= EPS) {
                xbt.push(xt)
            }
            const xb = getXIntersect(y, [x2, y2], [x3, y3])
            if (xb !== null && Math.abs(xb) >= EPS) {
                xbt.push(xb)
            }
            if (xbt.length === 0) continue
            xbt.sort((a, b) => Math.abs(xa - a) - Math.abs(xa - b))

            let xn = xbt[0]

            if (xn < xa) {
                [xn, xa] = [xa, xn]
            }

            const x_min = Math.ceil(Math.max(xa, Math.min(0, x1, x2, x3)))
            const x_max = Math.floor(Math.min(xn, Math.max(this.renderer.width, x1, x2, x3)))
            for (let x = x_min; x <= x_max; x++) {
                if (x < 0 || x >= this.renderer.width) continue
                if (y < 0 || y >= this.renderer.height) continue

                const weights = getWeights(this.fromScreen([x, y]), vec1, vec2, vec3)
                if (weights === null) continue
                const [w1, w2, w3] = weights

                // console.log(w1, w2, w3)

                const z = w1 * vec1[2] + w2 * vec2[2] + w3 * vec3[2]
                if (z < this.zBuffer[x][y]) continue
                this.zBuffer[x][y] = z

                const color = shader(w1, w2, w3)
                this.renderer.drawPixel([x, y], color)
            }
        }
    }

    getFallbackColor(): Vec4d {
        return this.fallbackColor ?? [1, 1, 1, 1]
    }

    renderModel(model: Model, group?: string) {
        const material = model.materials.values().next().value
        const texture = material?.mapKd
        let faces = model.faces
        if (group !== undefined) {
            const groupRange = model.groups.get(group)
            if (groupRange === undefined) {
                throw new Error(`No faces found for group "${group}"`)
            }
            const [start, end] = groupRange
            faces = faces.slice(start, end)
        }
        for (const [node1, node2, node3] of faces) {
            const [v1, vt1, vn1] = node1
            const [v2, vt2, vn2] = node2
            const [v3, vt3, vn3] = node3

            const [nx1, ny1, nz1] = model.normals[vn1]
            const [nx2, ny2, nz2] = model.normals[vn2]
            const [nx3, ny3, nz3] = model.normals[vn3]

            if (this.meshOnly) {
                for (const [a, b] of [[v1, v2], [v2, v3], [v3, v1]]) {
                    this.renderLine(
                        model.vertexes[a],
                        model.vertexes[b],
                        this.getFallbackColor(),
                    )
                }
                continue
            }

            const [r1, r2, r3] = [v1, v2, v3].map(v => vec4to3(this.applyTransformToCamera(model.vertexes[v])))

            this.renderTriangleTransformed(
                r1,
                r2,
                r3,
                // model.vertexes[v1],
                // model.vertexes[v2],
                // model.vertexes[v3],
                (w1, w2, w3) => {
                    let color = this.getFallbackColor()

                    if (texture !== undefined && vt1 >= 0 && vt2 >= 0 && vt3 >= 0) {
                        const [tu1, tv1] = model.textureCoords[vt1]
                        const [tu2, tv2] = model.textureCoords[vt2]
                        const [tu3, tv3] = model.textureCoords[vt3]

                        const tu = w1 * tu1 + w2 * tu2 + w3 * tu3
                        const tv = w1 * tv1 + w2 * tv2 + w3 * tv3

                        color = texture.get(tu, tv)
                    }

                    const [nx, ny, nz] = vec3Normalized(
                        this.applyTransformToDir([
                            w1 * nx1 + w2 * nx2 + w3 * nx3,
                            w1 * ny1 + w2 * ny2 + w3 * ny3,
                            w1 * nz1 + w2 * nz2 + w3 * nz3,
                        ])
                    )

                    const renPoint = vec3Weighted(
                        [w1, r1],
                        [w2, r2],
                        [w3, r3],
                    )

                    let intensity = 0

                    for (const {location, ambient, diffuse, specular} of this.lightSources) {
                        intensity += ambient

                        const nDir = vec3Normalized(vec3Diff(renPoint, location))
                        const scalar = -(nDir[0] * nx + nDir[1] * ny + nDir[2] * nz)
                        if (scalar > 0) {
                            intensity += scalar * diffuse
                        }

                        if (specular !== undefined) {
                            const normal: Vec3d = [nx, ny, nz]
                            const reflectedDir = vec3Plus(
                                nDir,
                                vec3MulScalar(
                                    normal,
                                    -2 * vec3DotProd(nDir, normal),
                                )
                            )
                            const cosine = vec3DotProd(
                                reflectedDir,
                                vec3Normalized(vec3Diff([0, 0, 0], renPoint)),
                            )
                            if (cosine > 0 && scalar > 0) {
                                // if (cosine > 1) { throw new Error(`${cosine} cosine`) }
                                const lambda = 20
                                const specularIntensity = Math.exp(
                                    -lambda * (1 - cosine * scalar) * (1 - cosine * scalar)
                                )
                                intensity += specular * specularIntensity
                            }
                        }
                    }

                    if (this.lightSources.length === 0) intensity = 1

                    return vec4MulScalar(color, intensity)
                },
            )
        }
    }

    private toPerspective(vec: Vec3d): Vec3d | null {
        const [x, y, z] = vec
        if (z >= 0) return null
        return [x / -z, y / -z, z]
    }

    private toScreen(pt: Vec2d): Vec2d {
        const [x, y] = pt
        const scale = this.screenScale

        return [
            this.renderer.width / 2 + x * scale,
            this.renderer.height / 2 - y * scale,
        ]
    }

    private fromScreen(pt: Vec2d): Vec2d {
        const [x, y] = pt
        const scale = this.screenScale

        return [
            (x - this.renderer.width / 2) / scale,
            -(y - this.renderer.height / 2) / scale,
        ]
    }

    private get screenScale(): number {
        return Math.min(this.renderer.width, this.renderer.height)
    }

    private applyTransformToCamera(pt: Vec3d): Vec4d {
        return matApply(this.getAggTransform().mat, this.toVec4(pt))
    }

    private applyTransformToDir(dir: Vec3d): Vec3d {
        const zero: Vec3d = [0, 0, 0]

        return vec3Diff(
            vec4to3(this.applyTransformToCamera(dir)),
            vec4to3(this.applyTransformToCamera(zero)),
        )
    }

    private getAggTransform(): GTransform {
        return this.transforms.top
    }

    private applyTransform(pt: Vec3d): Vec3d | null {
        let [x, y, z] = matApply(this.getAggTransform().mat, this.toVec4(pt))

        if (z > -EPS) return null

        x /= -z
        y /= -z

        let scale = this.screenScale

        return [
            Math.round(this.renderer.width / 2 + x * scale),
            Math.round(this.renderer.height / 2 - y * scale),
            z,
        ]
    }

    private toVec4(pt: Vec3d): Vec4d {
        return [pt[0], pt[1], pt[2], 1]
    }
}

function vec3to2(vec: Vec3d): Vec2d {
    return [vec[0], vec[1]]
}

function vec4to3(vec: Vec4d): Vec3d {
    return [vec[0], vec[1], vec[2]]
}

function getWeights(
    [x, y]: Vec2d,
    [x1, y1, z1]: Vec3d,
    [x2, y2, z2]: Vec3d,
    [x3, y3, z3]: Vec3d,
): Vec3d | null {
    z1 = -z1
    z2 = -z2
    z3 = -z3
    const xRow: Vec3d = [x1 - x * z1, x2 - x * z2, x3 - x * z3]
    const yRow: Vec3d = [y1 - y * z1, y2 - y * z2, y3 - y * z3]

    const [w1, w2, w3] = vec3VecProd(xRow, yRow)
    const ws = w1 + w2 + w3
    if (Math.abs(ws) < EPS) return null

    return [w1 / ws, w2 / ws, w3 / ws]
}

function getXIntersect(y: number, pt1: Vec2d, pt2: Vec2d): number | null {
    const [x1, y1] = pt1
    const [x2, y2] = pt2

    if (Math.abs(y1 - y2) < EPS) return null

    return x1 + Math.round((y - y1) * (x2 - x1) / (y2 - y1))
}

const EPS = 0.000001