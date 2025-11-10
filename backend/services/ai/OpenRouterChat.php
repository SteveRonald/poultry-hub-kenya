<?php
/**
 * OpenRouter AI Chat Service
 * Handles general poultry farming questions via OpenRouter API
 * Uses free/low-cost models like DeepSeek or Mistral
 */

class OpenRouterChat {
    private $config;
    private $apiKey;
    private $baseUrl;
    private $model;
    private $maxTokens;
    private $temperature;
    
    public function __construct() {
        try {
            $this->config = require __DIR__ . '/../../config/ai_config.php';
            $openRouterConfig = $this->config['services']['openrouter'] ?? [];
            
            // Try multiple ways to get the API key
            $this->apiKey = $openRouterConfig['api_key'] ?? '';
            if (empty($this->apiKey)) {
                // Try environment variable directly
                $this->apiKey = getenv('OPENROUTER_API_KEY') ?: '';
            }
            if (empty($this->apiKey)) {
                // Try $_ENV
                $this->apiKey = $_ENV['OPENROUTER_API_KEY'] ?? '';
            }
            if (empty($this->apiKey)) {
                // Try $_SERVER
                $this->apiKey = $_SERVER['OPENROUTER_API_KEY'] ?? '';
            }
            
            $this->baseUrl = $openRouterConfig['base_url'] ?? 'https://openrouter.ai/api/v1/chat/completions';
            $this->model = $openRouterConfig['model'] ?? 'deepseek/deepseek-chat';
            $this->maxTokens = $openRouterConfig['max_tokens'] ?? 1000;
            $this->temperature = $openRouterConfig['temperature'] ?? 0.7;
            
            // Log for debugging (only in development)
            if (getenv('APP_ENV') === 'development' || empty(getenv('APP_ENV'))) {
                error_log("OpenRouterChat initialized - API Key present: " . (!empty($this->apiKey) ? 'YES' : 'NO'));
                error_log("OpenRouterChat - Enabled: " . ($openRouterConfig['enabled'] ?? 'not set'));
            }
        } catch (Exception $e) {
            error_log("Error initializing OpenRouterChat: " . $e->getMessage());
            $this->apiKey = '';
        }
    }
    
    /**
     * Check if OpenRouter is enabled and configured
     */
    public function isEnabled() {
        $openRouterConfig = $this->config['services']['openrouter'] ?? [];
        $enabled = ($openRouterConfig['enabled'] ?? false) && !empty($this->apiKey);
        
        if (!$enabled) {
            error_log("OpenRouter not enabled - Config enabled: " . ($openRouterConfig['enabled'] ?? 'not set') . ", API Key present: " . (!empty($this->apiKey) ? 'YES' : 'NO'));
        }
        
        return $enabled;
    }
    
