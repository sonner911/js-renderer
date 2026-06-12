import './style.css'
import {
    type Color, getRotateX, getRotateY,
    getRotateZ, getScale,
    getTranslate, GTransform, matApply, type Vec2d,
    type Vec3d, type Vec4d, vec4Weighted, vec3VecProd
} from "./matops.ts"
import {CanvasRenderer} from "./render2d.ts";
import {Renderer3D, type Shader} from "./render3d.ts";
import {bindBoolProp, bindProp, bindSelectProp, KeyProps} from "./props.ts";
import boxUrl from './assets/RTS_Crate.png'
import {fetchModel} from "./modelLoader.ts";
import type {Model} from "./models.ts";

function getCubeLines(): Array<[Vec3d, Vec3d]> {
    const result: Array<[Vec3d, Vec3d]> = []
    for (const x of [-1, 1]) {
        for (const y of [-1, 1]) {
            for (const z of [-1, 1]) {
                result.push([
                    [x, y, z],
                    [-x, y, z],
                ])
                result.push([
                    [x, y, z],
                    [x, -y, z],
                ])
                result.push([
                    [x, y, z],
                    [x, y, -z],
                ])
            }
        }
    }

    return result
}

const COLOR_RED: Color = [1, 0, 0, 1]
const COLOR_GREEN: Color = [0, 1, 0, 1]
const COLOR_BLUE: Color = [0, 0, 1, 1]
const COLOR_WHITE: Color = [1, 1, 1, 1]
const COLOR_CLEAR: Color = [0, 0, 0, 0]

