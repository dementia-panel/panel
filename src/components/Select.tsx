import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Option = { value: string; label: string; lang?: string }

export function Select({
  value,
  options,
  onChange,
  labelledBy,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  labelledBy: string
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  function show() {
    setActive(selected)
    setOpen(true)
  }
  function choose(index: number) {
    if (!options[index]) return
    onChange(options[index].value)
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return (
    <div
      className="custom-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-labelledby={labelledBy}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
          } else if (event.key === 'Tab') setOpen(false)
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) show()
            else
              setActive(
                (index) =>
                  (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length,
              )
          } else if (open && (event.key === 'Home' || event.key === 'End')) {
            event.preventDefault()
            setActive(event.key === 'Home' ? 0 : options.length - 1)
          } else if (open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            choose(active)
          }
        }}
      >
        <span lang={options[selected]?.lang}>{options[selected]?.label}</span>
        <ChevronDown size={15} className={open ? 'select-chevron is-open' : 'select-chevron'} />
      </button>
      {open && (
        <ul id={id} role="listbox" aria-labelledby={labelledBy} className="select-menu">
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={value === option.value}
              lang={option.lang}
              className={active === index ? 'select-option is-active' : 'select-option'}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
