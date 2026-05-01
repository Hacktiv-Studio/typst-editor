import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
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
            onClick={() => { onConfirm(); onClose() }}
            className="px-3 py-1.5 text-xs bg-[#f38ba8] text-[#11111b] rounded-md hover:bg-[#e06c75] transition-colors"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-[#a6adc8]">{message}</p>
    </Dialog>
  )
}