    /**
     * Ask AI a general poultry farming question
     * @param string $message User's question
     * @param array $conversationHistory Previous messages for context (optional)
     * @return array Response with message or error
     */
    public function askAI($message, $conversationHistory = [], $language = 'en') {
        if (!$this->isEnabled()) {
            return $this->getErrorResponse('OpenRouter AI is not configured. Please set OPENROUTER_API_KEY in your environment variables.');
        }
        
        if (empty($message)) {
            return $this->getErrorResponse('Message cannot be empty.');
        }
        
        // Validate language
        if (!in_array($language, ['en', 'sw'])) {
            $language = 'en';
        }
        
        try {
            // Build conversation messages
            $messages = [];
            
            // System prompt for poultry expert (language-aware)
            $languageInstructions = [
                'en' => "Respond in English. Use clear, simple English.",
                'sw' => "Jibu kwa Kiswahili. Tumia Kiswahili wazi na rahisi."
            ];
            
            $systemPrompt = "You are a helpful poultry farming expert assistant for Kenyan farmers. Provide practical, accurate, and culturally relevant advice about poultry farming.\n\n" .
                "CRITICAL: You are a POULTRY FARMING EXPERT ONLY. If asked about non-poultry topics (cars, politics, weather, sports, etc.), politely decline and redirect to poultry topics. " .
                "ONLY answer poultry-related questions.\n\n" .
                "CRITICAL FORMATTING RULES - MUST FOLLOW:\n" .
                "- Respond in PLAIN TEXT ONLY - ABSOLUTELY NO markdown formatting\n" .
                "- DO NOT use: **bold**, __bold__, *italic*, ### headers, ## headers, # headers\n" .
                "- DO NOT use: bullet points with asterisks (*), dashes (-), or plus signs (+)\n" .
                "- DO NOT use: code blocks, backticks, or any markdown syntax\n" .
                "- DO NOT use any special formatting characters: *, _, #, `, [], ()\n" .
                "- For lists, use numbered format only: 1. First item 2. Second item 3. Third item\n" .
                "- Use simple line breaks for paragraphs\n" .
                "- For emphasis, write in ALL CAPS, do not use markdown\n" .
                "- Keep text simple, readable, and completely free of formatting symbols\n\n" .
                "LANGUAGE: " . ($languageInstructions[$language] ?? $languageInstructions['en']) . "\n" .
                "- If user asks in a different language, respond in that language\n" .
                "- Support both English and Kiswahili fluently\n\n" .
                "TOPICS YOU CAN HELP WITH:\n" .
                "- Chicken breeds (broilers, layers, kienyeji/indigenous)\n" .
                "- Feeding and nutrition (chakula, lishe)\n" .
                "- Health and disease management (ugonjwa wa kuku, afya ya kuku)\n" .
                "- Housing and management\n" .
                "- Egg production (mayai)\n" .
                "- Brooding and rearing (kukuzwa)\n" .
                "- Market prices and trends\n" .
                "- Best practices for small-scale and commercial farming\n\n" .
                "Remember: PLAIN TEXT ONLY - no markdown, no formatting symbols, no special characters. Write as if sending a simple text message.";
            
            $messages[] = [
                'role' => 'system',
                'content' => $systemPrompt
            ];
            
            // Add conversation history (last 5 messages for context)
            if (!empty($conversationHistory)) {
                $recentHistory = array_slice($conversationHistory, -5);
                foreach ($recentHistory as $msg) {
                    $role = isset($msg['sender']) ? ($msg['sender'] === 'user' ? 'user' : 'assistant') : 'user';
                    $content = $msg['message'] ?? $msg['content'] ?? '';
                    if (!empty($content)) {
                        $messages[] = [
                            'role' => $role,
                            'content' => $content
                        ];
                    }
                }
            }
            
            // Add current user message
            $messages[] = [
                'role' => 'user',
                'content' => $message
            ];
            
            // Prepare API request
            $data = [
                'model' => $this->model,
                'messages' => $messages,
                'max_tokens' => $this->maxTokens,
                'temperature' => $this->temperature
            ];
            
            // Make API call
            $response = $this->makeApiCall($data);
            
            if (isset($response['error'])) {
                return $this->getErrorResponse($response['error']);
            }
            
            // Extract AI response
            if (!isset($response['choices']) || !is_array($response['choices']) || empty($response['choices'])) {
                error_log("OpenRouter API response missing choices: " . json_encode($response));
                return $this->getErrorResponse('Invalid response from AI service. Please try again.');
            }
            
            $aiMessage = $response['choices'][0]['message']['content'] ?? null;
            
            if (empty($aiMessage)) {
                error_log("OpenRouter API response missing message content: " . json_encode($response));
                return $this->getErrorResponse('Sorry, I couldn\'t generate a response. Please try again.');
            }
            
            // Strip markdown formatting from response (fallback in case AI still uses markdown)
            $cleanedMessage = $this->stripMarkdown($aiMessage);
            
            return [
                'success' => true,
                'message' => trim($cleanedMessage),
                'model' => $this->model,
                'tokens_used' => $response['usage']['total_tokens'] ?? null
            ];
            
        } catch (Exception $e) {
            error_log("OpenRouter Chat Error: " . $e->getMessage());
            return $this->getErrorResponse('Failed to get AI response: ' . $e->getMessage());
        }
    }
    
