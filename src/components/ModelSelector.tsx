"use client"

import type React from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Settings, X, Sparkles, Brain, Bot, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import ApiKeyInput from "./ApiKeyInput"
import { useEffect, useState } from "react"
import { 
  Select, 
  SelectContent, 
  SelectItem,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { motion } from "framer-motion"

interface ApiKeys {
  gemini?: string
  openai?: string
  sensay?: string
}

interface ModelSelectorProps {
  useOpenAI: boolean
  onUseOpenAIChange: (value: boolean) => void
  showSettings: boolean
  onShowSettingsChange: (value: boolean) => void
  openaiApiKey: string
  onOpenAIApiKeyChange: (value: string) => void
  sensayApiKey?: string
  onSensayApiKeyChange?: (value: string) => void
  className?: string
  debugMode?: boolean
  onDebugModeChange?: (value: boolean) => void
  useSensay?: boolean
  setUseSensay?: (value: boolean) => void
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  useOpenAI,
  onUseOpenAIChange,
  showSettings,
  onShowSettingsChange,
  openaiApiKey,
  onOpenAIApiKeyChange,
  sensayApiKey = "",
  onSensayApiKeyChange = () => {},
  className,
  debugMode,
  onDebugModeChange,
  useSensay = true,
  setUseSensay = () => {}
}) => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({})
  const [selectedModel, setSelectedModel] = useState<string>(useSensay ? "sensay" : "gemini")

  useEffect(() => {
    try {
      const storedKeys = localStorage.getItem("apiKeys")
      if (storedKeys) {
        setApiKeys(JSON.parse(storedKeys))
      }
    } catch (error) {
      console.error("Error loading API keys:", error)
    }
  }, [])

  const handleModelChange = (value: string) => {
    setSelectedModel(value)
    
    // Update parent component state based on selection
    if (value === "gemini") {
      onUseOpenAIChange(true)
      setUseSensay(false)
    } else if (value === "sensay") {
      onUseOpenAIChange(false)
      setUseSensay(true)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowSettingsChange(!showSettings)}
            className={cn(
              "h-9 px-3 text-xs font-medium rounded-full shadow-sm transition-all",
              showSettings 
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 hover:opacity-90"
                : "hover:bg-gradient-to-r hover:from-violet-500/20 hover:to-fuchsia-500/20 hover:border-violet-300/50"
            )}
          >
            {showSettings ? 
              <motion.div initial={{ rotate: 0 }} animate={{ rotate: 90 }} transition={{ duration: 0.3 }}>
                <X className="h-3.5 w-3.5 mr-1" />
              </motion.div> : 
              <motion.div initial={{ rotate: 0 }} animate={{ rotate: 0 }} whileHover={{ rotate: 15 }} transition={{ duration: 0.2 }}>
                <Settings className="h-3.5 w-3.5 mr-1" />
              </motion.div>
            }
            {showSettings ? "Close Settings" : "Model Settings"}
          </Button>
          {debugMode !== undefined && onDebugModeChange && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex h-8 items-center space-x-1 rounded-full bg-muted px-3">
                <Label htmlFor="debug-mode" className="text-muted-foreground font-medium">
                  Debug
                </Label>
                <Switch
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={onDebugModeChange}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {!showSettings && (
          <motion.div 
            className="flex items-center gap-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-3 py-1.5 rounded-full"
            whileHover={{ scale: 1.03, boxShadow: "0 4px 12px rgba(192, 132, 252, 0.15)" }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <div className="flex items-center gap-1.5">
              {selectedModel === "sensay" ? (
                <motion.div initial={{ scale: 1 }} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}>
                  <Brain className="h-4 w-4 text-fuchsia-500" />
                </motion.div>
              ) : (
                <motion.div animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <Sparkles className="h-4 w-4 text-violet-500" />
                </motion.div>
              )}
              <span className="text-xs font-medium">
                {selectedModel === "sensay" ? "Sensay" : "Gemini 2.0"}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="border rounded-xl p-5 space-y-5 bg-gradient-to-br from-white to-violet-50 dark:from-gray-800 dark:to-gray-900 shadow-lg relative overflow-hidden"
        >
          {/* Background particles */}
          <motion.div 
            className="absolute top-5 right-5 w-20 h-20 rounded-full bg-fuchsia-200 dark:bg-fuchsia-900/20 filter blur-xl opacity-20 pointer-events-none"
            animate={{ x: [0, 10, 0], y: [0, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 5, repeat: Infinity, repeatType: "mirror" }}
          />
          <motion.div 
            className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-violet-200 dark:bg-violet-900/20 filter blur-xl opacity-20 pointer-events-none"
            animate={{ x: [0, -15, 0], y: [0, 10, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 7, repeat: Infinity, repeatType: "mirror" }}
          />
          
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-medium text-sm">AI Model Selection</h3>
            <motion.div whileHover={{ rotate: 15 }}>
              <Code className="h-4 w-4 text-violet-500" />
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Current Model:</Label>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    selectedModel === "sensay" ? "bg-fuchsia-500" : "bg-violet-500"
                  )}></div>
                  <span className="text-xs font-medium">
                    {selectedModel === "sensay" ? "Sensay" : "Gemini 2.0"}
                  </span>
                </div>
              </div>
              
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="h-9 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                      <span>Gemini 2.0</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sensay">
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-fuchsia-500" />
                      <span>Sensay</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <Label className="text-sm font-medium">Gemini API Key:</Label>
              </div>
              <ApiKeyInput
                value={openaiApiKey}
                onChange={onOpenAIApiKeyChange}
                placeholder="Enter Gemini API key"
                className="h-9 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus-visible:ring-violet-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-fuchsia-500" />
                <Label className="text-sm font-medium">Sensay API Key:</Label>
              </div>
              <ApiKeyInput
                value={sensayApiKey}
                onChange={onSensayApiKeyChange}
                placeholder="Enter Sensay API key"
                className="h-9 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 focus-visible:ring-fuchsia-500"
              />
              <div className="p-3 bg-gradient-to-r from-fuchsia-100/50 to-violet-100/50 dark:from-fuchsia-900/20 dark:to-violet-900/20 rounded-lg mt-3">
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-medium">✨ Recommended:</span> Sensay provides enhanced Web3 understanding with specialized blockchain knowledge.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default ModelSelector
