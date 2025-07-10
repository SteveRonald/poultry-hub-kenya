
import React, { useState } from 'react';
import { Play, Download, BookOpen, Users, Clock, Filter } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Training = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Categories', count: 24 },
    { id: 'health', name: 'Poultry Health', count: 6 },
    { id: 'nutrition', name: 'Feeding & Nutrition', count: 5 },
    { id: 'housing', name: 'Housing & Farm Setup', count: 4 },
    { id: 'marketing', name: 'Marketing Strategies', count: 3 },
    { id: 'finance', name: 'Finance & Record Keeping', count: 4 },
    { id: 'breeding', name: 'Breeding & Hatching', count: 2 }
  ];

  const trainingContent = [
    {
      id: 1,
      title: "Poultry Disease Prevention and Management",
      description: "Learn comprehensive strategies for preventing common poultry diseases and maintaining healthy flocks.",
      category: "health",
      type: "video",
      duration: "45 min",
      instructor: "Dr. Jane Wanjiru",
      difficulty: "Intermediate",
      thumbnail: "https://images.unsplash.com/photo-1498936178812-4b2e558d2937",
      source: "University of Nairobi Veterinary Extension"
    },
    {
      id: 2,
      title: "Optimal Nutrition for Layer Hens",
      description: "Comprehensive guide to feeding layer hens for maximum egg production and quality.",
      category: "nutrition",
      type: "pdf",
      duration: "30 min read",
      instructor: "Prof. Samuel Kiprotich",
      difficulty: "Beginner",
      thumbnail: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9",
      source: "KALRO Poultry Research Institute"
    },
    {
      id: 3,
      title: "Modern Poultry Housing Design",
      description: "Design principles for efficient and cost-effective poultry housing systems in Kenya.",
      category: "housing",
      type: "video",
      duration: "60 min",
      instructor: "Eng. Peter Mwangi",
      difficulty: "Advanced",
      thumbnail: "https://images.unsplash.com/photo-1466721591366-2d5fba72006d",
      source: "ILRI Agricultural Engineering"
    },
    {
      id: 4,
      title: "Broiler Production Management",
      description: "Complete guide to raising broiler chickens from day-old to market weight efficiently.",
      category: "health",
      type: "video",
      duration: "55 min",
      instructor: "Dr. Grace Akinyi",
      difficulty: "Intermediate",
      thumbnail: "https://images.unsplash.com/photo-1498936178812-4b2e558d2937",
      source: "FAO Kenya Office"
    },
    {
      id: 5,
      title: "Poultry Business Planning and Marketing",
      description: "Develop effective business plans and marketing strategies for your poultry enterprise.",
      category: "marketing",
      type: "pdf",
      duration: "40 min read",
      instructor: "Mary Njeri",
      difficulty: "Beginner",
      thumbnail: "https://images.unsplash.com/photo-1535268647677-300dbf3d78d1",
      source: "Kenya Poultry Farmers Association"
    },
    {
      id: 6,
      title: "Record Keeping and Financial Management",
      description: "Essential practices for maintaining accurate records and managing finances in poultry farming.",
      category: "finance",
      type: "video",
      duration: "35 min",
      instructor: "CPA John Maina",
      difficulty: "Beginner",
      thumbnail: "https://images.unsplash.com/photo-1721322800607-8c38375eef04",
      source: "Agricultural Finance Corporation"
    }
  ];

  const filteredContent = selectedCategory === 'all' 
    ? trainingContent 
    : trainingContent.filter(content => content.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Play className="h-4 w-4" />;
      case 'pdf': return <Download className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary mb-4">Poultry Training Center</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access expert knowledge and training resources from trusted institutions across Kenya. 
              Learn from leading agricultural universities, research institutes, and industry experts.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="h-8 w-8 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">24</p>
                <p className="text-sm text-gray-600">Training Modules</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">12</p>
                <p className="text-sm text-gray-600">Expert Instructors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">15+</p>
                <p className="text-sm text-gray-600">Hours of Content</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold">FREE</span>
                </div>
                <p className="text-2xl font-bold text-primary">100%</p>
                <p className="text-sm text-gray-600">Free Access</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Categories */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Filter className="h-5 w-5 mr-2" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{category.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            selectedCategory === category.id
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {category.count}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Trusted Sources */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Trusted Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>FAO Kenya Office</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>ILRI Research Institute</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>KALRO</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>University of Nairobi</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Poultry Extension Services</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-primary">
                  {selectedCategory === 'all' 
                    ? 'All Training Content' 
                    : categories.find(c => c.id === selectedCategory)?.name
                  }
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <Select defaultValue="newest">
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="popular">Popular</SelectItem>
                      <SelectItem value="duration">Duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredContent.map(content => (
                  <Card key={content.id} className="card-hover overflow-hidden">
                    <div className="relative h-48">
                      <img 
                        src={content.thumbnail} 
                        alt={content.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm flex items-center">
                        {getTypeIcon(content.type)}
                        <span className="ml-1">{content.duration}</span>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <Badge className={getDifficultyColor(content.difficulty)}>
                          {content.difficulty}
                        </Badge>
                      </div>
                    </div>
                    
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg text-primary mb-2">{content.title}</h3>
                      <p className="text-gray-600 text-sm mb-4">{content.description}</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-500">
                          <Users className="h-4 w-4 mr-2" />
                          {content.instructor}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <BookOpen className="h-4 w-4 mr-2" />
                          {content.source}
                        </div>
                      </div>
                      
                      <Button className="w-full btn-primary flex items-center justify-center">
                        {getTypeIcon(content.type)}
                        <span className="ml-2">
                          {content.type === 'video' ? 'Watch Now' : 'Download'}
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Training;
