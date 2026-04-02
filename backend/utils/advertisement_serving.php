<?php

function normalizeAdvertisementPageLocations($rawPageLocations): array {
    if (is_array($rawPageLocations)) {
        return array_values(array_filter(array_map('strval', $rawPageLocations)));
    }

    if (is_string($rawPageLocations) && $rawPageLocations !== '') {
        $decoded = json_decode($rawPageLocations, true);
        if (is_array($decoded)) {
            return array_values(array_filter(array_map('strval', $decoded)));
        }
    }

    return [];
}

function getAdvertisementRotationWeight(array $advertisement): int {
    $baseWeight = ($advertisement['tier'] ?? 'basic') === 'premium' ? 6 : 3;
    $priorityWeight = max(0, (int) floor(((int) ($advertisement['priority'] ?? 0)) / 25));
    $engagementWeight = !empty($advertisement['clicks_count']) ? 1 : 0;

    return max(1, $baseWeight + $priorityWeight + $engagementWeight);
}

function evaluateAdvertisementEligibility(array $advertisement, string $pageLocation, ?DateTimeImmutable $now = null): array {
    $now = $now ?: new DateTimeImmutable('now');
    $reasons = [];

    if (($advertisement['status'] ?? '') !== 'active') {
        $reasons[] = 'status_not_active';
    }

    if (($advertisement['vendor_status'] ?? '') !== 'approved') {
        $reasons[] = 'vendor_not_approved';
    }

    if (isset($advertisement['product_is_active']) && (int) $advertisement['product_is_active'] !== 1) {
        $reasons[] = 'product_not_active';
    }

    if (!empty($advertisement['start_date'])) {
        $startDate = new DateTimeImmutable($advertisement['start_date']);
        if ($startDate > $now) {
            $reasons[] = 'before_start_date';
        }
    }

    if (!empty($advertisement['end_date'])) {
        $endDate = new DateTimeImmutable($advertisement['end_date']);
        if ($endDate <= $now) {
            $reasons[] = 'after_end_date';
        }
    }

    $pageLocations = normalizeAdvertisementPageLocations($advertisement['page_locations'] ?? null);
    if (!empty($pageLocations) && !in_array($pageLocation, $pageLocations, true)) {
        $reasons[] = 'page_location_mismatch';
    }

    return [
        'eligible' => count($reasons) === 0,
        'reasons' => $reasons,
    ];
}

function enrichAdvertisementForServing(array $advertisement, string $pageLocation): array {
    $advertisement['page_locations'] = normalizeAdvertisementPageLocations($advertisement['page_locations'] ?? null);
    $advertisement['rotation_weight'] = getAdvertisementRotationWeight($advertisement);
    $advertisement['display_priority'] = (int) ($advertisement['priority'] ?? 0);
    $advertisement['slot_type'] = ($advertisement['tier'] ?? 'basic') === 'premium' ? 'premium_banner' : 'basic_popup';
    $advertisement['served_page_location'] = $pageLocation;

    return $advertisement;
}

function sortAdvertisementsForServing(array $advertisements): array {
    usort($advertisements, static function (array $left, array $right) {
        $leftTierWeight = ($left['tier'] ?? 'basic') === 'premium' ? 1 : 0;
        $rightTierWeight = ($right['tier'] ?? 'basic') === 'premium' ? 1 : 0;

        if ($leftTierWeight !== $rightTierWeight) {
            return $rightTierWeight <=> $leftTierWeight;
        }

        if (($right['display_priority'] ?? 0) !== ($left['display_priority'] ?? 0)) {
            return ($right['display_priority'] ?? 0) <=> ($left['display_priority'] ?? 0);
        }

        if (($right['rotation_weight'] ?? 0) !== ($left['rotation_weight'] ?? 0)) {
            return ($right['rotation_weight'] ?? 0) <=> ($left['rotation_weight'] ?? 0);
        }

        return strcmp((string) ($right['created_at'] ?? ''), (string) ($left['created_at'] ?? ''));
    });

    return $advertisements;
}

function buildAdvertisementServingDiagnostics(array $advertisements, string $pageLocation, ?DateTimeImmutable $now = null): array {
    $now = $now ?: new DateTimeImmutable('now');
    $diagnostics = [
        'total_candidates' => count($advertisements),
        'eligible_count' => 0,
        'filtered_out' => [],
    ];

    foreach ($advertisements as $advertisement) {
        $eligibility = evaluateAdvertisementEligibility($advertisement, $pageLocation, $now);
        if ($eligibility['eligible']) {
            $diagnostics['eligible_count']++;
            continue;
        }

        foreach ($eligibility['reasons'] as $reason) {
            if (!isset($diagnostics['filtered_out'][$reason])) {
                $diagnostics['filtered_out'][$reason] = 0;
            }
            $diagnostics['filtered_out'][$reason]++;
        }
    }

    return $diagnostics;
}
