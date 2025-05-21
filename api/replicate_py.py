from flask import Flask, request, jsonify
import requests
import os
import json
from flask_cors import CORS
import time
# Add import for Google Generative AI SDK
import google.generativeai as genai

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"  # Default Ollama endpoint
REPLICATE_API_URL = "https://api.replicate.com/v1/predictions"

@app.route('/api/replicate', methods=['POST'])
def proxy_replicate():
    """
    This endpoint forwards requests to the Replicate API using the HTTP API approach
    Note: This endpoint is now deprecated and replaced by Gemini function calling,
    but kept for backward compatibility
    """
    # Get the request data
    request_data = request.json
    
    if not request_data:
        return jsonify({"error": "Request body is required"}), 400
    
    # Get the API token from the headers
    api_token = request.headers.get('X-Replicate-API-Token')
    if not api_token:
        return jsonify({"error": "Replicate API token is required"}), 401
    
    print(f"Forwarding request to Replicate API: {json.dumps(request_data)[:500]}...")
    
    # Implement retry mechanism for cold starts
    max_retries = 2
    retry_count = 0
    
    while retry_count <= max_retries:
        try:
            # Forward the request to Replicate API using the HTTP API approach
            response = requests.post(
                REPLICATE_API_URL,
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                    "Prefer": "wait"  # Added Prefer: wait header to wait for completion
                },
                json=request_data,
                timeout=30  # Add a timeout to prevent hanging
            )
            
            # Get the response from Replicate
            try:
                response_data = response.json()
                print(f"Raw Replicate API response: {json.dumps(response_data)[:500]}...")
                
                # Add more detailed logging for the output field
                if 'output' in response_data:
                    print(f"COMPLETE OUTPUT: {json.dumps(response_data['output'])}")
                    
                    # Parse output for better debugging
                    if response_data['output'] is not None:
                        try:
                            if isinstance(response_data['output'], str):
                                # Try to parse the string as JSON
                                parsed_output = json.loads(response_data['output'])
                                print(f"Parsed output (JSON): {json.dumps(parsed_output, indent=2)}")
                                
                                # If it's an array of strings, try to parse each string
                                if isinstance(parsed_output, list):
                                    parsed_items = []
                                    for item in parsed_output:
                                        if isinstance(item, str) and (item.startswith('{') or item.startswith('[')):
                                            try:
                                                parsed_item = json.loads(item)
                                                parsed_items.append(parsed_item)
                                            except:
                                                parsed_items.append(item)
                                        else:
                                            parsed_items.append(item)
                                    print(f"Parsed items: {json.dumps(parsed_items, indent=2)}")
                        except Exception as e:
                            print(f"Error parsing output JSON: {str(e)}")
                            print(f"Raw output: {response_data['output']}")
                else:
                    print("No 'output' field found in response")
                
                # If there's an error, print the full response for debugging
                if not response.ok:
                    print(f"FULL ERROR RESPONSE: {json.dumps(response_data)}")
            except:
                print(f"Non-JSON response from Replicate API: {response.text[:500]}...")
                return jsonify({"error": f"Invalid response from Replicate API: {response.text[:200]}..."}), response.status_code
            
            # Check if we got a null output (cold start)
            if response.ok and response_data.get('output') is None and retry_count < max_retries:
                print(f"Attempt {retry_count + 1}: Replicate returned null output (cold start). Retrying...")
                retry_count += 1
                # Wait before retrying (exponential backoff)
                time.sleep(2 ** retry_count)
                continue
            
            if not response.ok:
                error_message = f"Error from Replicate API: {response_data}"
                print(error_message)
                return jsonify(response_data), response.status_code
            
            # With Prefer: wait, we should get the completed prediction directly
            # No need to poll for results
            return jsonify(response_data)
            
        except Exception as e:
            error_message = f"Error communicating with Replicate API: {str(e)}"
            print(error_message)
            
            retry_count += 1
            if retry_count <= max_retries:
                print(f"Retrying request (attempt {retry_count}/{max_retries})...")
                time.sleep(2 ** retry_count)  # Exponential backoff
                continue
            
            return jsonify({"error": error_message}), 500
    
    return jsonify({"error": "Maximum retries exceeded"}), 500

