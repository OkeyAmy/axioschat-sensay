import { toast } from "@/components/ui/use-toast"

export interface GeminiFunctionRequest {
  query: string
  tools: string
  top_p?: number
  temperature?: number
  max_output_tokens?: number
}

// Get Gemini API token from localStorage
const getGeminiApiToken = (): string => {
  let token = ""
  try {
    const apiKeys = localStorage.getItem("apiKeys")
    if (apiKeys) {
      const parsed = JSON.parse(apiKeys)
      if (parsed.gemini) token = parsed.gemini
    }
  } catch (error) {
    console.error("Error retrieving Gemini API token from localStorage:", error)
  }
  // Fallback to environment variables if not found in localStorage
  if (!token) {
    token = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
    if (token) console.log("Using Gemini API key from environment variable")
  }
  return token
}

// Call Gemini model for function calling with retry mechanism for stability
export const callGeminiForFunctions = async (
  input: GeminiFunctionRequest,
): Promise<string | { text?: string; error?: string; functionCalls?: any[] }> => {
  try {
    const GEMINI_API_KEY = getGeminiApiToken()

    if (!GEMINI_API_KEY) {
      toast({
        title: "API Token Missing",
        description: "Please provide a Gemini API key in the settings",
        variant: "destructive",
      })
      return "Error: Please provide a Gemini API key in the settings"
    }

    console.log("Calling Gemini API with input:", {
      query: input.query.substring(0, 50) + "...",
      temperature: input.temperature,
      top_p: input.top_p,
    })

    // Format the request body for Gemini's API 
    const requestBody = {
      query: input.query,
      tools: input.tools, // Same tools JSON string format as used with Replicate
      top_p: input.top_p || 0.9,
      temperature: input.temperature || 0.7,
      max_output_tokens: input.max_output_tokens || 3000,
      model: "gemini-2.0-flash" // Using a Gemini model with reliable function calling capability
    }

    console.log("Request body:", JSON.stringify(requestBody, null, 2))

    // Implement retry mechanism for stability
    const maxRetries = 2
    let retryCount = 0
    let responseData

    // Always call the deployed Render endpoint directly
    const apiUrl = 'https://axioschat-sensay.onrender.com/api/gemini_functions'

    // Retry local proxy then fallback to deployed Render server
    const fallbackBaseUrl = "https://axioschat-sensay.onrender.com"
    try {
      while (retryCount <= maxRetries) {
        console.log(`Calling local Gemini API at ${apiUrl}`)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": GEMINI_API_KEY,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        console.log("Local response status:", response.status)
        if (!response.ok) {
          let errMsg = `Local proxy error (${response.status}): `
          try {
            const errJson = await response.json()
            errMsg += errJson.error || JSON.stringify(errJson)
          } catch {}
          throw new Error(errMsg)
        }
        responseData = await response.json()
        console.log("Local response data:", responseData)
        if (!responseData.output) {
          retryCount++
          console.log(`Attempt ${retryCount}: no output, retrying...`)
          if (retryCount <= maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * 2 ** retryCount))
            continue
          }
        }
        break
      }
    } catch (localErr) {
      console.warn("Local proxy failed, falling back to Render server:", localErr)
      const remoteUrl = `${fallbackBaseUrl}/api/gemini_functions`
      console.log(`Calling remote fallback at ${remoteUrl}`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const response = await fetch(remoteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-API-Key": GEMINI_API_KEY,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) {
        throw new Error(`Remote fallback error (${response.status})`)
      }
      responseData = await response.json()
      console.log("Remote fallback data:", responseData)
    }
    if (!responseData) {
      return { error: "No response from local or remote Gemini endpoints" }
    }
    
    if (responseData.error) {
      console.error("Error from Gemini API:", responseData.error)
      return { error: responseData.error }
    }
    
    if (responseData.status === "partial_failure") {
      // Handle partial failures with a text response
      return { text: responseData.output || "I couldn't process your request properly. Please try rephrasing your question." }
    }

    // Handle the output from the Gemini API
    if (responseData.output) {
      console.log("Complete output from Gemini:", responseData.output)

      // If the output is a plain text response, return it
      if (typeof responseData.output === "string") {
        return responseData.output
      }

      // If the output is an array of function calls
      if (Array.isArray(responseData.output)) {
        console.log("Function calls found:", responseData.output.length)
        return { 
          functionCalls: responseData.output,
          text: responseData.text_if_any || "I need to perform some actions to answer your question."
        }
      }

      // If we can't determine the format, return the raw output as text
      return { text: typeof responseData.output === 'object' ? 
        JSON.stringify(responseData.output) : 
        String(responseData.output) 
      }
    } else if (responseData.text_if_any) {
      // If there's a text response but no function calls
      return { text: responseData.text_if_any }
    }

    return {
      text: "The model did not return a valid response. This may indicate an issue with the API or the model configuration.",
    }
  } catch (error) {
    console.error("Error calling Gemini Functions model via proxy:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred while calling the AI model"

    toast({
      title: "API Error",
      description: errorMessage,
      variant: "destructive",
    })

    return { error: `Error: ${errorMessage}` }
  }
}

// We can reuse the same tools JSON definition from replicateProxyService.ts
// This is exported from there and imported where needed 