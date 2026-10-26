"use client"

import type { Phone } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2 } from "lucide-react"
import { useState } from "react"
import { EditPhoneDialog } from "@/components/admin/edit-phone-dialog"
import { DeletePhoneDialog } from "@/components/admin/delete-phone-dialog"

interface PhoneManagementProps {
  phones: Phone[]
  onPhoneUpdated: (phone: Phone) => void
  onPhoneDeleted: (phoneId: string) => void
}

export function PhoneManagement({ phones, onPhoneUpdated, onPhoneDeleted }: PhoneManagementProps) {
  const [editingPhone, setEditingPhone] = useState<Phone | null>(null)
  const [deletingPhone, setDeletingPhone] = useState<Phone | null>(null)

  if (phones.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-coral-100">
        <p className="text-muted-foreground">No phones found in this category.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-coral-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-coral-50 dark:bg-coral-950/30 hover:bg-coral-50 dark:hover:bg-coral-950/30">
              <TableHead className="font-semibold">Brand</TableHead>
              <TableHead className="font-semibold">Model</TableHead>
              <TableHead className="font-semibold">Storage</TableHead>
              <TableHead className="font-semibold">RAM</TableHead>
              <TableHead className="font-semibold">Price (ETB)</TableHead>
              <TableHead className="font-semibold">SIM</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phones.map((phone) => (
              <TableRow key={phone.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      phone.brand === "Samsung"
                        ? "border-gold-200 bg-gold-50 dark:bg-gold-950/30 text-gold-700 dark:text-gold-400"
                        : "border-coral-200 bg-coral-50 dark:bg-coral-950/30 text-coral-700 dark:text-coral-400"
                    }
                  >
                    {phone.brand}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{phone.model}</TableCell>
                <TableCell>{phone.storage}</TableCell>
                <TableCell>{phone.ram}</TableCell>
                <TableCell className="font-semibold">{phone.price}</TableCell>
                <TableCell>{phone.sim}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPhone(phone)}
                      className="border-coral-200 hover:bg-coral-50 bg-transparent"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingPhone(phone)}
                      className="border-red-200 hover:bg-red-50 text-red-600 bg-transparent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingPhone && (
        <EditPhoneDialog
          phone={editingPhone}
          open={!!editingPhone}
          onOpenChange={(open) => !open && setEditingPhone(null)}
          onPhoneUpdated={(updated) => {
            onPhoneUpdated(updated)
            setEditingPhone(null)
          }}
        />
      )}

      {deletingPhone && (
        <DeletePhoneDialog
          phone={deletingPhone}
          open={!!deletingPhone}
          onOpenChange={(open) => !open && setDeletingPhone(null)}
          onPhoneDeleted={(id) => {
            onPhoneDeleted(id)
            setDeletingPhone(null)
          }}
        />
      )}
    </>
  )
}
