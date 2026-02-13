<?php
/**
 * OpenRouter AI - Recommendation generator
 * Returns STRICT JSON only.
 */

class RecommendationsAI {
    private $apiKey;
    private $baseUrl;
    private $model;
    private $maxTokens;
    private $temperature;

    public function __construct() {
        $config = require __DIR__ . '/../../config/ai_config.php';
        $openRouterConfig = $config['services']['openrouter'] ?? [];

        $this->apiKey = $openRouterConfig['api_key'] ?? '';
        if (empty($this->apiKey)) {
            $this->apiKey = getenv('OPENROUTER_API_KEY') ?: '';
        }
        if (empty($this->apiKey)) {
            $this->apiKey = $_ENV['OPENROUTER_API_KEY'] ?? '';
        }
        if (empty($this->apiKey)) {
            $this->apiKey = $_SERVER['OPENROUTER_API_KEY'] ?? '';
        }

        $this->baseUrl = $openRouterConfig['base_url'] ?? 'https://openrouter.ai/api/v1/chat/completions';
        $this->model = $openRouterConfig['model'] ?? 'deepseek/deepseek-chat';
        $this->maxTokens = $openRouterConfig['max_tokens'] ?? 800;
        $this->temperature = 0.2;
    }

    public function isEnabled() {
        return !empty($this->apiKey);
    }

    /**
     * Generate JSON recommendations based on metrics and seeded actions.
     * Returns array with 'success' and 'actions' or 'error'.
     */
    public function generateRecommendations($scope, $metrics, $seedActions = []) {
        if (!$this->isEnabled()) {
            return ['success' => false, 'error' => 'OpenRouter not configured'];
        }

        $systemPrompt = "You are a data-driven recommendation engine. " .
            "You MUST return ONLY valid JSON with this shape:\n" .
            "{ \"actions\": [ { \"title\": \"...\", \"reason\": \"...\", \"priority\": \"low|medium|high\" } ] }\n" .
            "Do NOT include any extra keys. Do NOT include markdown. " .
            "Use ONLY the provided metrics. Never invent numbers or facts.";

        $userPrompt = json_encode([
            'scope' => $scope,
            'metrics' => $metrics,
            'seed_actions' => $seedActions
        ]);

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt]
        ];

        $payload = [
            'model' => $this->model,
            'messages' => $messages,
            'max_tokens' => $this->maxTokens,
            'temperature' => $this->temperature
        ];

        $response = $this->makeApiCall($payload);
        if (isset($response['error'])) {
            return ['success' => false, 'error' => $response['error']];
        }

        $content = $response['choices'][0]['message']['content'] ?? '';
        $decoded = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($decoded['actions']) || !is_array($decoded['actions'])) {
            return ['success' => false, 'error' => 'Invalid AI response'];
        }

        // Validate action structure
        $actions = [];
        foreach ($decoded['actions'] as $action) {
            if (!is_array($action)) continue;
            $title = trim($action['title'] ?? '');
            $reason = trim($action['reason'] ?? '');
            $priority = strtolower(trim($action['priority'] ?? 'medium'));
            if (!$title || !$reason) continue;
            if (!in_array($priority, ['low', 'medium', 'high'], true)) {
                $priority = 'medium';
            }
            $actions[] = [
                'title' => $title,
                'reason' => $reason,
                'priority' => $priority
            ];
        }

        if (empty($actions)) {
            return ['success' => false, 'error' => 'No valid actions'];
        }

        return ['success' => true, 'actions' => $actions];
    }

    private function makeApiCall($data) {
        $ch = curl_init($this->baseUrl);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'HTTP-Referer: https://kukusoko.com',
                'X-Title: KukuSoko Recommendations'
            ],
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return ['error' => 'Network error: ' . $curlError];
        }

        if ($httpCode !== 200) {
            return ['error' => 'AI service temporarily unavailable'];
        }

        $result = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['error' => 'Invalid AI response'];
        }

        return $result;
    }
}
?>
