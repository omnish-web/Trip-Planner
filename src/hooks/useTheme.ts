import { useState, useEffect } from 'react'

export function useTheme() {
    const [isDark, setIsDark] = useState(() => {
        // Enforce Light theme by default (user request)
        // Only return true if strictly saved as 'dark'
        // Ignore system preferences to prioritize app default
        if (typeof window === 'undefined') return false

        try {
            const savedTheme = localStorage.getItem('theme')
            return savedTheme === 'dark'
        } catch (e) {
            return false
        }
    })

    useEffect(() => {
        try {
            const root = document.documentElement
            if (isDark) {
                root.classList.add('dark')
                localStorage.setItem('theme', 'dark')
            } else {
                root.classList.remove('dark')
                localStorage.setItem('theme', 'light')
            }
        } catch (e) {
            console.error('Failed to set theme:', e)
        }
    }, [isDark])

    const toggleTheme = () => {
        setIsDark(prev => !prev)
    }

    return { isDark, toggleTheme }
}
