'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertTriangle } from 'lucide-react'

export interface PermanentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  warningDescription: string
  checkboxLabel?: string
  checkboxHint?: string
  deleteRelatedOption?: boolean
  onDeleteRelatedOptionChange?: (val: boolean) => void
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function PermanentDeleteDialog({
  open,
  onOpenChange,
  itemName,
  warningDescription,
  checkboxLabel,
  checkboxHint,
  deleteRelatedOption = false,
  onDeleteRelatedOptionChange,
  isDeleting,
  onConfirm,
  onCancel,
}: PermanentDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-base sm:text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            تأكيد الحذف النهائي — {itemName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-5 text-sm">
          {/* Warning Box */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-destructive">
            <p className="font-semibold text-sm leading-relaxed">
              ⚠️ تحذير: هذا الإجراء قد يتسبب في مشاكل في بيانات الفواتير، هل تريد الإكمال؟
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {warningDescription}
            </p>
          </div>

          {/* Optional Related Cascade Checkbox */}
          {checkboxLabel && (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/40 transition-colors">
              <Checkbox
                id="permanent-delete-related-checkbox"
                checked={deleteRelatedOption}
                onCheckedChange={(v) => onDeleteRelatedOptionChange?.(!!v)}
                className="mt-0.5 accent-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
              />
              <div className="grid gap-1.5 leading-none select-none">
                <label
                  htmlFor="permanent-delete-related-checkbox"
                  className="text-sm font-medium leading-tight cursor-pointer text-foreground"
                >
                  {checkboxLabel}
                </label>
                {checkboxHint && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {checkboxHint}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-5 bg-muted/30 border-t border-border gap-2 sm:gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'جارٍ الحذف النهائي...' : 'تأكيد الحذف النهائي'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
