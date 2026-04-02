<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../utils/advertisement_serving.php';

final class AdvertisementServingTest extends TestCase
{
    private function makeAdvertisement(array $overrides = []): array
    {
        return array_merge([
            'id' => 'ad-basic-1',
            'status' => 'active',
            'tier' => 'basic',
            'priority' => 50,
            'vendor_status' => 'approved',
            'product_is_active' => 1,
            'page_locations' => json_encode(['products']),
            'start_date' => '2026-04-01 08:00:00',
            'end_date' => '2026-04-30 23:59:59',
            'created_at' => '2026-04-01 08:00:00',
            'clicks_count' => 0,
        ], $overrides);
    }

    public function testSingleActiveAdvertisementIsEligibleAndEnriched(): void
    {
        $ad = $this->makeAdvertisement();

        $eligibility = evaluateAdvertisementEligibility($ad, 'products', new DateTimeImmutable('2026-04-02 10:00:00'));
        $enriched = enrichAdvertisementForServing($ad, 'products');

        $this->assertTrue($eligibility['eligible']);
        $this->assertSame('basic_popup', $enriched['slot_type']);
        $this->assertSame('products', $enriched['served_page_location']);
        $this->assertGreaterThanOrEqual(1, $enriched['rotation_weight']);
    }

    public function testTwoAdvertisementsAreBothServedWhenEligible(): void
    {
        $ads = [
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'ad-1']), 'products'),
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'ad-2', 'created_at' => '2026-04-02 08:00:00']), 'products'),
        ];

        $sorted = sortAdvertisementsForServing($ads);

        $this->assertCount(2, $sorted);
        $this->assertSame(['ad-2', 'ad-1'], array_column($sorted, 'id'));
    }

    public function testFourOrMoreAdsKeepPremiumAdsAheadOfBasicAds(): void
    {
        $ads = [
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'basic-1', 'tier' => 'basic', 'priority' => 50]), 'products'),
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'premium-1', 'tier' => 'premium', 'priority' => 100]), 'products'),
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'basic-2', 'tier' => 'basic', 'priority' => 50, 'created_at' => '2026-04-02 08:00:00']), 'products'),
            enrichAdvertisementForServing($this->makeAdvertisement(['id' => 'premium-2', 'tier' => 'premium', 'priority' => 100, 'created_at' => '2026-04-02 09:00:00']), 'products'),
        ];

        $sorted = sortAdvertisementsForServing($ads);

        $this->assertCount(4, $sorted);
        $this->assertSame(['premium-2', 'premium-1'], array_slice(array_column($sorted, 'id'), 0, 2));
    }

    public function testPremiumAdsReceiveHigherRotationWeightThanBasicAds(): void
    {
        $basicWeight = getAdvertisementRotationWeight($this->makeAdvertisement([
            'tier' => 'basic',
            'priority' => 50,
            'clicks_count' => 0,
        ]));

        $premiumWeight = getAdvertisementRotationWeight($this->makeAdvertisement([
            'tier' => 'premium',
            'priority' => 100,
            'clicks_count' => 4,
        ]));

        $this->assertGreaterThan($basicWeight, $premiumWeight);
    }

    public function testDiagnosticsExplainWhyAdsWereFilteredOut(): void
    {
        $ads = [
            $this->makeAdvertisement(['id' => 'eligible-ad']),
            $this->makeAdvertisement(['id' => 'inactive-ad', 'status' => 'pending']),
            $this->makeAdvertisement(['id' => 'wrong-page-ad', 'page_locations' => json_encode(['homepage'])]),
            $this->makeAdvertisement(['id' => 'expired-ad', 'end_date' => '2026-04-01 00:00:00']),
            $this->makeAdvertisement(['id' => 'vendor-blocked-ad', 'vendor_status' => 'pending']),
        ];

        $diagnostics = buildAdvertisementServingDiagnostics($ads, 'products', new DateTimeImmutable('2026-04-02 10:00:00'));

        $this->assertSame(5, $diagnostics['total_candidates']);
        $this->assertSame(1, $diagnostics['eligible_count']);
        $this->assertSame(1, $diagnostics['filtered_out']['status_not_active']);
        $this->assertSame(1, $diagnostics['filtered_out']['page_location_mismatch']);
        $this->assertSame(1, $diagnostics['filtered_out']['after_end_date']);
        $this->assertSame(1, $diagnostics['filtered_out']['vendor_not_approved']);
    }
}
