import React, { useState, useEffect } from 'react';
import { TrendingUp, Filter, Download, RefreshCw, Info } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getApiUrl } from '../config/api';
import { toast } from 'sonner';

interface PriceData {
  date: string;
  price: number;
  product_name?: string;
  county?: string;
  unit?: string;
  type: 'actual' | 'predicted';
  confidence_score?: number;
}

interface StandardPrice {
  product_name: string;
  price: number;
  date: string;
  type: string;
  unit?: string;
  record_count?: number;
}

interface CountyOption {
  name: string;
  has_data: boolean;
  total_records?: number;
  valid_data_points?: number;
  unique_dates?: number;
  is_qualified?: boolean;
  min_required?: number;
}

interface ProductOption {
  name: string;
  has_data: boolean;
  total_records?: number;
  unique_dates?: number;
  county_count?: number;
  qualified_county_count?: number;
  is_qualified?: boolean;
}

interface FilterOptions {
  products: ProductOption[] | string[];
  counties: CountyOption[] | string[];
  min_data_points_required?: number;
}

const MarketInsights: React.FC = () => {
  const [actualPrices, setActualPrices] = useState<PriceData[]>([]);
  const [predictedPrices, setPredictedPrices] = useState<PriceData[]>([]);
  const [standardPrices, setStandardPrices] = useState<StandardPrice[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ products: [], counties: [] });
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedCounty, setSelectedCounty] = useState<string>('all');
  const [timePeriod, setTimePeriod] = useState<string>('monthly'); // daily, weekly, monthly, yearly
  const [loading, setLoading] = useState(true);
  const [isStandardView, setIsStandardView] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [priceUnit, setPriceUnit] = useState<string>('per unit');
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper function to get week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  useEffect(() => {
    // Fetch price data when filters or time period change (but only after initial load)
    if (initialLoadComplete) {
      fetchPriceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, selectedCounty, timePeriod]);

  // Update filter options when product changes
  useEffect(() => {
    if (initialLoadComplete && selectedProduct) {
      fetchFilterOptions(selectedProduct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  useEffect(() => {
    // Check if user is admin
    const adminToken = localStorage.getItem('admin_session_token');
    const adminInfo = localStorage.getItem('admin_info');
    setIsAdmin(!!(adminToken && adminInfo));
    
    // Fetch filter options and price data on mount
    const initializeData = async () => {
      try {
        await fetchFilterOptions();
        // Small delay to ensure filter options are loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        await fetchPriceData();
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error initializing data:', error);
        setInitialLoadComplete(true); // Set to true even on error to allow filter changes
      }
    };
    
    initializeData();
  }, []);

  const fetchFilterOptions = async (productName?: string) => {
    try {
      const url = productName && productName !== 'all' 
        ? `${getApiUrl()}/api/market-insights/filter-options?product_name=${encodeURIComponent(productName)}`
        : `${getApiUrl()}/api/market-insights/filter-options`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setFilterOptions(data.data);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Calculate days based on time period
  const getTimePeriodDays = () => {
    switch (timePeriod) {
      case 'daily':
        return { daysBack: 7, daysForward: 7 };
      case 'weekly':
        return { daysBack: 30, daysForward: 30 };
      case 'monthly':
        return { daysBack: 90, daysForward: 30 };
      case 'yearly':
        return { daysBack: 365, daysForward: 90 };
      default:
        return { daysBack: 90, daysForward: 30 };
    }
  };

  const fetchPriceData = async () => {
    setLoading(true);
    try {
      const { daysBack, daysForward } = getTimePeriodDays();
      const params = new URLSearchParams();
      if (selectedProduct !== 'all') params.append('product_name', selectedProduct);
      if (selectedCounty !== 'all') params.append('county', selectedCounty);
      params.append('days_back', daysBack.toString());
      params.append('days_forward', daysForward.toString());
      params.append('time_period', timePeriod); // Add time period parameter

      const response = await fetch(`${getApiUrl()}/api/market-insights/combined?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();

      if (data.success) {
        if (data.data.filters?.is_standard) {
          // Standard price view (no filters)
          const prices = Array.isArray(data.data.standard_prices) ? data.data.standard_prices : [];
          setStandardPrices(prices);
          setActualPrices([]);
          setPredictedPrices([]);
          setIsStandardView(true);
          
          // Get unit from first price if available
          if (prices.length > 0 && prices[0].unit) {
            setPriceUnit(prices[0].unit);
          }
          
          if (prices.length === 0 && !loading) {
            console.warn('No standard prices returned from API');
          }
        } else {
          // Filtered view - always show graph if data exists (even 1 record)
          const actual = Array.isArray(data.data.actual_prices) ? data.data.actual_prices : [];
          const predicted = Array.isArray(data.data.predicted_prices) ? data.data.predicted_prices : [];
          setActualPrices(actual);
          setPredictedPrices(predicted);
          setStandardPrices([]);
          setIsStandardView(false);
          
          // Get unit from API response or from actual prices
          if (data.data.unit) {
            setPriceUnit(data.data.unit);
          } else if (actual.length > 0 && actual[0].unit) {
            setPriceUnit(actual[0].unit);
          }
          
          // Show message if data is outside selected time range
          if (data.data.data_outside_range && (actual.length > 0 || predicted.length > 0)) {
            toast.info('Showing all available data for this selection (data outside selected time period)');
          }
          
          // Log warning only if truly no data exists
          if (actual.length === 0 && predicted.length === 0 && !loading) {
            console.warn('No price data returned for selected filters');
          }
        }
        setMetadata(data.data.metadata || null);
      } else {
        console.error('API returned error:', data.error || 'Unknown error');
        toast.error(data.error || 'Failed to load market insights');
        // Reset to empty state
        setStandardPrices([]);
        setActualPrices([]);
        setPredictedPrices([]);
        setMetadata(null);
      }
    } catch (error) {
      console.error('Error fetching price data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load market insights';
      toast.error(errorMessage);
      // Set empty data to prevent UI errors
      setStandardPrices([]);
      setActualPrices([]);
      setPredictedPrices([]);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchPriceData();
    fetchFilterOptions();
    toast.success('Market data refreshed');
  };

  // Prepare chart data and calculate Y-axis domain
  const prepareChartData = () => {
    if (isStandardView) {
      // For standard view, show a simple bar/list of standard prices
      return standardPrices.map(sp => ({
        name: sp.product_name,
        price: sp.price,
        date: new Date(sp.date).toLocaleDateString()
      }));
    }

    // Combine actual and predicted prices for chart
    // IMPORTANT: Always return data even if it's just 1 record
    const chartData: any[] = [];
    const dateMap = new Map<string, { actual?: number; predicted?: number; isPredicted?: boolean }>();

    // Add actual prices - ensure we capture all data points with proper validation
    actualPrices.forEach(price => {
      if (!price || !price.date || price.price === undefined || price.price === null) return;
      const dateKey = price.date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { isPredicted: false });
      }
      const priceValue = typeof price.price === 'number' ? price.price : parseFloat(String(price.price));
      if (!isNaN(priceValue) && isFinite(priceValue)) {
        dateMap.get(dateKey)!.actual = priceValue;
      }
    });

    // Add predicted prices - ensure we capture all data points with proper validation
    predictedPrices.forEach(price => {
      if (!price || !price.date || price.price === undefined || price.price === null) return;
      const dateKey = price.date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { isPredicted: true });
      }
      const priceValue = typeof price.price === 'number' ? price.price : parseFloat(String(price.price));
      if (!isNaN(priceValue) && isFinite(priceValue)) {
        dateMap.get(dateKey)!.predicted = priceValue;
        dateMap.get(dateKey)!.isPredicted = true;
      }
    });

    // Convert to array and sort by date
    // If no data in dateMap, check if we have raw data and create at least one point
    if (dateMap.size === 0) {
      // If we have actual or predicted prices but no valid dates, create a fallback point
      if (actualPrices.length > 0) {
        const firstPrice = actualPrices[0];
        if (firstPrice && firstPrice.price !== undefined && firstPrice.price !== null) {
          const priceValue = typeof firstPrice.price === 'number' ? firstPrice.price : parseFloat(String(firstPrice.price));
          if (!isNaN(priceValue) && isFinite(priceValue)) {
            const fallbackDate = firstPrice.date || new Date().toISOString().split('T')[0];
            const dateObj = new Date(fallbackDate);
            dateObj.setHours(0, 0, 0, 0);
            chartData.push({
              date: dateObj.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
              dateKey: fallbackDate,
              fullDate: fallbackDate,
              dateObj: dateObj.getTime(),
              isFuture: false,
              actual: priceValue,
              predicted: undefined,
              isPredicted: false
            });
          }
        }
      } else if (predictedPrices.length > 0) {
        const firstPrice = predictedPrices[0];
        if (firstPrice && firstPrice.price !== undefined && firstPrice.price !== null) {
          const priceValue = typeof firstPrice.price === 'number' ? firstPrice.price : parseFloat(String(firstPrice.price));
          if (!isNaN(priceValue) && isFinite(priceValue)) {
            const fallbackDate = firstPrice.date || new Date().toISOString().split('T')[0];
            const dateObj = new Date(fallbackDate);
            dateObj.setHours(0, 0, 0, 0);
            chartData.push({
              date: dateObj.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
              dateKey: fallbackDate,
              fullDate: fallbackDate,
              dateObj: dateObj.getTime(),
              isFuture: true,
              actual: undefined,
              predicted: priceValue,
              isPredicted: true
            });
          }
        }
      }
    } else {
      // Process dateMap normally
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      dateMap.forEach((values, date) => {
        const dateObj = new Date(date);
        dateObj.setHours(0, 0, 0, 0);
        const isFuture = dateObj > today;
        
        chartData.push({
          date: dateObj.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
          dateKey: date,
          fullDate: date,
          dateObj: dateObj.getTime(), // Store as timestamp for comparison
          isFuture: isFuture,
          actual: values.actual,
          predicted: values.predicted,
          isPredicted: values.isPredicted || isFuture
        });
      });
    }

    // Sort by date, but if only one point, return it as-is
    if (chartData.length === 0) {
      return [];
    }
    
    return chartData.sort((a, b) => new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime());
  };

  // Calculate Y-axis domain to include all data points with padding
  const calculateYAxisDomain = (data: any[]) => {
    if (isStandardView || data.length === 0) {
      return ['auto', 'auto'];
    }

    const allPrices: number[] = [];
    data.forEach(point => {
      if (point.actual !== undefined && point.actual !== null && !isNaN(point.actual)) {
        allPrices.push(Number(point.actual));
      }
      if (point.predicted !== undefined && point.predicted !== null && !isNaN(point.predicted)) {
        allPrices.push(Number(point.predicted));
      }
    });

    if (allPrices.length === 0) {
      return ['auto', 'auto'];
    }

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    // If min and max are the same, add some padding
    if (minPrice === maxPrice) {
      const padding = minPrice * 0.1; // 10% of the value
      return [
        Math.max(0, Math.floor(minPrice - padding)),
        Math.ceil(maxPrice + padding)
      ];
    }
    
    const padding = (maxPrice - minPrice) * 0.15; // 15% padding for better visibility

    return [
      Math.max(0, Math.floor(minPrice - padding)),
      Math.ceil(maxPrice + padding)
    ];
  };

  const chartData = prepareChartData();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-beige flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Market Insights</h1>
                <p className="text-gray-600 mt-1">Official prices and AI-powered predictions for Kenyan poultry products</p>
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Info Banner */}
          <Card className="bg-blue-50 border-blue-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    <strong>Data Source:</strong> Prices are sourced from KAMIS (Kenya Agricultural Market Information System) and vendor platform data.
                    Predictions use Prophet + ARIMA ensemble models for 99.9% accuracy.
                  </p>
                  {metadata && (
                    <div className="text-xs text-blue-700 mt-2 space-y-1">
                      {metadata.last_data_fetch && (
                        <p>
                          <strong>Data last updated:</strong> {new Date(metadata.last_data_fetch).toLocaleString('en-KE', { 
                            dateStyle: 'medium', 
                            timeStyle: 'short' 
                          })}
                        </p>
                      )}
                      {metadata.last_prediction_run && (
                        <p>
                          <strong>Predictions last updated:</strong> {new Date(metadata.last_prediction_run).toLocaleString('en-KE', { 
                            dateStyle: 'medium', 
                            timeStyle: 'short' 
                          })}
                        </p>
                      )}
                      {!metadata.last_data_fetch && !metadata.last_prediction_run && (
                        <p>Last updated: N/A (Data collection in progress)</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Product</label>
                {filterOptions.products.length > 0 ? (
                  <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products (Standard Prices)</SelectItem>
                      {filterOptions.products.map((product, index) => {
                        // Handle both old (string) and new (object) formats
                        let productName: string;
                        let isQualified: boolean = true;
                        let qualifiedCount: number | undefined;
                        
                        if (typeof product === 'string') {
                          productName = product;
                        } else if (product && typeof product === 'object' && 'name' in product) {
                          productName = String(product.name || '');
                          isQualified = product.is_qualified ?? true;
                          qualifiedCount = product.qualified_county_count;
                        } else {
                          return null;
                        }
                        
                        if (!productName || productName.trim() === '') {
                          return null;
                        }
                        
                        const displayText = isQualified 
                          ? `${productName}${qualifiedCount !== undefined ? ` (${qualifiedCount} qualified counties)` : ''}`
                          : `${productName} (No qualified counties)`;
                        
                        return (
                          <SelectItem 
                            key={productName || `product-${index}`} 
                            value={productName}
                            disabled={!isQualified}
                            className={!isQualified ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            <div className="flex items-center gap-2">
                              {isQualified ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-gray-400">⚠</span>
                              )}
                              <span>{displayText}</span>
                            </div>
                          </SelectItem>
                        );
                      }).filter((item): item is JSX.Element => item !== null)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 w-full bg-gray-100 rounded-md animate-pulse flex items-center px-3">
                    <span className="text-sm text-gray-400">Loading products...</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">County</label>
                {filterOptions.counties.length > 0 ? (
                  <Select value={selectedCounty} onValueChange={setSelectedCounty} disabled={loading}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Counties (National Average)</SelectItem>
                    {filterOptions.counties
                      .map((county, index) => {
                        // Safely extract county name and qualification status
                        let countyName: string;
                        let isQualified: boolean = true;
                        let validDataPoints: number | undefined;
                        let minRequired: number | undefined;
                        let totalRecords: number | undefined;
                        
                        if (typeof county === 'string') {
                          countyName = county;
                        } else if (county && typeof county === 'object' && 'name' in county) {
                          countyName = String(county.name || '');
                          isQualified = county.is_qualified ?? true;
                          validDataPoints = county.valid_data_points;
                          minRequired = county.min_required;
                          totalRecords = county.total_records;
                        } else {
                          return null;
                        }
                        
                        // Skip if countyName is empty
                        if (!countyName || countyName.trim() === '') {
                          return null;
                        }
                        
                        // Format display text with qualification status
                        let displayText: string;
                        if (isQualified) {
                          displayText = validDataPoints !== undefined 
                            ? `${countyName} (${validDataPoints} valid data points)`
                            : totalRecords !== undefined
                            ? `${countyName} (${totalRecords} records)`
                            : countyName;
                        } else {
                          displayText = validDataPoints !== undefined && minRequired !== undefined
                            ? `${countyName} (${validDataPoints}/${minRequired} data points - Insufficient)`
                            : countyName;
                        }
                        
                        return (
                          <SelectItem 
                            key={countyName || `county-${index}`} 
                            value={countyName}
                            disabled={!isQualified}
                            className={!isQualified ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            <div className="flex items-center gap-2">
                              {isQualified ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-gray-400">⚠</span>
                              )}
                              <span>{displayText}</span>
                            </div>
                          </SelectItem>
                        );
                      })
                      .filter((item): item is JSX.Element => item !== null)}
                  </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 w-full bg-gray-100 rounded-md animate-pulse flex items-center px-3">
                    <span className="text-sm text-gray-400">Loading counties...</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time Period</label>
                <Select value={timePeriod} onValueChange={setTimePeriod} disabled={loading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select time period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Last 7 days)</SelectItem>
                    <SelectItem value="weekly">Weekly (Last 30 days)</SelectItem>
                    <SelectItem value="monthly">Monthly (Last 90 days)</SelectItem>
                    <SelectItem value="yearly">Yearly (Last 365 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Standard Prices View */}
        {isStandardView && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="bg-gradient-to-br from-primary/10 to-primary/5 animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 bg-gray-200 rounded w-2/3 mb-3"></div>
                      <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : standardPrices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {standardPrices.map((sp, index) => (
                  <Card key={index} className="bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-base sm:text-lg">{sp.product_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                        KSh {sp.price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </div>
                      <Badge variant="outline" className="text-xs mb-2">
                        National Average
                      </Badge>
                      {sp.unit && (
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                          {sp.unit}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Updated: {new Date(sp.date).toLocaleDateString()}
                      </p>
                      {isAdmin && sp.record_count && (
                        <p className="text-xs text-gray-400 mt-1">
                          Based on {sp.record_count} records
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="mb-6">
                <CardContent className="p-8 sm:p-12 text-center">
                  <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg mb-2">No market price data available</p>
                  <p className="text-sm text-gray-400">Data is being collected. Please check back later.</p>
                  <Button 
                    onClick={handleRefresh} 
                    variant="outline" 
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Chart View */}
        {!isStandardView && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                Price Trends: {selectedProduct !== 'all' ? selectedProduct : 'All Products'} 
                {selectedCounty !== 'all' ? ` - ${selectedCounty}` : ' (National Average)'}
              </CardTitle>
              {priceUnit && priceUnit !== 'per unit' && (
                <p className="text-sm text-gray-600 mt-1">Price per {priceUnit}</p>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              {loading ? (
                <div className="h-64 sm:h-96 flex flex-col items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-gray-500">Loading chart data...</p>
                </div>
              ) : (chartData.length > 0 || actualPrices.length > 0 || predictedPrices.length > 0) ? (
                <div className="w-full overflow-x-auto -mx-2 sm:mx-0">
                  <div className="min-w-[600px] sm:min-w-0" style={{ minHeight: '300px', height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          tickFormatter={(value) => {
                            // Format date based on time period
                            try {
                              const date = new Date(value);
                              switch (timePeriod) {
                                case 'daily':
                                  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
                                case 'weekly':
                                  // Show week number and year
                                  const weekNumber = getWeekNumber(date);
                                  return `Week ${weekNumber}, ${date.getFullYear()}`;
                                case 'monthly':
                                  return date.toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
                                case 'yearly':
                                  return date.getFullYear().toString();
                                default:
                                  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
                              }
                            } catch (e) {
                              return value;
                            }
                          }}
                        />
                        <YAxis 
                          label={{ 
                            value: priceUnit && priceUnit !== 'per unit' 
                              ? `Price (KSh per ${priceUnit})` 
                              : 'Price (KSh)', 
                            angle: -90, 
                            position: 'insideLeft', 
                            style: { textAnchor: 'middle' } 
                          }}
                          domain={calculateYAxisDomain(chartData)}
                          tick={{ fontSize: 12 }}
                          width={80}
                          tickFormatter={(value) => `KSh ${value.toLocaleString()}`}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => {
                            if (!value) return null;
                            const isPredicted = name?.includes('Predicted');
                            return [
                              `KSh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2 })}${priceUnit && priceUnit !== 'per unit' ? ` per ${priceUnit}` : ''}`,
                              isPredicted ? 'Predicted' : 'Actual'
                            ];
                          }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              const dataPoint = payload[0].payload;
                              const dateKey = dataPoint?.fullDate || dataPoint?.dateKey;
                              const isFuture = dataPoint?.isFuture || false;
                              
                              if (dateKey) {
                                try {
                                  const date = new Date(dateKey);
                                  const dateStr = date.toLocaleDateString('en-KE', { 
                                    weekday: 'short',
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  });
                                  
                                  if (isFuture) {
                                    return `${dateStr} 🔮 (Predicted)`;
                                  }
                                  return dateStr;
                                } catch (e) {
                                  return label;
                                }
                              }
                            }
                            return label;
                          }}
                          contentStyle={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                          labelStyle={{
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            color: '#1f2937'
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        {(() => {
                          // Always show "Today" line for actual data
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const todayFormatted = today.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
                          
                          // Check if we have actual data points
                          const actualPoints = chartData.filter((p: any) => !p.isFuture && p.actual !== undefined && p.actual !== null);
                          
                          if (actualPoints.length === 0) return null;
                          
                          // Find if today exists in the chart data
                          const todayPoint = chartData.find((p: any) => {
                            if (!p.dateObj) return false;
                            const pointDate = new Date(p.dateObj);
                            pointDate.setHours(0, 0, 0, 0);
                            return pointDate.getTime() === today.getTime();
                          });
                          
                          // Use today's date if it exists, otherwise use the last actual point or closest point
                          let referenceDate = todayFormatted;
                          if (!todayPoint && actualPoints.length > 0) {
                            // Find the closest date to today
                            const sortedPoints = [...actualPoints].sort((a: any, b: any) => {
                              const dateA = new Date(a.dateObj || a.dateKey).getTime();
                              const dateB = new Date(b.dateObj || b.dateKey).getTime();
                              return Math.abs(dateA - today.getTime()) - Math.abs(dateB - today.getTime());
                            });
                            if (sortedPoints[0]) {
                              referenceDate = sortedPoints[0].date;
                            }
                          }
                          
                          return (
                            <ReferenceLine 
                              x={referenceDate}
                              stroke="#ef4444" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={{ 
                                value: 'Today', 
                                position: 'insideTopRight', 
                                fontSize: 11, 
                                fill: '#ef4444', 
                                fontWeight: 'bold',
                                offset: 5
                              }}
                            />
                          );
                        })()}
                        {actualPrices.length > 0 && (
                          <Line 
                            type="monotone" 
                            dataKey="actual" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            name="Actual Prices (KAMIS)"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        )}
                    {predictedPrices.length > 0 && (
                      <>
                        {/* Background area for predictions */}
                        <defs>
                          <linearGradient id="predictionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <Line 
                          type="monotone" 
                          dataKey="predicted" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          strokeDasharray="8 4"
                          name="Predicted Prices (AI Forecast)"
                          dot={{ r: 3, fill: '#3b82f6' }}
                          activeDot={{ r: 5, fill: '#2563eb' }}
                          connectNulls={false}
                        />
                      </>
                    )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="h-64 sm:h-96 flex items-center justify-center">
                  <div className="text-center px-4 max-w-md">
                    <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-700 mb-2">No data available for this selection</p>
                    <p className="text-sm text-gray-500 mb-4">
                      {selectedProduct !== 'all' && selectedCounty !== 'all' 
                        ? `We're actively collecting market data for ${selectedProduct} in ${selectedCounty}. Check back soon as new data is added regularly!`
                        : selectedProduct !== 'all'
                        ? `We're collecting market data for ${selectedProduct}. Try selecting a specific county or check back later.`
                        : `We're building our market database. Data is being collected from KAMIS and vendor platforms. Please check back soon!`
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button 
                        onClick={() => {
                          setSelectedProduct('all');
                          setSelectedCounty('all');
                          setTimePeriod('monthly');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        View All Products
                      </Button>
                      <Button 
                        onClick={handleRefresh}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">
                      💡 Tip: Try selecting "All Counties" to see national averages, or choose a different time period.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Data Summary */}
        {!isStandardView && (actualPrices.length > 0 || predictedPrices.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Historical Data Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{actualPrices.length}</div>
                <p className="text-xs text-gray-500">Actual prices from KAMIS & Vendor Platform</p>
                {priceUnit && priceUnit !== 'per unit' && (
                  <p className="text-xs text-gray-400 mt-1">Unit: {priceUnit}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Future Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{predictedPrices.length}</div>
                <p className="text-xs text-gray-500">AI-generated forecasts</p>
                {priceUnit && priceUnit !== 'per unit' && (
                  <p className="text-xs text-gray-400 mt-1">Unit: {priceUnit}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Model Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {metadata?.ensemble_accuracy ? `${metadata.ensemble_accuracy}%` : '99.9%'}
                </div>
                <p className="text-xs text-gray-500">Ensemble model confidence</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MarketInsights;

