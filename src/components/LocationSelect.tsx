import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Combobox } from './ui/combobox';
import { getApiUrl } from '../config/api';

interface County {
  county_id: number;
  county_name: string;
  county_code: number;
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
  
  // Fetch counties
  const fetchCounties = useCallback(async (search: string = '') => {
    setLoadingCounties(true);
    try {
      const params = new URLSearchParams();
      if (search) {
        params.append('search', search);
      }
      const response = await fetch(getApiUrl(`/api/location/counties?${params.toString()}`));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setCounties(data.data);
      } else {
        console.error('Invalid response format:', data);
        setCounties([]);
      }
    } catch (error) {
      console.error('Failed to fetch counties:', error);
      setCounties([]);
    } finally {
      setLoadingCounties(false);
    }
  }, []);
  
  // Fetch constituencies with abort controller ref to cancel previous requests
  const fetchConstituenciesAbortRef = useRef<AbortController | null>(null);
  
  const fetchConstituencies = useCallback(async (countyId: number, search: string = '') => {
    if (!countyId) {
      setConstituencies([]);
      setLoadingConstituencies(false);
      return;
    }
    
    // Cancel any previous request
    if (fetchConstituenciesAbortRef.current) {
      fetchConstituenciesAbortRef.current.abort();
    }
    
    // Create new abort controller for this request
    const controller = new AbortController();
    fetchConstituenciesAbortRef.current = controller;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setLoadingConstituencies(true);
      const params = new URLSearchParams({ county_id: countyId.toString() });
      if (search) {
        params.append('search', search);
      }
      
      // Increased timeout to 5 seconds (should be plenty for local DB, but allows for network delays)
      timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          console.warn('⏱️ Request taking longer than expected, aborting...');
          controller.abort();
        }
      }, 5000); // 5 second timeout
      
      const apiUrl = getApiUrl(`/api/location/constituencies?${params.toString()}`);
      console.log('🔍 Fetching constituencies from:', apiUrl);
      console.log('🔍 County ID:', countyId);
      
      const startTime = Date.now();
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // Clear timeout if request completed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Check if request was aborted (can happen if user changed county quickly)
      if (controller.signal.aborted) {
        console.log('⏸️ Request was aborted (likely due to county change)');
        return; // Don't update state if request was aborted
      }
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ API call completed in ${duration}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          body: errorText
        });
        setConstituencies([]);
        setLoadingConstituencies(false);
        return;
      }
      
      const data = await response.json();
      console.log('✅ Constituencies API Response:', data);
      
      // Double-check request wasn't aborted while parsing JSON
      if (controller.signal.aborted) {
        console.log('⏸️ Request was aborted during response processing');
        return;
      }
      
      if (data.success && Array.isArray(data.data)) {
        setConstituencies(data.data);
        console.log(`✅ Loaded ${data.data.length} constituencies for county ${countyId} in ${data.execution_time_ms || duration}ms`);
        if (data.data.length === 0) {
          console.warn('⚠️ No constituencies found for county:', countyId);
        }
      } else {
        console.error('❌ Invalid response format - expected {success: true, data: []}', data);
        setConstituencies([]);
      }
      
      // Stop loading on success
      setLoadingConstituencies(false);
    } catch (error: any) {
      // Clear timeout in catch block
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Only update state if this request wasn't aborted (i.e., it's the current request)
      if (error.name === 'AbortError') {
        // Request was aborted - this is normal if user changed county quickly
        // Don't log as error, just silently ignore
        console.log('⏸️ Request aborted (likely user changed selection)');
        return; // Don't update loading state or show error
      }
      
      // For other errors, update state
      setLoadingConstituencies(false);
      setConstituencies([]);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('🌐 Network error: Unable to reach API endpoint.');
        console.error('🔗 API URL:', getApiUrl(`/api/location/constituencies`));
        console.error('💡 Make sure:');
        console.error('   1. XAMPP Apache is running');
        console.error('   2. Backend is accessible at:', getApiUrl(''));
        console.error('   3. No firewall is blocking the request');
      } else {
        console.error('❌ Failed to fetch constituencies:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message
        });
      }
    } finally {
      // Clear the abort controller reference if this was the current request
      if (fetchConstituenciesAbortRef.current === controller) {
        fetchConstituenciesAbortRef.current = null;
      }
    }
  }, []);
  
  // Fetch wards with abort controller ref to cancel previous requests
  const fetchWardsAbortRef = useRef<AbortController | null>(null);
  
  const fetchWards = useCallback(async (constituencyId: number, search: string = '') => {
    if (!constituencyId) {
      setWards([]);
      setLoadingWards(false);
      return;
    }
    
    // Cancel any previous request
    if (fetchWardsAbortRef.current) {
      fetchWardsAbortRef.current.abort();
    }
    
    // Create new abort controller for this request
    const controller = new AbortController();
    fetchWardsAbortRef.current = controller;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setLoadingWards(true);
      const params = new URLSearchParams({ constituency_id: constituencyId.toString() });
      if (search) {
        params.append('search', search);
      }
      
      // 5 second timeout (should be plenty for local DB)
      timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
          console.warn('⏱️ Wards request taking longer than expected, aborting...');
          controller.abort();
        }
      }, 5000);
      
      const apiUrl = getApiUrl(`/api/location/wards?${params.toString()}`);
      console.log('🔍 Fetching wards from:', apiUrl);
      console.log('🔍 Constituency ID:', constituencyId);
      
      const startTime = Date.now();
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // Clear timeout if request completed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log('⏸️ Wards request was aborted (likely due to constituency change)');
        return;
      }
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ Wards API call completed in ${duration}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Wards API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          body: errorText
        });
        setWards([]);
        setLoadingWards(false);
        return;
      }
      
      const data = await response.json();
      console.log('✅ Wards API Response:', data);
      
      // Double-check request wasn't aborted while parsing JSON
      if (controller.signal.aborted) {
        console.log('⏸️ Wards request was aborted during response processing');
        return;
      }
      
      if (data.success && Array.isArray(data.data)) {
        setWards(data.data);
        console.log(`✅ Loaded ${data.data.length} wards for constituency ${constituencyId} in ${data.execution_time_ms || duration}ms`);
        if (data.data.length === 0) {
          console.warn('⚠️ No wards found for constituency:', constituencyId);
        }
      } else {
        console.error('❌ Invalid response format - expected {success: true, data: []}', data);
        setWards([]);
      }
      
      // Stop loading on success
      setLoadingWards(false);
    } catch (error: any) {
      // Clear timeout in catch block
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Only update state if this request wasn't aborted
      if (error.name === 'AbortError') {
        // Request was aborted - this is normal if user changed selection quickly
        console.log('⏸️ Wards request aborted (likely user changed selection)');
        return; // Don't update loading state or show error
      }
      
      // For other errors, update state
      setLoadingWards(false);
      setWards([]);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('🌐 Network error: Unable to reach API endpoint.');
        console.error('🔗 API URL:', getApiUrl(`/api/location/wards`));
      } else {
        console.error('❌ Failed to fetch wards:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message
        });
      }
    } finally {
      // Clear the abort controller reference if this was the current request
      if (fetchWardsAbortRef.current === controller) {
        fetchWardsAbortRef.current = null;
      }
    }
  }, []);
  
  // Load counties on mount
  useEffect(() => {
    fetchCounties('');
  }, [fetchCounties]);
  
  // Load constituencies when county changes
  useEffect(() => {
    if (countyId) {
      console.log('📍 County changed to:', countyId, '- Fetching constituencies...');
      // Reset constituency and ward when county changes
      setConstituencies([]);
      setWards([]);
      onConstituencyChange(null);
      onWardChange(null);
      
      // Fetch new constituencies - the function handles its own loading state and abort logic
      fetchConstituencies(countyId, '');
    } else {
      console.log('📍 County cleared - Resetting location fields');
      // Cancel any pending request
      if (fetchConstituenciesAbortRef.current) {
        fetchConstituenciesAbortRef.current.abort();
        fetchConstituenciesAbortRef.current = null;
      }
      setConstituencies([]);
      setWards([]);
      setLoadingConstituencies(false);
      setLoadingWards(false);
      onConstituencyChange(null);
      onWardChange(null);
    }
    
    // Cleanup: cancel request if component unmounts or countyId changes
    return () => {
      if (fetchConstituenciesAbortRef.current) {
        fetchConstituenciesAbortRef.current.abort();
        fetchConstituenciesAbortRef.current = null;
      }
    };
  }, [countyId, fetchConstituencies, onConstituencyChange, onWardChange]);
  
  // Load wards when constituency changes
  useEffect(() => {
    if (constituencyId) {
      console.log('📍 Constituency changed to:', constituencyId, '- Fetching wards...');
      // Reset ward when constituency changes
      setWards([]);
      onWardChange(null);
      
      // Fetch new wards - the function handles its own loading state and abort logic
      fetchWards(constituencyId, '');
    } else {
      console.log('📍 Constituency cleared - Resetting wards');
      // Cancel any pending request
      if (fetchWardsAbortRef.current) {
        fetchWardsAbortRef.current.abort();
        fetchWardsAbortRef.current = null;
      }
      setWards([]);
      setLoadingWards(false);
      onWardChange(null);
    }
    
    // Cleanup: cancel request if component unmounts or constituencyId changes
    return () => {
      if (fetchWardsAbortRef.current) {
        fetchWardsAbortRef.current.abort();
        fetchWardsAbortRef.current = null;
      }
    };
  }, [constituencyId, fetchWards, onWardChange]);
  
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
  
  // Handle search - reload with search term (debounced in Combobox)
  const handleCountySearch = useCallback(async (search: string) => {
    await fetchCounties(search);
  }, [fetchCounties]);
  
  const handleConstituencySearch = useCallback(async (search: string) => {
    if (countyId) {
      await fetchConstituencies(countyId, search);
    }
  }, [countyId, fetchConstituencies]);
  
  const handleWardSearch = useCallback(async (search: string) => {
    if (constituencyId) {
      await fetchWards(constituencyId, search);
    }
  }, [constituencyId, fetchWards]);
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          County *
        </label>
        <Combobox
          options={counties.map(c => ({
            value: c.county_id,
            label: c.county_name,
          }))}
          value={countyId}
          onValueChange={handleCountyChange}
          onSearch={handleCountySearch}
          placeholder="Select County"
          searchPlaceholder="Search counties..."
          emptyMessage="No counties found."
          disabled={disabled}
          loading={loadingCounties}
        />
      </div>
      
      {countyId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subcounty *
          </label>
          <Combobox
            options={constituencies.map(c => ({
              value: c.constituency_id,
              label: c.constituency_name,
            }))}
            value={constituencyId}
            onValueChange={handleConstituencyChange}
            onSearch={handleConstituencySearch}
            placeholder="Select Subcounty"
            searchPlaceholder="Search subcounties..."
            emptyMessage="No subcounties found."
            disabled={disabled}
            loading={loadingConstituencies}
          />
        </div>
      )}
      
      {constituencyId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ward/Sublocation *
          </label>
          <Combobox
            options={wards.map(w => ({
              value: w.ward_id,
              label: w.ward_name,
            }))}
            value={wardId}
            onValueChange={handleWardChange}
            onSearch={handleWardSearch}
            placeholder="Select Ward"
            searchPlaceholder="Search wards..."
            emptyMessage="No wards found."
            disabled={disabled}
            loading={loadingWards}
          />
        </div>
      )}
    </div>
  );
};