# NEW ENDPOINT FOR GEMINI FUNCTION CALLING
@app.route('/api/gemini_functions', methods=['POST'])
def proxy_gemini_functions():
    """
    This endpoint handles requests for Gemini function calling, replacing the Replicate FlockWeb3 model
    It converts OpenAI-style tools to Gemini's function declarations format and handles responses
    """
    request_data = request.json
    if not request_data:
        return jsonify({"error": "Request body is required"}), 400
    
    # Get the Gemini API key from the headers or environment
    gemini_api_key = request.headers.get('X-Gemini-API-Key') or os.environ.get('GEMINI_API_KEY')
    if not gemini_api_key:
        return jsonify({"error": "Gemini API key is required (set via header or GEMINI_API_KEY env var)"}), 401
    
    try:
        # Configure the Gemini SDK with the API key
        genai.configure(api_key=gemini_api_key)
    except Exception as e:
        print(f"Failed to configure Gemini SDK: {str(e)}")
        return jsonify({"error": f"Failed to configure Gemini SDK: {str(e)}"}), 500
    
    # Get the query and tools from the request
    query = request_data.get('query')
    tools_json_string = request_data.get('tools')  # Expected as JSON string from createDefaultWeb3Tools
    
    # User has specified gemini-2.0-flash as the model to use
    model_name = request_data.get('model', 'gemini-2.0-flash')
    
    temperature = request_data.get('temperature', 0.7)
    top_p = request_data.get('top_p')  # Gemini supports top_p
    max_output_tokens = request_data.get('max_output_tokens', request_data.get('max_new_tokens', 2048))
    
    if not query:
        return jsonify({"error": "Parameter 'query' is required"}), 400
    if not tools_json_string:
        return jsonify({"error": "Parameter 'tools' (JSON string) is required"}), 400
    
    # Enhanced debugging for function calling issues
    print(f"Gemini API request details:")
    print(f"- Model: {model_name}")
    print(f"- Query length: {len(query)} chars")
    print(f"- API key present: {bool(gemini_api_key)}")
    
    # Convert OpenAI-style tools (from createDefaultWeb3Tools) to Gemini format
    gemini_tool_config = None
    try:
        parsed_tools_list = json.loads(tools_json_string)  # This is a list of OpenAI-like tool objects
        function_declarations = []
        
        for tool_def in parsed_tools_list:
            if tool_def.get("type") == "function" and "function" in tool_def:
                func_details = tool_def["function"]
                # Create a FunctionDeclaration for each tool
                declaration = genai.types.FunctionDeclaration(
                    name=func_details["name"],
                    description=func_details.get("description", ""),
                    parameters=func_details.get("parameters")
                )
                function_declarations.append(declaration)
                print(f"Added function declaration: {func_details['name']}")
        
        if not function_declarations:
            return jsonify({"error": "No valid function declarations found in 'tools'"}), 400
        
        # Gemini expects a Tool object containing the list of function declarations
        gemini_tool_config = [genai.types.Tool(function_declarations=function_declarations)]
        print(f"Created tool config with {len(function_declarations)} function declarations")
    
    except json.JSONDecodeError:
        print(f"Invalid JSON string for 'tools': {tools_json_string[:100]}...")
        return jsonify({"error": "Invalid JSON string for 'tools'"}), 400
    except Exception as e:
        print(f"Error processing tools for Gemini: {str(e)}")
        return jsonify({"error": f"Error processing tools for Gemini: {str(e)}"}), 500
    
    # Set up generation config parameters
    generation_config_params = {
        "temperature": float(temperature),
        "max_output_tokens": int(max_output_tokens)
    }
    if top_p is not None:
        generation_config_params["top_p"] = float(top_p)
    
    generation_config = genai.types.GenerationConfig(**generation_config_params)
    
    print(f"Requesting Gemini ({model_name}) for function calling. Query: {query[:100]}...")
    
    # Implement retry mechanism for stability
    max_retries = 2
    retry_count = 0
    
    while retry_count <= max_retries:
        try:
            # Initialize the Gemini model with tools
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config,
                tools=gemini_tool_config,
                # Use a dictionary directly for the tool_config
                tool_config={'function_calling_config': {'mode': 'ANY'}}
            )
            
            # Using a chat session for function calling
            chat = model.start_chat()
            response = chat.send_message(query)
            
            function_calls_for_frontend = []
            text_content = None
            
            # Process Gemini's response parts with better error handling
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                print(f"Received {len(response.candidates[0].content.parts)} response parts from Gemini")
                for part in response.candidates[0].content.parts:
                    print(f"Processing part type: {type(part)}")
                    
                    # Handle function calls
                    if hasattr(part, 'function_call') and part.function_call:
                        fc = part.function_call
                        function_call_data = {
                            "name": fc.name,
                            "arguments": dict(fc.args) if hasattr(fc, 'args') else {}
                        }
                        function_calls_for_frontend.append(function_call_data)
                        print(f"Gemini requested function: {fc.name} with args: {function_call_data['arguments']}")
                    
                    # Handle text content
                    if hasattr(part, 'text') and part.text:
                        text_content = part.text
                        print(f"Gemini returned text: {text_content[:100]}...")
            else:
                print("No valid response content found in Gemini response")
                print(f"Response structure: {str(response)[:500]}")
            
            # Handle cases where the response might be blocked or empty
            if not function_calls_for_frontend and not text_content:
                if hasattr(response, 'prompt_feedback') and response.prompt_feedback and hasattr(response.prompt_feedback, 'block_reason'):
                    reason = response.prompt_feedback.block_reason.name if hasattr(response.prompt_feedback.block_reason, 'name') else str(response.prompt_feedback.block_reason)
                    print(f"Gemini request blocked: {reason}")
                    return jsonify({
                        "error": f"Gemini request blocked due to: {reason}",
                        "details": str(response.prompt_feedback)
                    }), 400
                
                # If we didn't get a response and haven't used all retries, try again
                if retry_count < max_retries:
                    print(f"Attempt {retry_count + 1}: Gemini returned empty response. Retrying...")
                    retry_count += 1
                    time.sleep(2 ** retry_count)  # Exponential backoff
                    continue
                
                # If we've exhausted retries, return a null output with a more helpful message
                print("Maximum retries exceeded with empty responses")
                return jsonify({
                    "id": f"gemini-func-{int(time.time())}", 
                    "output": "I couldn't process your request properly. Please try rephrasing your question.",
                    "status": "partial_failure"
                }), 200
            
            # Prioritize function calls in the 'output' field for the frontend
            # as this endpoint's primary purpose is function calling
            output_data = None
            if function_calls_for_frontend:
                output_data = function_calls_for_frontend
                print(f"Returning {len(function_calls_for_frontend)} function calls to frontend")
            elif text_content:  # Fallback to text if no function calls
                output_data = text_content
                print("Returning text content to frontend (no function calls)")
            
            response_data = {
                "id": f"gemini-func-{int(time.time())}",
                "status": "succeeded",
                "output": output_data,  # This will be array of func_calls or text string
                "text_if_any": text_content  # Explicitly provide text if it co-existed with function calls
            }
            
            print(f"Gemini response processed successfully")
            return jsonify(response_data)
            
        except Exception as e:
            error_message = f"Error during Gemini API call: {str(e)}"
            print(error_message)
            import traceback
            print(traceback.format_exc())  # Detailed error for backend logs
            
            retry_count += 1
            if retry_count <= max_retries:
                print(f"Retrying after error (attempt {retry_count}/{max_retries})")
                time.sleep(2 ** retry_count)  # Exponential backoff
                continue
            
            # Return a more user-friendly error for the frontend
            return jsonify({
                "error": "We encountered an issue processing your request with the AI model. Please try again.",
                "debug_info": str(e),
                "status": "error"
            }), 500
    
    return jsonify({"error": "Maximum retries exceeded"}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle local LLM chat requests using Ollama"""
    try:
        request_data = request.json
        
        if not request_data:
            return jsonify({"error": "Request body is required"}), 400
        
        # Extract messages from the request
        messages = request_data.get('messages', [])
        
        if not messages:
            return jsonify({"error": "No messages provided"}), 400
        
        # Format messages for Ollama
        formatted_messages = []
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            formatted_messages.append({"role": role, "content": content})
        
        # Prepare the request for Ollama
        ollama_request = {
            "model": request_data.get('model', 'llama3'),
            "messages": formatted_messages,
            "stream": False,
            "options": {
                "temperature": request_data.get('temperature', 0.7)
            }
        }
        
        print(f"Sending chat request to Ollama: {json.dumps(ollama_request)[:100]}...")
        
        # Send request to Ollama
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            headers={"Content-Type": "application/json"},
            json=ollama_request
        )
        
        if not response.ok:
            error_message = f"Error from Ollama API: {response.status_code} {response.text}"
            print(error_message)
            return jsonify({"error": error_message}), response.status_code
        
        # Parse Ollama response
        ollama_response = response.json()
        
        # Format response to match what the frontend expects
        assistant_message = ollama_response.get("message", {})
        formatted_response = {
            "message": {
                "role": "assistant",
                "content": assistant_message.get("content", "No response from Ollama")
            }
        }
        
        return jsonify(formatted_response)
    
    except Exception as e:
        error_message = f"Error in chat endpoint: {str(e)}"
        print(error_message)
        return jsonify({"error": error_message}), 500

@app.route('/api/ollama', methods=['POST'])
def ollama_proxy():
    """
    This endpoint forwards requests to Ollama as a fallback
    when Replicate API is not available or for testing
    """
    # Get the request data
    request_data = request.json
    
    if not request_data:
        return jsonify({"error": "Request body is required"}), 400
    
    # Extract the query and other parameters from the request
    input_data = request_data.get('input', {})
    query = input_data.get('query', '')
    temperature = input_data.get('temperature', 0.7)
    
    print(f"Forwarding request to Ollama: {query[:100]}...")
    
    # Prepare the request for Ollama
    ollama_request = {
        "model": "llama3",  # You can change this to your preferred model
        "prompt": query,
        "stream": False,
        "options": {
            "temperature": temperature
        }
    }
    
    try:
        # Send request to Ollama
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            headers={"Content-Type": "application/json"},
            json=ollama_request
        )
        
        if not response.ok:
            error_message = f"Error from Ollama API: {response.status_code} {response.text}"
            print(error_message)
            return jsonify({"error": error_message}), response.status_code
        
        # Parse Ollama response
        ollama_response = response.json()
        
        # Format response to match what the frontend expects from Replicate
        formatted_response = {
            "id": "ollama-response",
            "status": "succeeded",
            "output": ollama_response.get("response", "No response from Ollama")
        }
        
        return jsonify(formatted_response)
    
    except Exception as e:
        error_message = f"Error communicating with Ollama: {str(e)}"
        print(error_message)
        return jsonify({"error": error_message}), 500

if __name__ == '__main__':
    # Use PORT environment variable if available (e.g., on Vercel)
    port = int(os.environ.get('PORT', 3000))
    
    # Check for OLLAMA_URL environment variable to override default
    ollama_env_url = os.environ.get('OLLAMA_URL')
    if ollama_env_url:
        OLLAMA_BASE_URL = ollama_env_url
    
    print(f"Using Ollama endpoint: {OLLAMA_BASE_URL}")
    print(f"Server running on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
