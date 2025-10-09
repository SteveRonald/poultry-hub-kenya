import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Sparkles, 
  Image, 
  FileText, 
  Shield, 
  Lightbulb, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Upload,
  Eye,
  Edit3
} from 'lucide-react';
import { getApiUrl } from '../config/api';
import { toast } from 'sonner';

interface ImageAnalysis {
  quality_score: number;
  detected_objects: string[];
  suggestions: string[];
  inappropriate_content: boolean;
  category_suggestion: string;
  confidence: number;
  analysis_method: string;
  poultry_analysis?: {
    breed_detected: string;
    health_indicators: string[];
    age_estimate: string;
    quality_assessment: string;
  };
}

interface ContentModeration {
  is_approved: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  moderation_method: string;
}

interface ProductSuggestions {
  image_suggestions: string[];
  name_suggestions: string[];
  description_suggestions: string[];
  category_suggestions: string[];
  overall_score: number;
}

interface AIProductAssistantProps {
  onImageAnalysis?: (analysis: ImageAnalysis) => void;
  onDescriptionGenerated?: (description: string) => void;
  onContentModerated?: (moderation: ContentModeration) => void;
  onSuggestionsGenerated?: (suggestions: ProductSuggestions) => void;
  initialData?: {
    productName?: string;
    category?: string;
    description?: string;
    imageUrl?: string;
  };
}

