"use client"

import { useState, useEffect } from "react"

export interface ApiKeys {
  replicate: string
  openai: string // For backwards compatibility
  gemini: string // New explicit Gemini key
  sensay: string // Sensay API key
}

const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ 
    replicate: "", 
    openai: "", 
    gemini: "", 
    sensay: "" 
  })
  const [isLoaded, setIsLoaded] = useState(false)

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem("apiKeys")
    // Environment fallback for Sensay key (Vite env variable)
    const envSensay = import.meta.env.VITE_SENSAY_API_KEY || ""
    if (savedKeys) {
      try {
        const parsedKeys = JSON.parse(savedKeys) as Partial<ApiKeys>
        
        // Handle both gemini and openai keys for backward compatibility
        const geminiKey = parsedKeys.gemini || parsedKeys.openai || ""
        
        // Use envSensay if localStorage missing sensay
        const sensayKey = parsedKeys.sensay || envSensay
        
        setApiKeys({
          replicate: parsedKeys.replicate || "",
          openai: parsedKeys.openai || "",
          gemini: geminiKey,
          sensay: sensayKey
        })
      } catch (error) {
        console.error("Failed to parse API keys from localStorage:", error)
      }
    } else {
      // No saved keys: load envSensay if available
      setApiKeys((prev) => ({ ...prev, sensay: envSensay }))
    }
    setIsLoaded(true)
  }, [])

  // Update API key and save to localStorage
  const updateApiKey = (key: keyof ApiKeys, value: string) => {
    setApiKeys((prev) => {
      const newKeys = { ...prev, [key]: value }
      
      // If updating the Gemini key, also update openai key for backward compatibility
      if (key === 'gemini') {
        newKeys.openai = value
      }
      
      localStorage.setItem("apiKeys", JSON.stringify(newKeys))
      return newKeys
    })
  }

  return {
    apiKeys,
    updateApiKey,
    isLoaded,
  }
}

export default useApiKeys
