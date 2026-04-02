import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiUrl } from '../config/api';

export interface Advertisement {
  id: string;
  tier: 'basic' | 'premium';
  content_duration?: number;
  rotation_weight?: number;
  fallback_path?: string;
  is_fallback?: boolean;
  [key: string]: any;
}

const buildFallbackAdvertisement = (pageLocation: string): Advertisement => ({
  id: `fallback-house-ad-${pageLocation}`,
  tier: 'basic',
  rotation_weight: 1,
  content_duration: 30,
  fallback_path: '/vendor-dashboard',
  is_fallback: true,
  ad_title: 'Advertise your products on KukuSoko',
  product_name: 'Reach more poultry buyers with a promoted listing.',
  product_price: null,
  ad_image: '/placeholder.svg',
  served_page_location: pageLocation,
});

const dedupeAdvertisements = (ads: Advertisement[]) => {
  const seenIds = new Set<string>();

  return ads.filter((ad) => {
    if (!ad?.id || seenIds.has(ad.id)) {
      return false;
    }

    seenIds.add(ad.id);
    return true;
  });
};

const pickWeightedAd = (ads: Advertisement[], currentAdId?: string | null) => {
  if (ads.length === 0) return null;

  const pool = ads.length > 1 && currentAdId
    ? ads.filter((ad) => ad.id !== currentAdId)
    : ads;

  const weightedPool = pool.flatMap((ad) => Array(Math.max(1, ad.rotation_weight || 1)).fill(ad));
  const randomIndex = Math.floor(Math.random() * weightedPool.length);
  return weightedPool[randomIndex] || pool[0] || ads[0];
};

export const useAdvertisementSlots = (pageLocation: string, limit = 20) => {
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [visibleAds, setVisibleAds] = useState<Set<string>>(new Set());
  const premiumRotationRef = useRef<NodeJS.Timeout | null>(null);
  const basicRotationRef = useRef<NodeJS.Timeout | null>(null);
  const currentPremiumIdRef = useRef<string | null>(null);
  const currentBasicIdRef = useRef<string | null>(null);

  const premiumAds = useMemo(
    () => advertisements.filter((ad) => ad.tier === 'premium'),
    [advertisements]
  );

  const basicAds = useMemo(
    () => advertisements.filter((ad) => ad.tier === 'basic'),
    [advertisements]
  );

  useEffect(() => {
    const clearRotationTimers = () => {
      if (premiumRotationRef.current) clearTimeout(premiumRotationRef.current);
      if (basicRotationRef.current) clearTimeout(basicRotationRef.current);
    };

    const scheduleTierRotation = (
      ads: Advertisement[],
      tier: 'premium' | 'basic'
    ) => {
      const timerRef = tier === 'premium' ? premiumRotationRef : basicRotationRef;
      const currentIdRef = tier === 'premium' ? currentPremiumIdRef : currentBasicIdRef;

      if (timerRef.current) clearTimeout(timerRef.current);
      if (ads.length <= 1) return;

      const activeAd = ads.find((ad) => ad.id === currentIdRef.current) || ads[0];
      const durationMs = Math.max(15, activeAd?.content_duration || 30) * 1000;

      timerRef.current = setTimeout(() => {
        const nextAd = pickWeightedAd(ads, currentIdRef.current);
        if (!nextAd) return;

        currentIdRef.current = nextAd.id;
        setVisibleAds((prev) => {
          const next = new Set(prev);
          ads.forEach((ad) => next.delete(ad.id));
          next.add(nextAd.id);
          return next;
        });

        scheduleTierRotation(ads, tier);
      }, durationMs);
    };

    const fetchAdvertisements = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/advertisements?limit=${limit}&page_location=${pageLocation}`));
        const data = await response.json();
        if (!Array.isArray(data)) {
          const fallbackAd = buildFallbackAdvertisement(pageLocation);
          setAdvertisements([fallbackAd]);
          setVisibleAds(new Set([fallbackAd.id]));
          return;
        }

        const uniqueAdvertisements = dedupeAdvertisements(data);
        const advertisementsToServe = uniqueAdvertisements.length > 0
          ? uniqueAdvertisements
          : [buildFallbackAdvertisement(pageLocation)];

        setAdvertisements(advertisementsToServe);

        const premium = advertisementsToServe.filter((ad: Advertisement) => ad.tier === 'premium');
        const basic = advertisementsToServe.filter((ad: Advertisement) => ad.tier === 'basic');

        const initialVisible = new Set<string>();
        if (premium.length > 0) {
          currentPremiumIdRef.current = premium[0].id;
          initialVisible.add(premium[0].id);
        }
        if (basic.length > 0) {
          currentBasicIdRef.current = basic[0].id;
          initialVisible.add(basic[0].id);
        }
        if (premium.length === 0 && basic.length === 0 && advertisementsToServe[0]) {
          initialVisible.add(advertisementsToServe[0].id);
        }

        setVisibleAds(initialVisible);
        scheduleTierRotation(premium, 'premium');
        scheduleTierRotation(basic, 'basic');
      } catch (error) {
        console.error('Failed to fetch advertisements:', error);
        const fallbackAd = buildFallbackAdvertisement(pageLocation);
        setAdvertisements([fallbackAd]);
        setVisibleAds(new Set([fallbackAd.id]));
      }
    };

    fetchAdvertisements();

    return () => clearRotationTimers();
  }, [limit, pageLocation]);

  const handleAdClose = (adId: string) => {
    const closedAd = advertisements.find((ad) => ad.id === adId);

    setVisibleAds((prev) => {
      const next = new Set(prev);
      next.delete(adId);

      if (!closedAd) return next;

      const tierAds = closedAd.tier === 'premium' ? premiumAds : basicAds;
      const replacement = pickWeightedAd(tierAds, adId);

      if (replacement && replacement.id !== adId) {
        next.add(replacement.id);
        if (closedAd.tier === 'premium') {
          currentPremiumIdRef.current = replacement.id;
        } else {
          currentBasicIdRef.current = replacement.id;
        }
      }

      return next;
    });
  };

  const hasPremiumAd = premiumAds.some((ad) => visibleAds.has(ad.id));

  return {
    advertisements,
    visibleAds,
    hasPremiumAd,
    handleAdClose,
  };
};