function render(): void {
    if (canvas.width !== canvSize.value || canvas.height !== canvSize.value) {
        canvas.width = canvSize.value
        canvas.height = canvSize.value
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // ctx.fillStyle = "red"
    // ctx.fillRect(0, 0, canvas.width, canvas.height)

    const renderer2d = new CanvasRenderer(ctx, canvas.width, canvas.height)
    const renderer = new Renderer3D(renderer2d)

    renderer.meshOnly = useMeshOnly.value

    function renderCubeFrame() {
        for (const [pt1, pt2] of getCubeLines()) {
            renderer.renderLine(pt1, pt2, COLOR_RED)
        }
    }

    function renderCubeTop() {
        renderer.renderTriangle(
            [-1, -1, 1],
            [1, -1, 1],
            [-1, 1, 1],
            makeTextureShader(boxTexture,
                [0, 0],
                [1, 0],
                [0, 1],
            ),
        )
        renderer.renderTriangle(
            [1, 1, 1],
            [-1, 1, 1],
            [1, -1, 1],
            makeTextureShader(boxTexture,
                [1, 1],
                [0, 1],
                [1, 0],
            ),
        )
    }

    function renderCubeSolid() {
        renderCubeTop()
        renderer.with([GTransform.rotateX(Math.PI)], () => {
            renderCubeTop()
        })
        renderer.with([GTransform.rotateX(Math.PI)], () => {
            renderCubeTop()
        })
        renderer.with([GTransform.rotateX(Math.PI / 2)], () => {
            renderCubeTop()
        })
        renderer.with([GTransform.rotateX(-Math.PI / 2)], () => {
            renderCubeTop()
        })
        renderer.with([GTransform.rotateY(Math.PI / 2)], () => {
            renderCubeTop()
        })
        renderer.with([GTransform.rotateY(-Math.PI / 2)], () => {
            renderCubeTop()
        })
    }

    function renderCube() {
        if (useMeshOnly.value) {
            renderCubeFrame()
        } else {
            renderCubeSolid()
        }
    }

    renderer.withCamera([
        getCameraTransform()
    ], () => {
        if (useFloorGrid.value) {
            const cells = 5
            const size = 10
            const side = size / (2 * cells)
            function drawLine(x1: number, y1: number, x2: number, y2: number) {
                renderer.renderLine(
                    [x1 * side, y1 * side, -1],
                    [x2 * side, y2 * side, -1],
                    [1, 1, 1, 1],
                )
            }
            for (let x = -cells; x <= cells; x++) {
                for (let y = -cells; y < cells; y++) {
                    drawLine(x, y, x, y + 1)
                }
            }
            for (let y = -cells; y <= cells; y++) {
                for (let x = -cells; x < cells; x++) {
                    drawLine(x, y, x + 1, y)
                }
            }
        }

        if (useLighting.value) {
            renderer.addLightSource({
                location: [3, -3, 0],
                ambient: ambientAmount.value,
                diffuse: diffuseAmount.value,
                specular: specularAmount.value,
            })
        }
        renderer.with([
            GTransform.rotateZ(rotation.value / 180 * Math.PI),
        ], () => {
            if (theModel === null) {
                const scale = 0.3

                renderer.with([
                    GTransform.translate(0, 0, 1),
                    GTransform.scale(scale, scale, scale),
                    GTransform.translate(0, 0, 1),
                ], () => {
                    renderCube()
                })
                renderCube()
            } else {
                const modelScale = 1
                renderer.with([
                    GTransform.scale(modelScale, modelScale, modelScale),
                    GTransform.rotateX(Math.PI / 2),
                ], () => {
                    if (theModel !== null) {
                        renderer.renderModel(theModel)
                        // renderer.renderModel(theModel, "wheel-front-right")
                    }
                })
            }
        })

        if (showAxes.value) {
            const originScale = 1
            renderer.renderLine([0, 0, 0], [originScale, 0, 0], COLOR_RED)
            renderer.renderLine([0, 0, 0], [0, originScale, 0], COLOR_GREEN)
            renderer.renderLine([0, 0, 0], [0, 0, originScale], COLOR_BLUE)
        }
    })

    // renderer2d.drawTriangle(
    //     [20, 20],
    //     [60, 40],
    //     [10, 40],
    // )

    // ctx.fillStyle = "blue"
    // renderer2d.drawPixel([0, 0])
    // renderer2d.drawBrLine(
    //     [20, 20],
    //     [10, 60],
    // )
    // renderer2d.drawBrLine(
    //     [20, 20],
    //     [60, 40],
    // )

    renderer2d.flush()
}

let xAngle = 0
let yAngle = 0
const cameraHeight = 0
const isRotating= bindBoolProp("is rotating", true)
const canvSize = bindProp("Canvas size", [100, 800], 500)
const rotation = bindProp("Rotation", [0, 360], 0)
const useLighting= bindBoolProp("Lighting", false)
const useMeshOnly= bindBoolProp("Mesh only", false)
const useFloorGrid= bindBoolProp("Floor grid", false)
const showAxes = bindBoolProp("Show Axes", false)
const ambientAmount = bindProp("Ambient", [0, 1], 0.7)
const diffuseAmount = bindProp("Diffuse", [0, 1], 0.5)
const specularAmount = bindProp("Specular", [0, 1], 1)
const mouseSensitivity = bindProp("Mouse sensitivity", [0.3, 3], 1)

const canvas = document.getElementById("canvas") as HTMLCanvasElement
const ctx = canvas.getContext("2d")!

function loadTexture(src: string) {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src
    let imageData: ImageData | null = null
    img.addEventListener("load", () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!

        ctx.drawImage(img, 0, 0);
        img.style.display = "none";
        imageData = ctx.getImageData(0, 0, img.width, img.height)
    });

    return function(ux: number, uy: number) {
        const x = Math.floor((img.width - 1) * ux)
        const y = Math.floor((img.height - 1) * (1 - uy))
        if (imageData == null) return null

        // console.log(`${x}, ${y}`)
        const index = y * imageData.width + x
        const i = index*4
        const d = imageData.data
        const f = 255
        return [d[i] / f,d[i+1] / f,d[i+2] / f,d[i+3] / f] as Vec4d
    }
}

type Texture = ReturnType<typeof loadTexture>

const boxTexture = loadTexture(boxUrl)

function makeColorShader(c1: Color, c2: Color, c3: Color): Shader {
    return function (w1, w2, w3) {
        return vec4Weighted(
            [w1, c1],
            [w2, c2],
            [w3, c3],
        )
    }
}

function makeTextureShader(texture: Texture, p1: Vec2d, p2: Vec2d, p3: Vec2d): Shader {
    return function (w1, w2, w3) {
        const [u, v] = [
            w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
            w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
        ]
        const color = texture(u, v)
        if (color === null) {
            return COLOR_CLEAR
        }
        return color

    }
}

