import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';

interface StandardPrice {
  product_name: string;
  price: number;
  date: string;
  type: string;
  record_count?: number;
}

interface MarketInsightsWidgetProps {
  limit?: number; // Number of products to show
  showViewAll?: boolean; // Show "View All" button
}

const MarketInsightsWidget: React.FC<MarketInsightsWidgetProps> = ({ 
  limit = 4, 
  showViewAll = true 
}) => {
  const [standardPrices, setStandardPrices] = useState<StandardPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStandardPrices();
  }, []);

  const fetchStandardPrices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getApiUrl('/api/market-insights/combined'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.standard_prices) {
        // Limit the number of products shown
        setStandardPrices(data.data.standard_prices.slice(0, limit));
      } else {
        setStandardPrices([]);
      }
    } catch (err) {
      console.error('Error fetching market insights:', err);
      setError('Failed to load market insights');
      setStandardPrices([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `KSh ${price.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-gray-500">Loading market prices...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-red-500">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStandardPrices}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (standardPrices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No market data available</p>
            <p className="text-xs text-gray-400 mt-1">Data is being collected. Please check back later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Market Insights
          </CardTitle>
          {showViewAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/market-insights')}
              className="text-xs h-7"
            >
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Current national average prices</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {standardPrices.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{item.product_name}</h4>
                  <Badge variant="outline" className="text-xs">
                    National Avg
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(item.price)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Updated: {formatDate(item.date)}
                  {item.record_count && (
                    <span className="ml-2">• {item.record_count} records</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        {showViewAll && standardPrices.length >= limit && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/market-insights')}
            >
              View Full Market Insights
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketInsightsWidget;

