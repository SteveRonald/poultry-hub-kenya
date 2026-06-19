import React, { useState, useEffect, useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { getApiUrl } from '../config/api';

interface County {
  county_id: number;
  county_name: string;
  county_code?: number;
}

interface Constituency {
  constituency_id: number;
  constituency_name: string;
  county_id: number;
}

interface Ward {
  ward_id: number;
  ward_name: string;
  constituency_id: number;
}

interface LocationSelectProps {
  countyId: number | null;
  constituencyId: number | null;
  wardId: number | null;
  onCountyChange: (countyId: number | null) => void;
  onConstituencyChange: (constituencyId: number | null) => void;
  onWardChange: (wardId: number | null) => void;
  disabled?: boolean;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  countyId,
  constituencyId,
  wardId,
  onCountyChange,
  onConstituencyChange,
  onWardChange,
  disabled = false,
}) => {
  const [counties, setCounties] = useState<County[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [loadingConstituencies, setLoadingConstituencies] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  
  // Simple function to load counties
  const loadCounties = useCallback(async (search: string = '') => {
    setLoadingCounties(true);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.append('search', search);
      }
      const url = getApiUrl(`/api/location/counties?${params.toString()}`);
      
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.error('Empty response from API');
        setCounties([]);
        return;
      }
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', text);
        setCounties([]);
        return;
      }
      
      if (result && result.success && Array.isArray(result.data)) {
        setCounties(result.data);
      } else {
        console.error('Invalid response format:', result);
        setCounties([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Request timeout: Failed to fetch counties within 5 seconds');
      } else {
      console.error('Failed to fetch counties:', error);
      }
      setCounties([]);
    } finally {
      setLoadingCounties(false);
    }
  }, []);
  
  // Simple function to load constituencies for a county
  const loadConstituencies = useCallback(async (countyId: number, search: string = '') => {
    if (!countyId) {
      setConstituencies([]);
      setLoadingConstituencies(false);
      return;
    }
    
    setLoadingConstituencies(true);
    console.log('[LocationSelect] Loading constituencies for county:', countyId);
    
    try {
      const params = new URLSearchParams({ county_id: countyId.toString() });
      if (search) {
        params.append('search', search);
      }
      const url = getApiUrl(`/api/location/constituencies?${params.toString()}`);
      console.log('[LocationSelect] Fetching from URL:', url);
      
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log('[LocationSelect] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LocationSelect] HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log('[LocationSelect] Response text length:', text.length);
      
      if (!text || text.trim() === '') {
        console.error('[LocationSelect] Empty response from API');
        setConstituencies([]);
        return;
      }
      
      let result;
      try {
        result = JSON.parse(text);
        console.log('[LocationSelect] Parsed result:', result);
      } catch (parseError) {
        console.error('[LocationSelect] Failed to parse JSON response:', text);
        setConstituencies([]);
        return;
      }
      
      if (result && result.success && Array.isArray(result.data)) {
        console.log('[LocationSelect] Setting constituencies:', result.data.length, 'items');
        setConstituencies(result.data);
      } else {
        console.error('[LocationSelect] Invalid response format:', result);
        setConstituencies([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[LocationSelect] Request timeout: Failed to fetch constituencies within 5 seconds');
      } else {
        console.error('[LocationSelect] Failed to fetch constituencies:', error);
      }
      setConstituencies([]);
    } finally {
      setLoadingConstituencies(false);
      console.log('[LocationSelect] Loading complete, loading state cleared');
    }
  }, []);
  
  // Simple function to load wards for a constituency
  const loadWards = useCallback(async (constituencyId: number, search: string = '') => {
    if (!constituencyId) {
      setWards([]);
      setLoadingWards(false);
      return;
    }
    
    setLoadingWards(true);
    console.log('[LocationSelect] Loading wards for constituency:', constituencyId);
    
    try {
      const params = new URLSearchParams({ constituency_id: constituencyId.toString() });
      if (search) {
        params.append('search', search);
      }
      const url = getApiUrl(`/api/location/wards?${params.toString()}`);
      console.log('[LocationSelect] Fetching wards from URL:', url);
      
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log('[LocationSelect] Wards response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LocationSelect] HTTP error response for wards:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log('[LocationSelect] Wards response text length:', text.length);
      
      if (!text || text.trim() === '') {
        console.error('[LocationSelect] Empty response from API for wards');
        setWards([]);
        return;
      }
      
      let result;
      try {
        result = JSON.parse(text);
        console.log('[LocationSelect] Parsed wards result:', result);
      } catch (parseError) {
        console.error('[LocationSelect] Failed to parse JSON response for wards:', text);
        setWards([]);
        return;
      }
      
      if (result && result.success && Array.isArray(result.data)) {
        console.log('[LocationSelect] Setting wards:', result.data.length, 'items');
        setWards(result.data);
      } else {
        console.error('[LocationSelect] Invalid response format for wards:', result);
        setWards([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[LocationSelect] Request timeout: Failed to fetch wards within 5 seconds');
      } else {
        console.error('[LocationSelect] Failed to fetch wards:', error);
      }
      setWards([]);
    } finally {
      setLoadingWards(false);
      console.log('[LocationSelect] Wards loading complete, loading state cleared');
    }
  }, []);
  
  // Load counties on mount
  useEffect(() => {
    loadCounties('');
  }, [loadCounties]);
  
  // Load constituencies when county changes
  useEffect(() => {
    console.log('[LocationSelect] useEffect triggered - countyId:', countyId, 'type:', typeof countyId);
    if (countyId) {
      console.log('[LocationSelect] County selected, loading constituencies...');
      setConstituencies([]);
      setWards([]);
      onConstituencyChange(null);
      onWardChange(null);
      // Ensure countyId is a number
      const numericCountyId = typeof countyId === 'string' ? parseInt(countyId, 10) : Number(countyId);
      if (isNaN(numericCountyId) || numericCountyId <= 0) {
        console.error('[LocationSelect] Invalid countyId:', countyId);
        setLoadingConstituencies(false);
        return;
      }
      console.log('[LocationSelect] Calling loadConstituencies with numericCountyId:', numericCountyId);
      loadConstituencies(numericCountyId, '');
    } else {
      console.log('[LocationSelect] No county selected, clearing constituencies and wards');
      setConstituencies([]);
      setWards([]);
      setLoadingConstituencies(false);
      setLoadingWards(false);
      onConstituencyChange(null);
      onWardChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyId]); // Only depend on countyId to avoid unnecessary re-renders
  
  // Load wards when constituency changes
  useEffect(() => {
    console.log('[LocationSelect] useEffect triggered for wards - constituencyId:', constituencyId, 'type:', typeof constituencyId);
    if (constituencyId) {
      console.log('[LocationSelect] Constituency selected, loading wards...');
      setWards([]);
      onWardChange(null);
      // Ensure constituencyId is a number
      const numericConstituencyId = typeof constituencyId === 'string' ? parseInt(constituencyId, 10) : Number(constituencyId);
      if (isNaN(numericConstituencyId) || numericConstituencyId <= 0) {
        console.error('[LocationSelect] Invalid constituencyId:', constituencyId);
        setLoadingWards(false);
        return;
      }
      console.log('[LocationSelect] Calling loadWards with numericConstituencyId:', numericConstituencyId);
      loadWards(numericConstituencyId, '');
    } else {
      console.log('[LocationSelect] No constituency selected, clearing wards');
      setWards([]);
      setLoadingWards(false);
      onWardChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constituencyId]); // Only depend on constituencyId to avoid unnecessary re-renders
  
  // Handle county selection
  const handleCountyChange = (value: number | null) => {
    onCountyChange(value);
    onConstituencyChange(null);
    onWardChange(null);
  };
  
  // Handle constituency selection
  const handleConstituencyChange = (value: number | null) => {
    onConstituencyChange(value);
    onWardChange(null);
  };
  
  // Handle ward selection
  const handleWardChange = (value: number | null) => {
    onWardChange(value);
  };
  
  // Handle search - reload with search term
  const handleCountySearch = useCallback((search: string) => {
    loadCounties(search);
  }, [loadCounties]);
  
  const handleConstituencySearch = useCallback((search: string) => {
    if (countyId) {
      loadConstituencies(countyId, search);
    }
  }, [countyId, loadConstituencies]);
  
  const handleWardSearch = useCallback((search: string) => {
    if (constituencyId) {
      loadWards(constituencyId, search);
    }
  }, [constituencyId, loadWards]);
  
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* County Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
          County <span className="text-red-500">*</span>
        </label>
        <Combobox
          options={counties.map(county => ({
            value: county.county_id,
            label: county.county_name,
          }))}
          value={countyId}
          onValueChange={handleCountyChange}
          onSearch={handleCountySearch}
          placeholder="Select county..."
          searchPlaceholder="Search counties..."
          emptyMessage="No counties found."
          disabled={disabled}
          loading={loadingCounties}
        />
      </div>
      
      {/* Constituency (Subcounty) Selection */}
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
          Subcounty <span className="text-red-500">*</span>
          </label>
          <Combobox
          options={constituencies.map(constituency => ({
            value: constituency.constituency_id,
            label: constituency.constituency_name,
            }))}
            value={constituencyId}
            onValueChange={handleConstituencyChange}
            onSearch={handleConstituencySearch}
          placeholder={countyId ? "Select subcounty..." : "Select a county first"}
            searchPlaceholder="Search subcounties..."
          emptyMessage={countyId ? "No subcounties found." : "Please select a county first"}
          disabled={disabled || !countyId || loadingConstituencies}
            loading={loadingConstituencies}
          />
        </div>
      
      {/* Ward Selection */}
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
          Ward/Sublocation <span className="text-red-500">*</span>
          </label>
          <Combobox
          options={wards.map(ward => ({
            value: ward.ward_id,
            label: ward.ward_name,
            }))}
            value={wardId}
            onValueChange={handleWardChange}
            onSearch={handleWardSearch}
          placeholder={constituencyId ? "Select ward..." : "Select a subcounty first"}
            searchPlaceholder="Search wards..."
          emptyMessage={constituencyId ? "No wards found." : "Please select a subcounty first"}
          disabled={disabled || !constituencyId || loadingWards}
            loading={loadingWards}
          />
        </div>
    </div>
  );
};
