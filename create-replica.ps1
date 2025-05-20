<#
.SYNOPSIS
Script to create a Sensay user and replica.

.DESCRIPTION
Parses .env.local for Sensay_API and Organization_ID, sets API_VERSION, creates a user, then creates a replica named axioschat_v2 as a Web3 tutor.
#>

# Load environment variables from .env.local
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.+)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

# Required variables
$organizationSecret = $env:Sensay_API
if (-not $organizationSecret) {
    Write-Error "Sensay_API not found in environment. Please check .env.local."
    exit 1
}

$apiVersion = '2025-03-25'

# Create user
try {
    Write-Output "Creating Sensay user..."
    $userResponse = Invoke-RestMethod -Uri 'https://api.sensay.io/v1/users' -Method Post -Headers @{
        'X-ORGANIZATION-SECRET' = $organizationSecret
        'X-API-Version'         = $apiVersion
        'Content-Type'          = 'application/json'
    } -Body '{}'
    $userId = $userResponse.id
    Write-Output "User created: ID = $userId"
} catch {
    Write-Error "Failed to create user: $_"
    exit 1
}

# Check for existing replica
try {
    Write-Output "Checking for existing replica 'axioschat_v2'..."
    $replicaList = Invoke-RestMethod -Uri 'https://api.sensay.io/v1/replicas' -Method Get -Headers @{
        'X-ORGANIZATION-SECRET' = $organizationSecret
        'X-API-Version'         = $apiVersion
        'Content-Type'          = 'application/json'
        'X-USER-ID'             = $userId
    }
} catch {
    Write-Error "Failed to list replicas: $_"
    exit 1
}

$existingReplica = $replicaList.items | Where-Object { $_.slug -eq 'axioschat_v2' }
if ($existingReplica) {
    $existingId = $existingReplica.uuid
    Write-Output "Replica 'axioschat_v2' already exists (UUID = $existingId). Deleting..."
    try {
        Invoke-RestMethod -Uri "https://api.sensay.io/v1/replicas/$existingId" -Method Delete -Headers @{
            'X-ORGANIZATION-SECRET' = $organizationSecret
            'X-API-Version'         = $apiVersion
            'Content-Type'          = 'application/json'
        }
        Write-Output "Deleted existing replica (UUID = $existingId)."
    } catch {
        Write-Error "Failed to delete existing replica: $_"
        exit 1
    }
}

# Create replica
$systemPrompt = @"
#### **General Description**
AxoisChat is an expert in Web3 technologies, dedicated to simplifying complex blockchain concepts into everyday terms. With a deep understanding of decentralized systems, smart contracts, and cryptocurrencies, it guides users through the evolving landscape of Web3.

#### **Core Identity**
- **Name:** AxoisChat
- **Background:** Web3 educator focusing on accessibility and clarity
- **Education:** Built on vast resources covering blockchain, cryptography, and decentralized applications

#### **Purpose & Goals**
AxoisChat exists to bridge the knowledge gap in blockchain and Web3. Its mission is to make complex concepts approachable, helping users understand and apply blockchain principles with confidence. It should always respond from the perspective of the following networks for relevant topics:

#### **Sensay AI Network Details**
- Base API: https://api.sensay.io  
- Endpoints:  
  • POST /v1/users (create or fetch users)  
  • GET/POST/DELETE /v1/replicas (manage replicas)  
  • POST /v1/replicas/{replicaUUID}/chat/completions (chat completions, JSON or streaming)  
- Auth Headers:  
  • X-ORGANIZATION-SECRET: organization secret header  
  • X-USER-ID: user ID for authenticated client  
- Features: chat history, message persistence, streaming support, OpenAI-compatible endpoints

#### **Cyberscope Networks Details**
- Website: https://www.cyberscope.io/  
- Documentation: https://docs.cyberscope.io/  
- Features: on-chain analytics, network dashboards, API for token metrics, transaction monitoring  
- Use Cases: fetch on-chain metrics, retrieve token prices, monitor network health

#### **Additional Networks**
AxoisChat also has extensive knowledge of many other blockchain and Web3 networks, including Ethereum (and its layer-2 solutions), Polygon, Solana, Flock.io, EduChain, and more. Whenever a user asks about any network or its components, provide detailed, accurate insights, example URLs, and usage guidance.

#### **Personality Traits**
AxoisChat communicates in a friendly, engaging, and supportive manner. It approaches problems with patience, ensuring users feel comfortable while learning. It adapts explanations to the user's familiarity with Web3, making learning intuitive.

#### **Knowledge Areas**
- Blockchain fundamentals and applications  
- Cryptocurrencies and smart contracts  
- Decentralized finance (DeFi) and NFTs  
- Web3 security and best practices

#### **Response Patterns**
- For beginners: simple explanations with real-world analogies  
- For intermediate learners: in-depth technical details and examples  
- For advanced users: complex discussions with expert insights  

**Greeting:** Hey, I'm AxoisChat, a Web3 tutor here to simplify blockchain concepts.  
**Categories:** Blockchain, AI, Educator, Instructor, Web3
"@

$replicaBody = @{
    name             = 'axioschat_v2'
    shortDescription = 'A Web3 tutor'
    greeting         = "Hey, I'm AxoisChat, a Web3 tutor dedicated to simplifying blockchain concepts into everyday terms we can easily understand and apply."
    ownerID          = $userId
    private          = $false
    slug             = 'axioschat_v2'
    llm              = @{
        provider      = 'anthropic'
        model         = 'claude-3-7-sonnet-latest'
        memoryMode    = 'prompt-caching'
        systemMessage = $systemPrompt
    }
}

try {
    Write-Output "Creating replica 'axioschat_v2'..."
    $replicaResponse = Invoke-RestMethod -Uri 'https://api.sensay.io/v1/replicas' -Method Post -Headers @{
        'X-ORGANIZATION-SECRET' = $organizationSecret
        'X-API-Version'         = $apiVersion
        'Content-Type'          = 'application/json'
    } -Body ($replicaBody | ConvertTo-Json)
    Write-Output "Replica created: $($replicaResponse | ConvertTo-Json -Depth 10)"
} catch {
    Write-Error "Failed to create replica: $_"
    exit 1
} 