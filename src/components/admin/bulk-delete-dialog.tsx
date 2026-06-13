"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  count: number;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  count,
  onConfirm,
  loading = false,
  confirmLabel = "Delete",
}: BulkDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description.replace("{count}", String(count))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading || count === 0}>
            {loading ? "Deleting..." : `${confirmLabel} (${count})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
