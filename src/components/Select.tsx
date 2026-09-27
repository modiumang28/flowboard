import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Check, ChevronDown } from 'lucide-react'

/*
  A native <select> renders its menu over the field on macOS, which hides the
  field you are changing. Headless UI's Listbox anchors the menu below instead.

  `anchor` positions the menu with Floating UI, which writes inline positioning
  styles. That is the same library-required exception the brief allows for
  drag-and-drop transforms, and it is noted in the README. No layout or theming
  of ours uses inline styles.
*/

export interface SelectOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}

export function Select<T extends string>({ label, value, options, onChange }: Props<T>) {
  const selected = options.find((option) => option.value === value)

  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton
        aria-label={label}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-card border border-line bg-white px-2 py-1.5 text-left text-sm text-slate-800 transition hover:border-slate-300 focus:border-brand focus:outline-none data-open:border-brand"
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </ListboxButton>

      <ListboxOptions
        anchor="bottom start"
        transition
        className="z-50 w-(--button-width) rounded-card border border-line bg-white p-1 shadow-pop [--anchor-gap:4px] focus:outline-none data-closed:opacity-0"
      >
        {options.map((option) => (
          <ListboxOption
            key={option.value}
            value={option.value}
            className="group flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm text-slate-700 select-none data-focus:bg-slate-100 data-selected:font-medium data-selected:text-brand"
          >
            <span className="truncate">{option.label}</span>
            <Check size={14} className="hidden shrink-0 group-data-selected:block" />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}
