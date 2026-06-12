import type {Color, Vec2d} from "./matops.ts";

export interface Renderer2D {
    readonly width: number;
    readonly height: number;
    drawLine(pt1: Vec2d, pt2: Vec2d, color: Color): void
    drawPixel(pt: Vec2d, color: Color): void
    flush(): void
}

export class CanvasRenderer implements Renderer2D {
    private ctx: CanvasRenderingContext2D
    readonly width: number
    readonly height: number
    private readonly imageData: ImageData

    constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.ctx = ctx
        this.width = width
        this.height = height
        this.imageData = ctx.createImageData(width, height)
    }

    drawLine(pt1: Vec2d, pt2: Vec2d, color: Color): void {
        pt1 = ensureIntVec(pt1)
        pt2 = ensureIntVec(pt2)

        const [x1, y1] = pt1
        const [x2, y2] = pt2
        const deltaX = x2 - x1
        const deltaY = y2 - y1

        let curPt = pt1

        while (getDist(curPt, pt2) > 0.5) {
            const curDist = getDist(curPt, pt2)
            this.drawPixel(curPt, color)
            const [x, y] = curPt
            const candidates: Vec2d[] = [
                [x + 1, y],
                [x, y - 1],
                [x - 1, y],
                [x, y + 1],
            ]

            let bestDist = Number.POSITIVE_INFINITY
            let best: Vec2d | null = null
            for (const candidate of candidates) {
                if (getDist(candidate, pt2) > curDist) continue

                const [xi, yi] = candidate
                const dist = Math.abs(deltaY * (x2 - xi) - deltaX * (y2 - yi))

                if (dist < bestDist) {
                    bestDist = dist
                    best = candidate
                }
            }

            if (best === null) break
            curPt = best
        }

        this.drawPixel(curPt, color)
    }


    drawPixel([x, y]: Vec2d, color: Color) {
        if (x < 0 || x >= this.width) return
        if (y < 0 || y >= this.height) return

        const index = 4 * (x + y * this.width);
        const data = this.imageData.data
        for (let k = 0; k < 4; k++) {
            data[index+k] = color[k] * 255;
        }
    }

    flush() {
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}

function colorCompToDec(comp: number): string {
    const clamped = Math.max(0, Math.min(1, comp))
    return Math.floor(clamped * 255).toString()
}

function colorToStyle(color: Color): string {
    const rgb = color.slice(0, 3).map(colorCompToDec).join(' ')
    return `rgb(${rgb} / ${color[3]})`
}

function getDist(p1: Vec2d, p2: Vec2d): number {
    const [x1, y1] = p1
    const [x2, y2] = p2

    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
}

function ensureIntVec(pt: Vec2d): Vec2d {
    const [x, y] = pt
    return [Math.floor(x), Math.floor(y)]
}

function setPixel(imgData: ImageData, index: number, color: Color) {
    const i = index*4
    const d = imgData.data
    // return [d[i],d[i+1],d[i+2],d[i+3]] // Returns array [R,G,B,A]
    for (let k = 0; k < 4; k++) {
        d[i + k] = color[k]
    }
}

function setPixelXY(imgData: ImageData, x: number, y: number, color: Color) {
    return setPixel(imgData, y*imgData.width+x, color)
}