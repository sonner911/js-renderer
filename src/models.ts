import type {Color, Vec2d, Vec3d} from "./matops.ts";

export type Model = {
    vertexes: Vec3d[]
    normals: Vec3d[]
    textureCoords: Vec2d[]
    faces: Vec3d[][] // v/vt/vn
    groups: Map<string, [number, number]>
    materials: Map<string, Material>
}

export type Texture = {
    get(u: number, v: number): Color
}

export type Material = {
    mapKd?: Texture,
}
