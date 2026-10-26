"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, Trash2, Edit3, User as UserIcon, Shield, Loader2, Mail, Calendar, Key, Plus } from "lucide-react"
import type { User } from "@/lib/types"
import { getUsers, deleteUser, resetUserPassword, createAdminAccount } from "@/app/actions/user-actions"
import { format } from "date-fns"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"

interface UserManagementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function UserManagementDialog({ open, onOpenChange }: UserManagementDialogProps) {
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showAddAdmin, setShowAddAdmin] = useState(false)
    const [newAdminEmail, setNewAdminEmail] = useState("")
    const [newAdminPassword, setNewAdminPassword] = useState("")
    const [isCreating, setIsCreating] = useState(false)

    useEffect(() => {
        if (open) {
            fetchUsers()
        }
    }, [open])

    const fetchUsers = async () => {
        setIsLoading(true)
        const result = await getUsers()
        if (result.success && result.users) {
            setUsers(result.users)
        } else {
            toast.error("Failed to fetch users")
        }
        setIsLoading(false)
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
            return
        }

        setDeletingId(userId)
        const result = await deleteUser(userId)

        if (result.success) {
            setUsers(users.filter(u => u.id !== userId))
            toast.success("User deleted successfully")
        } else {
            toast.error(result.error || "Failed to delete user")
        }
        setDeletingId(null)
    }

    const handleResetPassword = async (email: string) => {
        if (!confirm(`Send password reset email to ${email}?`)) {
            return
        }

        toast.loading("Sending reset email...")
        const result = await resetUserPassword(email)
        toast.dismiss()

        if (result.success) {
            toast.success("Password reset email sent")
        } else {
            toast.error(result.error || "Failed to send reset email")
        }
    }

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAdminEmail || !newAdminPassword) {
            toast.error("Please fill in all fields")
            return
        }

        setIsCreating(true)
        const result = await createAdminAccount({ email: newAdminEmail, password: newAdminPassword })

        if (result.success) {
            toast.success("Admin account created successfully")
            setShowAddAdmin(false)
            setNewAdminEmail("")
            setNewAdminPassword("")
            fetchUsers()
        } else {
            toast.error(result.error || "Failed to create admin account")
        }
        setIsCreating(false)
    }

    const filteredUsers = users.filter((user) =>
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const clients = filteredUsers.filter((u) => u.role === "client")
    const admins = filteredUsers.filter((u) => u.role === "admin")

    const UserList = ({ list }: { list: User[] }) => {
        if (list.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <UserIcon className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg">No users found</p>
                </div>
            )
        }

        return (
            <div className="bg-white rounded-lg border border-coral-100 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-coral-50 hover:bg-coral-50">
                            <TableHead className="font-semibold">Role</TableHead>
                            <TableHead className="font-semibold">User</TableHead>
                            <TableHead className="font-semibold">Joined</TableHead>
                            <TableHead className="text-right font-semibold">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={
                                            user.role === "admin"
                                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                                : "bg-coral-50 text-coral-700 border-coral-200"
                                        }
                                    >
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{user.email || "Unknown Email"}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="text-sm">{format(new Date(user.created_at), "MMM d, yyyy")}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-gold-200 hover:bg-gold-50 text-gold-600 bg-transparent"
                                            onClick={() => handleResetPassword(user.email)}
                                            title="Send Password Reset Email"
                                        >
                                            <Key className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-200 hover:bg-red-50 text-red-600 bg-transparent"
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={deletingId === user.id}
                                        >
                                            {deletingId === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[95vh] p-0 overflow-hidden">
                <DialogHeader className="px-8 pt-8 pb-6 border-b flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-3xl font-bold">User Management</DialogTitle>
                        <DialogDescription className="text-lg mt-2">
                            Manage users, view roles, and handle account deletions.
                        </DialogDescription>
                    </div>
                    {!showAddAdmin && (
                        <Button
                            onClick={() => setShowAddAdmin(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Admin
                        </Button>
                    )}
                </DialogHeader>

                <div className="flex flex-col h-full px-8 pb-8">
                    {showAddAdmin ? (
                        <div className="bg-purple-50 p-6 rounded-lg border border-purple-100 my-8">
                            <h3 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                Create New Admin Account
                            </h3>
                            <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="admin-email">Email Address</Label>
                                    <Input
                                        id="admin-email"
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={newAdminEmail}
                                        onChange={(e) => setNewAdminEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="admin-password">Password</Label>
                                    <Input
                                        id="admin-password"
                                        type="password"
                                        placeholder="Minimum 6 characters"
                                        value={newAdminPassword}
                                        onChange={(e) => setNewAdminPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAddAdmin(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                        disabled={isCreating}
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            "Create Admin Account"
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="relative my-8">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="Search users by email..."
                                className="pl-12 py-6 text-base border-gray-300"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}

                    <Tabs defaultValue="all" className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 mb-8">
                            <TabsTrigger value="all" className="text-lg py-3 rounded-lg data-[state=active]:bg-coral-600 data-[state=active]:text-white">
                                All Users ({filteredUsers.length})
                            </TabsTrigger>
                            <TabsTrigger value="clients" className="text-lg py-3 rounded-lg data-[state=active]:bg-coral-600 data-[state=active]:text-white">
                                Clients ({clients.length})
                            </TabsTrigger>
                            <TabsTrigger value="admins" className="text-lg py-3 rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                                Admins ({admins.length})
                            </TabsTrigger>
                        </TabsList>

                        <ScrollArea className="flex-1 -mx-8 px-8">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-96">
                                    <Loader2 className="w-12 h-12 text-coral-600 animate-spin" />
                                </div>
                            ) : (
                                <>
                                    <TabsContent value="all" className="mt-0">
                                        <UserList list={filteredUsers} />
                                    </TabsContent>
                                    <TabsContent value="clients" className="mt-0">
                                        <UserList list={clients} />
                                    </TabsContent>
                                    <TabsContent value="admins" className="mt-0">
                                        <UserList list={admins} />
                                    </TabsContent>
                                </>
                            )}
                        </ScrollArea>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}