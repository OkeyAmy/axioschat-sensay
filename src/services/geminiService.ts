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
  try {
    const apiKeys = localStorage.getItem("apiKeys")
    if (apiKeys) {
      const parsed = JSON.parse(apiKeys)
      return parsed.gemini || ""
    }
  } catch (error) {
    console.error("Error retrieving Gemini API token:", error)
  }
  return ""
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

    while (retryCount <= maxRetries) {
      try {
        // Determine if we're in production or development
        const isProduction =
          typeof window !== "undefined" &&
          !window.location.hostname.includes("localhost") &&
          !window.location.hostname.includes("127.0.0.1")

        // Use the appropriate API endpoint
        const apiUrl = "/api/gemini_functions"

        console.log(`Calling Gemini function API at ${apiUrl}`)

        // Call the proxy server with a timeout to prevent hanging requests
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": GEMINI_API_KEY,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)

        console.log("Gemini Functions response status:", response.status)

        if (!response.ok) {
          let errorMessage = `Gemini Functions API Error (${response.status}): `
          try {
            const errorData = await response.json()
            console.error("Gemini Functions API Error Response:", errorData)
            errorMessage += errorData.detail || errorData.error || "Unknown error"
          } catch (e) {
            errorMessage += "Could not parse error response"
          }
          throw new Error(errorMessage)
        }

        responseData = await response.json()
        console.log("Gemini Functions response data:", responseData)

        // Check if we got a valid response with output
        if (!responseData.output) {
          console.log(`Attempt ${retryCount + 1}: Gemini returned no output. Retrying...`)
          retryCount++

          if (retryCount <= maxRetries) {
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
            continue
          }
        } else {
          // We got a valid response, break out of the retry loop
          break
        }
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error)
        
        // Check for timeout/abort errors
        if (error instanceof DOMException && error.name === "AbortError") {
          console.error("Request timed out")
          return { error: "Request timed out. Please try again." }
        }
        
        retryCount++

        if (retryCount <= maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
          continue
        }
        throw error
      }
    }

    if (!responseData) {
      return { error: "No response from Gemini" }
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