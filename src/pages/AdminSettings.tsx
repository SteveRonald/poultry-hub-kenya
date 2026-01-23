import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Percent, TrendingUp, Save, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getApiUrl } from '../config/api';
import { useNavigate } from 'react-router-dom';

const AdminSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any[]>([]);
  const [formData, setFormData] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!user) {
      toast.error('Please login to continue');
      navigate('/login');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('admin_session_token');
      if (!token) {
        toast.error('Please login as admin');
        navigate('/admin');
        return;
      }
      
      const response = await fetch(getApiUrl('/api/settings'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/admin');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        // Initialize form data
        const initialData: { [key: string]: string } = {};
        data.settings.forEach((setting: any) => {
          initialData[setting.setting_key] = setting.setting_value;
        });
        setFormData(initialData);
      } else {
        toast.error(data.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_session_token');
      const response = await fetch(getApiUrl('/api/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          setting_key: key,
          setting_value: formData[key]
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Setting updated successfully');
        fetchSettings(); // Refresh settings
      } else {
        toast.error(data.error || 'Failed to update setting');
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const getSettingIcon = (key: string) => {
    switch (key) {
      case 'delivery_fee':
        return <DollarSign className="h-5 w-5 text-primary" />;
      case 'platform_commission_rate':
        return <Percent className="h-5 w-5 text-primary" />;
      case 'min_withdrawal_amount':
      case 'free_delivery_threshold':
        return <TrendingUp className="h-5 w-5 text-primary" />;
      default:
        return <Settings className="h-5 w-5 text-primary" />;
    }
  };

  const formatSettingName = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            System Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage platform-wide settings and configurations
          </p>
        </div>

        <div className="space-y-6">
          {settings.map((setting) => (
            <Card key={setting.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getSettingIcon(setting.setting_key)}
                  {formatSettingName(setting.setting_key)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {setting.description}
                  </p>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        type={setting.setting_type === 'number' ? 'number' : 'text'}
                        value={formData[setting.setting_key] || ''}
                        onChange={(e) => handleChange(setting.setting_key, e.target.value)}
                        placeholder={`Enter ${formatSettingName(setting.setting_key).toLowerCase()}`}
                        min={setting.setting_type === 'number' ? '0' : undefined}
                        step={setting.setting_type === 'number' ? '0.01' : undefined}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(setting.setting_key)}
                      disabled={saving || formData[setting.setting_key] === setting.setting_value}
                      className="flex items-center gap-2"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(setting.updated_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Important Notes */}
        <Card className="mt-8 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Important Notes
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Changes take effect immediately for new transactions</li>
              <li>Delivery fee is added to all orders at checkout</li>
              <li>Set free delivery threshold to 0 to disable free delivery</li>
              <li>Platform commission is deducted from vendor earnings</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default AdminSettings;
