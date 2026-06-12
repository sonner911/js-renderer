type FixedArray<TType, TLength extends number> = TType[] & { length: TLength };
export type Vec2d = FixedArray<number, 2>
export type Vec3d = FixedArray<number, 3>
export type Vec4d = FixedArray<number, 4>
export type Mat4d = FixedArray<FixedArray<number, 4>, 4>
export type Color = Vec4d

export interface Transform {
    forward: Mat4d
    inverse: Mat4d
}

export function makeRotateX(angle: number): Transform {
    return {
        get forward() { return getRotateX(angle) },
        get inverse() { return getRotateX(-angle) },
    }
}

export function makeCompose(t1: Transform, t2: Transform): Transform {
    return {
        forward: matMul(t1.forward, t2.inverse),
        inverse: matMul(t2.inverse, t1.inverse),
    }
}

export class GTransform {
    private readonly forward_: Mat4d
    private readonly inverse_: Mat4d

    private constructor(forward: Mat4d, inverse: Mat4d) {
        this.forward_ = forward
        this.inverse_ = inverse
    }

    mul(that: GTransform): GTransform {
        return new GTransform(
            matMul(this.forward_, that.forward_),
            matMul(that.inverse_, this.inverse_),
        )
    }

    get inverse(): GTransform {
        return new GTransform(this.inverse_, this.forward_)
    }

    get mat(): Mat4d {
        return this.forward_
    }

    static IDENTITY: GTransform = new GTransform(getMat4Identity(), getMat4Identity())
    static rotateX(angle: number): GTransform {
        return new GTransform(
            getRotateX(angle),
            getRotateX(-angle),
        )
    }

    static rotateY(angle: number): GTransform {
        return new GTransform(
            getRotateY(angle),
            getRotateY(-angle),
        )
    }

    static rotateZ(angle: number): GTransform {
        return new GTransform(
            getRotateZ(angle),
            getRotateZ(-angle),
        )
    }

    static translate(x: number, y: number, z: number): GTransform {
        return new GTransform(
            getTranslate(x, y, z),
            getTranslate(-x, -y, -z),
        )
    }

    static scale(x: number, y: number, z: number): GTransform {
        return new GTransform(
            getScale(x, y, z),
            getScale(1/x, 1/y, 1/z),
        )
    }
}

export function getMat4Identity(): Mat4d {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ]
}

export function getRotateX(angle: number): Mat4d {
    const mat = getMat4Identity()

    mat[1][1] = Math.cos(angle);
    mat[1][2] = -Math.sin(angle);
    mat[2][1] = Math.sin(angle);
    mat[2][2] = Math.cos(angle);

    return mat
}

export function getRotateY(angle: number): Mat4d {
    const mat = getMat4Identity()

    mat[2][2] = Math.cos(angle);
    mat[2][0] = -Math.sin(angle);
    mat[0][2] = Math.sin(angle);
    mat[0][0] = Math.cos(angle);

    return mat
}

export function getRotateZ(angle: number): Mat4d {
    const mat = getMat4Identity()
    mat[0][0] = Math.cos(angle)
    mat[0][1] = -Math.sin(angle)
    mat[1][0] = Math.sin(angle)
    mat[1][1] = Math.cos(angle)
    return mat
}

export function getTranslate(dx: number, dy: number, dz: number): Mat4d {
    const mat = getMat4Identity()
    mat[0][3] = dx
    mat[1][3] = dy
    mat[2][3] = dz
    return mat
}

export function getScale(sx: number, sy: number, sz: number): Mat4d {
    const mat = getMat4Identity()
    mat[0][0] = sx
    mat[1][1] = sy
    mat[2][2] = sz
    return mat
}

function dot(vec1: Vec4d, vec2: Vec4d): number {
    let prod = 0
    for (let i = 0; i < 4; i++) {
        prod += vec1[i] * vec2[i]
    }
    return prod
}

export function matApply(mat: Mat4d, vec: Vec4d): Vec4d {
    const res: Vec4d = [0, 0, 0, 0]
    for (let row = 0; row < 4; row++) {
        res[row] = dot(mat[row], vec)
    }
    return res
}

export function matMul(m1: Mat4d, m2: Mat4d): Mat4d {
    const res = Array(4).fill(undefined).map(_ => {
        return Array(4).fill(0)
    }) as Mat4d

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) {
                res[i][j] += m1[i][k] * m2[k][j]
            }
        }
    }

    return res
}

export function vec4Weighted(...pairs: [number, Vec4d][]): Vec4d {
    let res: Vec4d = [0, 0, 0, 0]

    for (const [scale, vec] of pairs) {
        res = vec4Plus(res, vec4MulScalar(vec, scale))
    }

    return res
}

export function vec3Weighted(...pairs: [number, Vec3d][]): Vec3d {
    let res: Vec3d = [0, 0, 0]

    for (const [scale, vec] of pairs) {
        res = vec3Plus(res, vec3MulScalar(vec, scale))
    }

    return res
}

export function vec4Plus(a: Vec4d, b: Vec4d): Vec4d {
    const res: Vec4d = [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) {
        res[i] = a[i] + b[i]
    }
    return res
}

export function vec3Diff(a: Vec3d, b: Vec3d): Vec3d {
    const res: Vec3d = [0, 0, 0]
    for (let i = 0; i < 3; i++) {
        res[i] = a[i] - b[i]
    }
    return res
}

export function vec3Plus(a: Vec3d, b: Vec3d): Vec3d {
    const res: Vec3d = [0, 0, 0]
    for (let i = 0; i < 3; i++) {
        res[i] = a[i] + b[i]
    }
    return res
}

export function vec4MulScalar(vec: Vec4d, scale: number): Vec4d {
    return [
        vec[0] * scale,
        vec[1] * scale,
        vec[2] * scale,
        vec[3] * scale,
    ]
}

export function vec3MulScalar(vec: Vec3d, scale: number): Vec3d {
    return [
        vec[0] * scale,
        vec[1] * scale,
        vec[2] * scale,
    ]
}

export function vec3Normalized(vec: Vec3d): Vec3d {
    const len = vec3Len(vec)
    return [
        vec[0] / len,
        vec[1] / len,
        vec[2] / len,
    ]
}

export function vec3Len(vec: Vec3d): number {
    return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2])
}

export function vec3DotProd(v1: Vec3d, v2: Vec3d): number {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
}

export function vec3VecProd(v1: Vec3d, v2: Vec3d): Vec3d {
    function compute(x: number, y: number, z: number): number {
        return v1[x] * v2[y] - v1[y] * v2[x]
    }

    return [
        compute(1, 2, 0),
        compute(2, 0, 1),
        compute(0, 1, 2),
    ]
}
