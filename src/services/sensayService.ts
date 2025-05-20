import { SensayAPI } from '../sensay-sdk';
import { ChatMessage } from './aiService';
import { SAMPLE_USER_ID, API_VERSION } from '@/constants/auth';

// Define types for Sensay interactions
interface SensayMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
}

// Get API key from environment variables or localStorage
const getSensayApiKey = (): string => {
  // Try environment variable (requires VITE_SENSAY_API_KEY in .env)
  const envKey = import.meta.env.VITE_SENSAY_API_KEY || import.meta.env.VITE_SENSAY_API_KEY_SECRET;
  if (envKey && envKey !== "") {
    return envKey;
  }
  // Fallback to localStorage
  try {
    const apiKeys = localStorage.getItem("apiKeys");
    if (apiKeys) {
      const parsed = JSON.parse(apiKeys);
      return parsed.sensay || "";
    }
  } catch (error) {
    console.error("Error retrieving Sensay API key from localStorage:", error);
  }
  return "";
};

// Initialize Sensay client
export const initializeSensayClient = () => {
  const apiKey = getSensayApiKey();
  
  if (!apiKey) {
    throw new Error("Sensay API key is required");
  }
  
  return new SensayAPI({
    HEADERS: {
      'X-ORGANIZATION-SECRET': apiKey,
      'X-USER-ID': SAMPLE_USER_ID,
      'X-API-Version': API_VERSION
    }
  });
};

// Get or create a Sensay replica for the user
export const getSensayReplica = async (): Promise<string> => {
  try {
    const client = initializeSensayClient();
    
    // Get all user's replicas
    const replicas = await client.replicas.getV1Replicas();
    
    // Attempt to find the replica with slug 'axioschat_v2'
    if (replicas.items && replicas.items.length > 0) {
      const targetReplica = replicas.items.find(replica => replica.slug === "axioschat_v2");
      if (targetReplica) {
        console.log("Found target replica 'axioschat_v2':", targetReplica.uuid);
        return targetReplica.uuid;
      }
      
      // If 'axioschat_v2' is not found, use the first available replica as a fallback
      console.log("'axioschat_v2' not found, using first available replica:", replicas.items[0].uuid);
      return replicas.items[0].uuid;
    }
    
    // If no replica exists, create one
    console.log("No replica found, creating a new one...");
    
    // Generate a unique slug
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueSlug = `axioschat-fallback-${timestamp}-${randomStr}`;
    
    // Create a new replica
    const newReplica = await client.replicas.postV1Replicas(API_VERSION, {
      name: "Axioschat Fallback Replica",
      shortDescription: "A fallback replica for Axioschat integration",
      greeting: "Hello, I'm your Axioschat assistant powered by Sensay.",
      slug: uniqueSlug,
      ownerID: SAMPLE_USER_ID,
      llm: {
        model: "claude-3-7-sonnet-latest",
        memoryMode: "prompt-caching",
        systemMessage: "You are a helpful assistant that provides clear and concise responses."
      }
    });
    
    console.log("Created new fallback replica:", newReplica.uuid);
    return newReplica.uuid;
  } catch (error) {
    console.error("Error initializing Sensay replica:", error);
    throw error;
  }
};

// Use Sensay for standard chat completions
export const callSensay = async (messages: ChatMessage[]): Promise<string> => {
  try {
    const apiKey = getSensayApiKey();
    
    if (!apiKey) {
      return "Please provide a Sensay API key in the settings to use the chatbot.";
    }
    
    // Extract the last user message
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === "user");
    
    if (!lastUserMessage) {
      return "No user message found to send to Sensay.";
    }
    
    // Initialize client and get replica ID
    const client = initializeSensayClient();
    const replicaId = await getSensayReplica();
    
    console.log("Using Sensay replica:", replicaId);
    
    // Call Sensay API with standard completions endpoint
    const response = await client.chatCompletions.postV1ReplicasChatCompletions(
      replicaId,
      API_VERSION,
      {
        content: lastUserMessage.content,
        source: "web",
        skip_chat_history: false
      }
    );
    
    // Return the content
    return response.content || "No response from Sensay";
  } catch (error) {
    console.error("Error calling Sensay:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

// Use Sensay for OpenAI-compatible chat completions (with conversation context)
export const callSensayWithContext = async (messages: ChatMessage[]): Promise<string> => {
  try {
    const apiKey = getSensayApiKey();
    
    if (!apiKey) {
      return "Please provide a Sensay API key in the settings to use the chatbot.";
    }
    
    // Convert messages to Sensay-compatible format
    const sensayMessages = messages.map(msg => {
      const role = msg.role === 'function' ? 'tool' : msg.role as 'user' | 'assistant' | 'system' | 'tool';
      return {
        role: role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        name: msg.name
      };
    });
    
    // Initialize client and get replica ID
    const client = initializeSensayClient();
    const replicaId = await getSensayReplica();
    
    console.log("Using Sensay replica with context:", replicaId);
    
    // Call Sensay API with experimental endpoint that supports full message context
    const response = await client.chatCompletions.postV1ExperimentalReplicasChatCompletions(
      replicaId,
      {
        messages: sensayMessages,
        source: "web",
        store: true
      }
    );
    
    // Return the content from the OpenAI-compatible response format
    if (response.choices && response.choices.length > 0 && response.choices[0].message) {
      return response.choices[0].message.content || "No response from Sensay";
    }
    
    return "Received empty response from Sensay";
  } catch (error) {
    console.error("Error calling Sensay with context:", error);
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}; 