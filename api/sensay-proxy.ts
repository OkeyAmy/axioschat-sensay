import vercelFetch from "@vercel/fetch";
import { NextApiRequest, NextApiResponse } from "next";

// Initialize fetch with retry and timeout capabilities
const fetch = vercelFetch();

// Sensay API endpoint
const API_BASE_URL = "https://api.sensay.io";
const API_VERSION = "2025-03-25";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract API key from headers
    const organizationSecret = req.headers["x-sensay-api-key"] as string;
    const userId = req.headers["x-user-id"] as string || "sample-user";

    if (!organizationSecret) {
      return res.status(400).json({ error: "Missing Sensay API key" });
    }

    // Get the replica UUID from the request body
    const { replicaId, messages, source = "web", store = true } = req.body;

    if (!replicaId) {
      return res.status(400).json({ error: "Missing replica ID" });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid or missing messages" });
    }

    // Make request to Sensay API
    const response = await fetch(
      `${API_BASE_URL}/v1/replicas/${replicaId}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ORGANIZATION-SECRET": organizationSecret,
          "X-USER-ID": userId,
          "X-API-Version": API_VERSION,
        },
        body: JSON.stringify({
          messages,
          source,
          store,
        }),
      }
    );

    if (!response.ok) {
      // Extract error information
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() };
      }

      console.error("Sensay API error:", errorData);
      return res.status(response.status).json({
        error: errorData.message || "Error from Sensay API",
        status: response.status,
        details: errorData,
      });
    }

    // Parse and return the successful response
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error in Sensay proxy:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
} 