function main() {
    const size = 200
    canvas.width = size
    canvas.height = size
    // canvas.width = document.documentElement.clientWidth
    // canvas.height = document.documentElement.clientHeight

    // document.documentElement.style.cursor = "none"

    canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            canvas.requestPointerLock()
        }
    })

    canvas.onmousemove = (event) => {
        // if (event.shiftKey) {
        if (document.pointerLockElement === canvas) {
            xAngle += -event.movementY * 0.003 * mouseSensitivity.value
            yAngle += -event.movementX * 0.003 * mouseSensitivity.value
        }
    }

    window.onkeydown = (event) => {
        keyProps.set(event.code, true)
    }

    window.onkeyup = (event) => {
        keyProps.set(event.code, false)
    }

    // renderLoopIteration()
    requestAnimationFrame(renderLoopIteration)
}

const keyProps = new KeyProps()
const isWPressed = keyProps.bind("KeyW")
const isSPressed = keyProps.bind("KeyS")
const isAPressed = keyProps.bind("KeyA")
const isDPressed = keyProps.bind("KeyD")
const isQPressed = keyProps.bind("KeyQ")
const isEPressed = keyProps.bind("KeyE")
const isUpPressed = keyProps.bind("ArrowUp")
const isDownPressed = keyProps.bind("ArrowDown")
const modelName = bindSelectProp("Model", [
    "cube",
    "van.obj",
    "firetruck.obj",
    "ambulance.obj",
    "teapot.obj",
], "cube", onModelNameChange)

const cameraPos = {
    x: 0,
    y: -5,
    z: 0.5,
}
function getCameraTransform(): GTransform {
    return GTransform.translate(cameraPos.x, cameraPos.y, cameraPos.z).mul(
        GTransform.translate(0, cameraHeight, 0).mul(
            GTransform.rotateZ(yAngle).mul(
                GTransform.rotateX(Math.PI / 2 + xAngle),
            ),
        ),
    )
}

function moveCamera(delta: number, dir: Vec3d) {
    const [dx, dy, dz] = dir
    const amount = delta / 1000 * 2
    const mat = getCameraTransform().mul(
        GTransform.translate(dx * amount, dy * amount, dz * amount),
    ).mat

    const [x, y, z] = matApply(mat, [0, 0, 0, 1])
    cameraPos.x = x
    cameraPos.y = y
    cameraPos.z = z
}

let startTime: number | null = null
let prevTime: number | null = null
let framesCount = 0
let prevFPSTime: number | null = null
const fpsCounter = document.getElementById("fpsCounter")!
function renderLoopIteration(timestamp: number) {
    if (startTime === null) {
        startTime = timestamp
    }
    if (prevFPSTime === null) {
        prevFPSTime = timestamp
    }
    if (prevTime === null) {
        prevTime = timestamp
    }
    const deltaFPS = timestamp - prevFPSTime
    if (deltaFPS >= 1000) {
        const fps = framesCount / deltaFPS * 1000
        framesCount = 0
        prevFPSTime = timestamp
        fpsCounter.innerText = `FPS: ${fps.toFixed(1)}`
    }
    if (isRotating.value) {
        rotation.value = (timestamp - startTime) / 1000 * 360 / 7
    }
    const delta = timestamp - prevTime
    if (isWPressed.value) {
        moveCamera(delta, [0, 0, -1])
    }
    if (isSPressed.value) {
        moveCamera(delta, [0, 0, 1])
    }
    if (isAPressed.value) {
        yAngle += (delta / 1000) * 0.7
    }
    if (isDPressed.value) {
        yAngle -= (delta / 1000) * 0.7
    }
    if (isUpPressed.value) {
        cameraPos.z += (delta / 1000) * 2
    }
    if (isDownPressed.value) {
        cameraPos.z -= (delta / 1000) * 2
    }
    if (isQPressed.value) {
        moveCamera(delta, [-1, 0, 0])
    }
    if (isEPressed.value) {
        moveCamera(delta, [1, 0, 0])
    }

    framesCount++
    render()
    prevTime = timestamp

    // setTimeout(renderLoopIteration, 30)
    requestAnimationFrame(renderLoopIteration)
}

main()

let theModel: Model | null = null
function onModelNameChange() {
    if (modelName.value === "cube") {
        theModel = null
    } else {
        fetchModel(modelName.value).then((model) => {
            theModel = model
        }).catch((error) => {
            console.error(error)
        })
    }
}
onModelNameChange()
