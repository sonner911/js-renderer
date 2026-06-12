import {GTransform, type Mat4d} from "./matops.ts";

export class TransformStack {
    private stack: GTransform[] = [GTransform.IDENTITY]

    pushForward(transform: GTransform) {
        this.stack.push(this.top.mul(transform))
    }

    pop(): GTransform {
        const res = this.stack.pop()
        if (res === undefined) {
            throw new Error("cannot pop, stack is empty")
        }
        return res
    }

    get top(): GTransform {
        return this.stack[this.stack.length - 1]
    }

    with(transforms: GTransform[], block: () => void) {
        for (const transform of transforms) {
            this.pushForward(transform)
        }
        block()
        for (const {} of transforms) {
            this.pop()
        }
    }
}
