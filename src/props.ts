export type Prop<T> = {
    value: T,
}

export class KeyProps {
    private readonly props: Map<string, Prop<boolean>> = new Map()

    bind(code: string): Prop<boolean> {
        const prop: Prop<boolean> = {
            value: false,
        }

        this.props.set(code, prop)

        return prop
    }

    set(code: string, value: boolean): boolean {
        const prop = this.props.get(code)
        if (prop === undefined) { return false }

        prop.value = value

        return true
    }
}

export function bindProp(name: string, [min, max]: [number, number], initial: number): Prop<number> {
    const prop: Prop<number> = {
        value: initial,
    }
    const div = document.createElement('div')

    const input= document.createElement('input')
    input.type = 'range'
    input.id = name
    input.min = min.toString()
    input.max = max.toString()
    input.step = "any"

    input.valueAsNumber = prop.value
    input.oninput = () => {
        prop.value = input.valueAsNumber
        updateLabel()
    }

    const label = document.createElement('label')
    updateLabel()
    div.appendChild(input)
    div.appendChild(label)

    function updateLabel() {
        label.innerText = String(`${name}: ${prop.value.toFixed(2)}`)
    }

    document.getElementById("props")?.appendChild(div)
    return prop
}

export function bindBoolProp(name: string, initial: boolean): Prop<boolean> {
    const prop: Prop<boolean> = {
        value: initial,
    }
    const div = document.createElement('div')

    const input= document.createElement('input')
    input.type = 'checkbox'
    input.id = name

    input.checked = prop.value
    input.oninput = () => {
        prop.value = input.checked
        updateLabel()
    }

    const label = document.createElement('label')
    updateLabel()
    div.appendChild(input)
    div.appendChild(label)

    function updateLabel() {
        label.innerText = String(`${name}`)
    }

    document.getElementById("props")?.appendChild(div)
    return prop
}

export function bindSelectProp(name: string, options: string[], initial: string, onChange: () => void): Prop<string> {
    const prop: Prop<string> = {
        value: initial,
    }
    const div = document.createElement('div')

    const input= document.createElement('select')
    input.id = name

    input.value = prop.value
    input.oninput = () => {
        prop.value = input.value
        input.blur()
        updateLabel()
        onChange()
    }

    for (const option of options) {
        const optionElement = document.createElement('option')
        optionElement.value = option
        optionElement.innerText = option
        input.appendChild(optionElement)
    }

    const label = document.createElement('label')
    updateLabel()
    div.appendChild(input)
    div.appendChild(label)

    function updateLabel() {
        label.innerText = String(`${name}: ${prop.value}`)
    }

    document.getElementById("props")?.appendChild(div)
    return prop
}