    /**
     * Make API call to OpenRouter
     */
    private function makeApiCall($data) {
        $ch = curl_init($this->baseUrl);
        
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'HTTP-Referer: https://poultryhubkenya.com', // Optional: for analytics
                'X-Title: PoultryHubKenya Chatbot' // Optional: for analytics
            ],
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => 30, // 30 second timeout
            CURLOPT_CONNECTTIMEOUT => 10 // 10 second connection timeout
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($curlError) {
            return ['error' => 'Network error: ' . $curlError];
        }
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMessage = $errorData['error']['message'] ?? 'API request failed';
            error_log("OpenRouter API Error (HTTP $httpCode): " . $errorMessage);
            return ['error' => 'AI service temporarily unavailable. Please try again later.'];
        }
        
        $result = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['error' => 'Invalid response from AI service'];
        }
        
        return $result;
    }
    
    /**
     * Strip markdown formatting from text
     * Removes **bold**, ### headers, bullet points, etc., and converts to plain text
     */
    private function stripMarkdown($text) {
        if (empty($text)) {
            return $text;
        }
        
        // Remove markdown bold **text** and __text__ (greedy match to handle multiple)
        $text = preg_replace('/\*\*([^*]+)\*\*/', '$1', $text);
        $text = preg_replace('/__([^_]+)__/', '$1', $text);
        
        // Remove markdown headers ### Header or ## Header or # Header (keep the text)
        $text = preg_replace('/^#{1,6}\s+(.+)$/m', '$1', $text);
        
        // Remove markdown code blocks ```code```
        $text = preg_replace('/```[\s\S]*?```/', '', $text);
        
        // Remove markdown inline code `code`
        $text = preg_replace('/`([^`]+)`/', '$1', $text);
        
        // Remove markdown links [text](url) but keep the text
        $text = preg_replace('/\[([^\]]+)\]\([^\)]+\)/', '$1', $text);
        
        // Process each line to handle lists and formatting
        $lines = explode("\n", $text);
        $cleanedLines = [];
        $listCounter = 0;
        $inList = false;
        
        foreach ($lines as $line) {
            $originalLine = $line;
            $trimmed = trim($line);
            
            // Skip empty lines (we'll add them back for paragraph breaks)
            if (empty($trimmed)) {
                if (!$inList) {
                    // Add empty line for paragraph break (but limit consecutive empty lines)
                    if (empty($cleanedLines) || !empty(end($cleanedLines))) {
                        $cleanedLines[] = '';
                    }
                }
                continue;
            }
            
            // Check if line starts with markdown list marker (*, -, +) followed by space
            if (preg_match('/^[\*\-\+]\s+(.+)$/', $trimmed, $matches)) {
                if (!$inList) {
                    $listCounter = 1;
                    $inList = true;
                }
                // Remove any remaining markdown from the content
                $content = trim($matches[1]);
                $content = preg_replace('/\*\*([^*]+)\*\*/', '$1', $content);
                $content = preg_replace('/__([^_]+)__/', '$1', $content);
                $cleanedLines[] = $listCounter . '. ' . $content;
                $listCounter++;
            } 
            // Check for checkbox list items
            else if (preg_match('/^[\*\-\+]\s*\[[ xX]\]\s*(.+)$/', $trimmed, $matches)) {
                if (!$inList) {
                    $listCounter = 1;
                    $inList = true;
                }
                $content = trim($matches[1]);
                $content = preg_replace('/\*\*([^*]+)\*\*/', '$1', $content);
                $cleanedLines[] = $listCounter . '. ' . $content;
                $listCounter++;
            }
            // Check for checkmark list items
            else if (preg_match('/^[\*\-\+]\s*✔\s*(.+)$/', $trimmed, $matches)) {
                if (!$inList) {
                    $listCounter = 1;
                    $inList = true;
                }
                $content = trim($matches[1]);
                $content = preg_replace('/\*\*([^*]+)\*\*/', '$1', $content);
                $cleanedLines[] = $listCounter . '. ' . $content;
                $listCounter++;
            }
            // Regular line - end list if we were in one
            else {
                if ($inList) {
                    $inList = false;
                    $listCounter = 0;
                }
                
                // Clean up the line - remove any markdown formatting
                $cleaned = $trimmed;
                
                // Remove any remaining bold/italic
                $cleaned = preg_replace('/\*\*([^*]+)\*\*/', '$1', $cleaned);
                $cleaned = preg_replace('/__([^_]+)__/', '$1', $cleaned);
                
                // Remove checkmarks and symbols
                $cleaned = preg_replace('/✔\s*/', '', $cleaned);
                $cleaned = preg_replace('/\[[ xX]\]\s*/', '', $cleaned);
                
                // Remove any standalone asterisks or dashes that might be list markers
                $cleaned = preg_replace('/^[\*\-\+]\s+/', '', $cleaned);
                
                if (!empty($cleaned)) {
                    $cleanedLines[] = $cleaned;
                }
            }
        }
        
        $text = implode("\n", $cleanedLines);
        
        // Final cleanup - remove any remaining markdown patterns
        // Remove any remaining ** or __ patterns
        $text = preg_replace('/\*\*([^*]+)\*\*/', '$1', $text);
        $text = preg_replace('/__([^_]+)__/', '$1', $text);
        
        // Remove checkmarks
        $text = preg_replace('/✔\s*/', '', $text);
        
        // Clean up multiple blank lines (more than 2 consecutive newlines)
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        
        // Final trim
        $text = trim($text);
        
        return $text;
    }
    
    /**
     * Get error response format
     */
    private function getErrorResponse($message) {
        return [
            'success' => false,
            'error' => $message,
            'message' => $message
        ];
    }
}

?>

