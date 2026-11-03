import { createSignal, onCleanup, onMount } from 'solid-js'
import { exportCharacter } from './lib/exporter'
import s from './widget.module.css'

export const Widget = () => {
  let ref!: HTMLDivElement

  const [open, setOpen] = createSignal(false)
  const [scale, setScale] = createSignal(1)
  const [separateBase, setSeparateBase] = createSignal(false)
  const [filename, setFilename] = createSignal('hero')
  const [format, setFormat] = createSignal<'stl' | 'glb'>('stl')

  const handleToggle = () => {
    setOpen(!open())

    if (open()) {
      ref.style.top = `${Math.max(document.documentElement.clientHeight - 352 - 25, 25)}px`
    } else {
      ref.style.top = `${Math.max(document.documentElement.clientHeight - 48 - 25, 25)}px`
    }
  }

  const fixPosition = () => {
    ref.style.top = `${Math.max(document.documentElement.clientHeight - ref.clientHeight - 25, 25)}px`
    ref.style.left = '25px'
  }

  onMount(() => {
    window.addEventListener('resize', fixPosition)
    fixPosition()
  })

  onCleanup(() => {
    window.removeEventListener('resize', fixPosition)
  })

  const handleExport = (e: Event) => {
    e.preventDefault()

    exportCharacter({
      scale: 10 * scale(),
      filename: filename(),
      separateBase: separateBase(),
      format: format(),
    })
  }

  return (
    <div id="heroforge-exporter" ref={ref} class={s.root} classList={{ [s.open]: open() }}>
      <div class={s.header}>
        <div class={s.title}>HeroForge Exporter</div>
        <button type="button" class={s.toggle} onClick={handleToggle}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <title>Maximize</title>
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      </div>
      <div class={s.content}>
        <div class={s.field}>
          <label for="scale">Scale</label>
          <input
            class={s.input}
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            id="scale"
            value={scale()}
            onInput={(e) => setScale(Number((e.target as HTMLInputElement).value))}
          />
        </div>
        <div class={s.field}>
          <label for="format">Format</label>
          <select
            class={s.input}
            id="format"
            value={format()}
            onInput={(e) => setFormat((e.target as HTMLSelectElement).value as 'stl' | 'glb')}
          >
            <option value="stl">STL (3D printing)</option>
            <option value="glb">GLB (Blender / Unity)</option>
          </select>
        </div>
        <div class={s.note}>GLB includes UVs and textures that the current HeroForge scene makes available.</div>
        <div class={s.field}>
          <label for="filename">Filename</label>
          <input
            class={s.input}
            type="text"
            id="filename"
            value={filename()}
            onInput={(e) => setFilename((e.target as HTMLInputElement).value)}
          />
        </div>
        <div
          classList={{ [s.field]: true, [s.row]: true }}
          style={{ display: format() === 'stl' ? undefined : 'none' }}
        >
          <label for="separateBase">Separate base</label>
          <div class={s.checkbox}>
            <input
              type="checkbox"
              id="separateBase"
              checked={separateBase()}
              onInput={(e) => setSeparateBase((e.target as HTMLInputElement).checked)}
            />
          </div>
        </div>
        <input class={s.button} type="submit" value="Export" onClick={handleExport} />
      </div>
    </div>
  )
}
