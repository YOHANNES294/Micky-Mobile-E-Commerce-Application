"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Phone } from "@/lib/types"

interface DeletePhoneDialogProps {
  phone: Phone
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhoneDeleted: (phoneId: string) => void
}

export function DeletePhoneDialog({ phone, open, onOpenChange, onPhoneDeleted }: DeletePhoneDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("phones").delete().eq("id", phone.id)

      if (error) throw error

      onPhoneDeleted(phone.id)
    } catch (err) {
      console.error("Failed to delete phone:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Phone</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <span className="font-semibold">{phone.model}</span>? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
