"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    const isDark = theme === "dark"

    return (
        <div
            className="flex items-center space-x-2 bg-slate-200 dark:bg-slate-800 rounded-full p-1 cursor-pointer w-16 h-8 relative transition-colors duration-300"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            role="button"
            tabIndex={0}
        >
            <span className="sr-only">Toggle theme</span>

            {/* Sun Icon */}
            <div className="z-10 w-6 h-6 flex items-center justify-center text-yellow-500">
                <Sun className="w-4 h-4" />
            </div>

            {/* Moon Icon */}
            <div className="z-10 w-6 h-6 flex items-center justify-center text-slate-900 dark:text-slate-100 ml-auto">
                <Moon className="w-4 h-4" />
            </div>

            {/* Sliding Pill */}
            <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white dark:bg-slate-600 rounded-full shadow-md transform transition-transform duration-300 ease-spring ${isDark ? "translate-x-8" : "translate-x-0"
                    }`}
            />
        </div>
    )
}
