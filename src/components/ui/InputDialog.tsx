import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'

interface InputDialogProps {
  title: string
  label: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onClose: () => void
}

export function InputDialog({ title, label, defaultValue = '', onConfirm, onClose }: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) { onConfirm(trimmed); onClose() }
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#a6adc8] hover:text-[#cdd6f4] rounded-md hover:bg-[#313244] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-3 py-1.5 text-xs bg-[#89b4fa] text-[#11111b] rounded-md hover:bg-[#74c7ec] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmer
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="block text-xs text-[#a6adc8] mb-1.5">{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-[#313244] border border-[#45475a] rounded-md px-3 py-1.5 text-sm text-[#cdd6f4] outline-none focus:border-[#89b4fa] transition-colors"
        />
      </form>
    </Dialog>
  )
}
