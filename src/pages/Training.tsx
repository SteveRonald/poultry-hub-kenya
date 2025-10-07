import React, { useState, useEffect } from 'react';
import { Play, Download, BookOpen, Users, Clock, Filter } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Training = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [showVideoMessage, setShowVideoMessage] = useState(false);

  const categories = [
    { id: 'all', name: 'All Categories', count: 6 },
    { id: 'health', name: 'Poultry Health', count: 2 },
    { id: 'nutrition', name: 'Feeding & Nutrition', count: 1 },
    { id: 'housing', name: 'Housing & Farm Setup', count: 1 },
    { id: 'marketing', name: 'Marketing Strategies', count: 1 },
    { id: 'finance', name: 'Finance & Record Keeping', count: 1 },
    { id: 'breeding', name: 'Breeding & Hatching', count: 0 }
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
      thumbnail: "https://media.istockphoto.com/id/2169150321/photo/disease-prevention-in-chickens-pullets-vaccination-in-close-farm-temperature-and-light.webp?a=1&b=1&s=612x612&w=0&k=20&c=sAzg-Zwj51WivYKYZzKS64SYiVHcMKDgnVuOD_nIEeA=",
      source: "University of Nairobi Veterinary Extension",
      videoUrl: "https://youtu.be/y8u9dqFUyyI?si=-35tsES1rdVg2JO0"
    },
    {
      id: 2,
      title: "Optimal Nutrition for Layer Hens",
      description: "Comprehensive guide to feeding layer hens for maximum egg production and quality.",
      category: "nutrition",
      type: "video",
      duration: "30 min",
      instructor: "Prof. Samuel Kiprotich",
      difficulty: "Beginner",
      thumbnail: "https://media.istockphoto.com/id/481909605/photo/hen-house-business-in-thailand.webp?a=1&b=1&s=612x612&w=0&k=20&c=uOpPqkweI3u8JXtpoV-gn4rJFWhXS3ZuZsqj3hCvijg=",
      source: "KALRO Poultry Research Institute",
      videoUrl: "https://youtu.be/cKDoJHtb9Jo?si=3Dn78DdmYFM9gNmR"
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
      thumbnail: "https://images.unsplash.com/photo-1697545698404-46828377ae9d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8JTIyTW9kZXJuJTIwUG91bHRyeSUyMEhvdXNpbmclMjBEZXNpZ258ZW58MHx8MHx8fDA%3D",
      source: "ILRI Agricultural Engineering",
      videoUrl: "https://youtu.be/87y6sd5P8zc?si=C8Td_ONB2A4-FhiR"
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
      thumbnail: "https://media.istockphoto.com/id/2182763763/photo/poultry-farm.webp?a=1&b=1&s=612x612&w=0&k=20&c=zm4KBTMnn1pWqZKvb2GBd2GB7efHTKD39uOY5D1bNk0=",
      source: "FAO Kenya Office",
      videoUrl: "https://youtu.be/c38AAEPFQFU?si=dEZAh7DTujy7HHgJ"
    },
    {
      id: 5,
      title: "Poultry Business Planning and Marketing",
      description: "Develop effective business plans and marketing strategies for your poultry enterprise.",
      category: "marketing",
      type: "video",
      duration: "40 min",
      instructor: "Mary Njeri",
      difficulty: "Beginner",
      thumbnail: "https://media.istockphoto.com/id/2196792624/photo/portrait-of-a-farmer-using-digital-tablet-in-a-chicken-coop.jpg?s=612x612&w=0&k=20&c=RTAJTqWmzAOzwnbRjy-hwFcmw061h2WfkkpjCeZS5wk=",
      source: "Kenya Poultry Farmers Association",
      videoUrl: "https://youtu.be/XI4JGdvxS44?si=2Elazz3d4a8Klpw-"
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
      thumbnail: "https://media.istockphoto.com/id/2165613271/photo/new-born-chicken-weight-uniformity-quality-control-work-in-hatchery-industrial-production.webp?a=1&b=1&s=612x612&w=0&k=20&c=KQX9_1jczDKFvD1oG09vkBI3-gM4a6ZFXm_zQZX2pMw=",
      source: "Agricultural Finance Corporation",
      videoUrl: "https://youtu.be/E1J2_u8P84k?si=NZPjVkwXX09S34Si"
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

  // Convert YouTube URL to embeddable format
  const convertToEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // Handle different YouTube URL formats
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    return url;
  };

  const handleVideoClick = (videoUrl: string, title: string) => {
    const embedUrl = convertToEmbedUrl(videoUrl);
    setSelectedVideo(embedUrl);
    setSelectedVideoTitle(title);
    setShowVideoMessage(true);
  };

  // Hide video message after 2 seconds
  useEffect(() => {
    if (showVideoMessage) {
      const timer = setTimeout(() => {
        setShowVideoMessage(false);
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [showVideoMessage]);

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
                      
                      <Button 
                        className="w-full btn-primary flex items-center justify-center" 
                        onClick={() => content.type === 'video' ? handleVideoClick(content.videoUrl, content.title) : window.open(content.videoUrl, '_blank')}
                      >
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

          {selectedVideo && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="relative w-full max-w-4xl bg-white rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-primary text-white">
                  <h3 className="text-lg font-semibold">{selectedVideoTitle}</h3>
                  <button 
                    className="text-white hover:text-gray-200 text-2xl font-bold"
                    onClick={() => {
                      setSelectedVideo(null);
                      setSelectedVideoTitle('');
                      setShowVideoMessage(false);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="relative w-full aspect-video">
                  <iframe
                    src={selectedVideo}
                    className="absolute top-0 left-0 w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={selectedVideoTitle}
                    loading="lazy"
                    onError={() => {
                      console.log('Video failed to load:', selectedVideo);
                    }}
                  ></iframe>
                  {showVideoMessage && (
                    <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
                      <p>If the video doesn't load, it may be temporarily unavailable. Please try again later or contact support.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Training;