const AIProductAssistant: React.FC<AIProductAssistantProps> = ({
  onImageAnalysis,
  onDescriptionGenerated,
  onContentModerated,
  onSuggestionsGenerated,
  initialData
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'description' | 'moderation' | 'suggestions'>('image');
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiConfig, setAiConfig] = useState<any>(null);
  
  // Image Analysis State
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Description Generation State
  const [generatedDescription, setGeneratedDescription] = useState<string>('');
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  
  // Content Moderation State
  const [contentModeration, setContentModeration] = useState<ContentModeration | null>(null);
  
  // Product Suggestions State
  const [productSuggestions, setProductSuggestions] = useState<ProductSuggestions | null>(null);
  
  // Form Data
  const [formData, setFormData] = useState({
    productName: initialData?.productName || '',
    category: initialData?.category || '',
    description: initialData?.description || '',
    additionalInfo: [] as string[]
  });

  useEffect(() => {
    checkAIConfig();
  }, []);

  const checkAIConfig = async () => {
    try {
      const response = await fetch(getApiUrl('/api/ai/config'));
      const data = await response.json();
      setAiEnabled(data.success && data.config.enabled);
      setAiConfig(data.config);
    } catch (error) {
      console.error('Failed to check AI config:', error);
      setAiEnabled(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!imageFile && !initialData?.imageUrl) {
      toast.error('Please upload an image first');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (initialData?.imageUrl) {
        formData.append('image_url', initialData.imageUrl);
      }

      const response = await fetch(getApiUrl('/api/ai/analyze-image'), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setImageAnalysis(data.analysis);
        onImageAnalysis?.(data.analysis);
        toast.success('Image analyzed successfully!');
      } else {
        toast.error(data.error || 'Image analysis failed');
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      toast.error('Failed to analyze image');
    } finally {
      setLoading(false);
    }
  };

  const generateDescription = async () => {
    if (!formData.productName || !formData.category) {
      toast.error('Please provide product name and category');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/generate-description'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: formData.productName,
          category: formData.category,
          image_analysis: imageAnalysis,
          additional_info: formData.additionalInfo
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedDescription(data.description);
        setNameSuggestions(data.name_suggestions);
        onDescriptionGenerated?.(data.description);
        toast.success('Description generated successfully!');
      } else {
        toast.error(data.error || 'Description generation failed');
      }
    } catch (error) {
      console.error('Description generation error:', error);
      toast.error('Failed to generate description');
    } finally {
      setLoading(false);
    }
  };

  const moderateContent = async () => {
    if (!formData.productName || !formData.description) {
      toast.error('Please provide product name and description');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/moderate-content'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: formData.productName,
          description: formData.description,
          image_analysis: imageAnalysis
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setContentModeration(data.moderation);
        onContentModerated?.(data.moderation);
        toast.success('Content moderation completed!');
      } else {
        toast.error(data.error || 'Content moderation failed');
      }
    } catch (error) {
      console.error('Content moderation error:', error);
      toast.error('Failed to moderate content');
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    if (!formData.productName || !formData.category) {
      toast.error('Please provide product name and category');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/ai/product-suggestions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: formData.productName,
          category: formData.category,
          description: formData.description,
          image_analysis: imageAnalysis
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setProductSuggestions(data.suggestions);
        onSuggestionsGenerated?.(data.suggestions);
        toast.success('Product suggestions generated!');
      } else {
        toast.error(data.error || 'Suggestions generation failed');
      }
    } catch (error) {
      console.error('Suggestions generation error:', error);
      toast.error('Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-blue-600 bg-blue-100';
    if (score >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  if (!aiEnabled) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-orange-600" />
          <h3 className="text-lg font-semibold text-orange-800 mb-2">AI Assistant Unavailable</h3>
          <p className="text-orange-700">AI features are currently disabled. Contact administrator to enable AI services.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-lg sm:text-xl font-semibold text-primary">AI Product Assistant</h2>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
          <CheckCircle className="h-3 w-3 mr-1" />
          {aiConfig?.services?.ultralytics_hub?.has_api_key && aiConfig?.services?.ultralytics_hub?.has_model_id 
            ? 'Custom AI Model Active' 
            : 'AI Enabled'}
        </Badge>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'image', label: 'Image Analysis', icon: Image },
          { id: 'description', label: 'Description', icon: FileText },
          { id: 'moderation', label: 'Content Check', icon: Shield },
          { id: 'suggestions', label: 'Suggestions', icon: Lightbulb }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-0 flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Image Analysis Tab */}
        {activeTab === 'image' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="h-5 w-5" />
                <span>Image Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Upload */}
              <div className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Product Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      title="Upload product image for AI analysis"
                      placeholder="Select an image file"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
                    />
                  </div>
                  <Button 
                    onClick={analyzeImage} 
                    disabled={loading || (!imageFile && !initialData?.imageUrl)}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    <span>Analyze</span>
                  </Button>
                </div>

                {/* Image Preview */}
                {(imagePreview || initialData?.imageUrl) && (
                  <div className="border rounded-lg p-4">
                    <img
                      src={imagePreview || initialData?.imageUrl}
                      alt="Product preview"
                      className="max-w-xs h-32 object-cover rounded"
                    />
                  </div>
                )}
              </div>

              {/* Analysis Results */}
              {imageAnalysis && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Quality Score</h4>
                      <div className="flex items-center space-x-2">
                        <Badge className={getQualityColor(imageAnalysis.quality_score)}>
                          {imageAnalysis.quality_score.toFixed(1)}/10 - {getQualityLabel(imageAnalysis.quality_score)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          ({imageAnalysis.analysis_method})
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Detected Objects</h4>
                      <div className="flex flex-wrap gap-1">
                        {imageAnalysis.detected_objects.map((obj, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {obj}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {imageAnalysis.category_suggestion && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Suggested Category</h4>
                      <Badge variant="secondary">{imageAnalysis.category_suggestion}</Badge>
                    </div>
                  )}

                  {imageAnalysis.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Suggestions</h4>
                      <ul className="space-y-1">
                        {imageAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {imageAnalysis.inappropriate_content && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center space-x-2 text-red-800">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Inappropriate Content Detected</span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
                        This image may contain inappropriate content and should be reviewed.
                      </p>
                    </div>
                  )}

                  {/* Enhanced Poultry Analysis */}
                  {imageAnalysis.poultry_analysis && (
                    <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-md">
                      <h4 className="font-medium text-green-800 flex items-center space-x-2">
                        <Sparkles className="h-4 w-4" />
                        <span>AI Poultry Analysis</span>
                      </h4>
                      
                      {imageAnalysis.poultry_analysis.breed_detected && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-700">Breed Detected</h5>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {imageAnalysis.poultry_analysis.breed_detected}
                          </Badge>
                        </div>
                      )}
                      
                      {imageAnalysis.poultry_analysis.health_indicators.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-700">Health Indicators</h5>
                          <ul className="space-y-1">
                            {imageAnalysis.poultry_analysis.health_indicators.map((indicator, index) => (
                              <li key={index} className="text-sm text-green-700 flex items-start space-x-2">
                                <CheckCircle className="h-3 w-3 mt-0.5 text-green-500" />
                                <span>{indicator}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {imageAnalysis.poultry_analysis.age_estimate && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-700">Age Estimate</h5>
                          <p className="text-sm text-green-700">{imageAnalysis.poultry_analysis.age_estimate}</p>
                        </div>
                      )}
                      
                      {imageAnalysis.poultry_analysis.quality_assessment && (
                        <div className="space-y-2">
                          <h5 className="font-medium text-green-700">Quality Assessment</h5>
                          <p className="text-sm text-green-700">{imageAnalysis.poultry_analysis.quality_assessment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Description Generation Tab */}
        {activeTab === 'description' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Description Generation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    title="Select product category for AI analysis"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select category</option>
                    <option value="Live Poultry">Live Poultry</option>
                    <option value="Eggs">Eggs</option>
                    <option value="Feed & Nutrition">Feed & Nutrition</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={generateDescription} 
                disabled={loading || !formData.productName || !formData.category}
                className="flex items-center space-x-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Generate Description</span>
              </Button>

              {/* Generated Description */}
              {generatedDescription && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Generated Description</h4>
                    <div className="p-4 bg-gray-50 border rounded-md">
                      <p className="text-gray-700">{generatedDescription}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setFormData({ ...formData, description: generatedDescription })}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Use This Description
                    </Button>
                  </div>
                </div>
              )}

              {/* Name Suggestions */}
              {nameSuggestions.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Name Suggestions</h4>
                  <ul className="space-y-1">
                    {nameSuggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                        <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-500" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content Moderation Tab */}
        {activeTab === 'moderation' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Content Moderation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter product description"
                />
              </div>

              <Button 
                onClick={moderateContent} 
                disabled={loading || !formData.productName || !formData.description}
                className="flex items-center space-x-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                <span>Check Content</span>
              </Button>

              {/* Moderation Results */}
              {contentModeration && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">Moderation Result</h4>
                    <Badge className={contentModeration.is_approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {contentModeration.is_approved ? 'Approved' : 'Needs Review'}
                    </Badge>
                  </div>

                  {contentModeration.issues.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-red-800">Issues Found</h5>
                      <ul className="space-y-1">
                        {contentModeration.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-700 flex items-start space-x-2">
                            <AlertTriangle className="h-3 w-3 mt-0.5 text-red-500" />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contentModeration.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-blue-800">Suggestions</h5>
                      <ul className="space-y-1">
                        {contentModeration.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-blue-700 flex items-start space-x-2">
                            <Lightbulb className="h-3 w-3 mt-0.5 text-blue-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5" />
                <span>Product Suggestions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={generateSuggestions} 
                disabled={loading || !formData.productName || !formData.category}
                className="flex items-center space-x-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                <span>Get Suggestions</span>
              </Button>

              {/* Suggestions Results */}
              {productSuggestions && (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Overall Product Score</h4>
                    <div className="text-3xl font-bold text-primary">
                      {productSuggestions.overall_score.toFixed(1)}/10
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getQualityLabel(productSuggestions.overall_score)} Quality
                    </p>
                  </div>

                  {/* Image Suggestions */}
                  {productSuggestions.image_suggestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Image Suggestions</h5>
                      <ul className="space-y-1">
                        {productSuggestions.image_suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <Image className="h-3 w-3 mt-0.5 text-blue-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Name Suggestions */}
                  {productSuggestions.name_suggestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Name Suggestions</h5>
                      <ul className="space-y-1">
                        {productSuggestions.name_suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <Edit3 className="h-3 w-3 mt-0.5 text-green-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Description Suggestions */}
                  {productSuggestions.description_suggestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Description Suggestions</h5>
                      <ul className="space-y-1">
                        {productSuggestions.description_suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <FileText className="h-3 w-3 mt-0.5 text-purple-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Category Suggestions */}
                  {productSuggestions.category_suggestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Category Suggestions</h5>
                      <ul className="space-y-1">
                        {productSuggestions.category_suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-500" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AIProductAssistant;
