
import React, { useState } from 'react';
import { Calendar, User, Eye, MessageCircle, Search, Tag } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const Blog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  const categories = [
    { id: 'all', name: 'All Posts', count: 15 },
    { id: 'tips', name: 'Tips & Guides', count: 6 },
    { id: 'news', name: 'Industry News', count: 4 },
    { id: 'stories', name: 'Farmer Stories', count: 5 }
  ];

  const blogPosts = [
    {
      id: 1,
      title: "10 Essential Tips for Successful Poultry Farming in Kenya",
      excerpt: "Learn the fundamental practices that can make your poultry farm profitable and sustainable in the Kenyan market.",
      content: `Poultry farming in Kenya has become increasingly popular as a source of income and protein. With the right knowledge and practices, you can build a profitable and sustainable poultry business. Here are the 10 essential tips that every poultry farmer should know:

**1. Choose the Right Breed**
Selecting the appropriate chicken breed is crucial for your success. For egg production, consider breeds like Rhode Island Red, Sussex, or Leghorn. For meat production, broiler breeds like Cobb 500 or Ross 308 are excellent choices. Local breeds like Kienyeji are also gaining popularity due to their disease resistance and market demand.

**2. Proper Housing and Space**
Your chickens need adequate space to thrive. Provide at least 2-3 square feet per bird in the coop and 8-10 square feet in the run area. Ensure good ventilation, proper lighting, and protection from predators and harsh weather conditions.

**3. Quality Feed and Nutrition**
Invest in high-quality feed that meets your birds' nutritional requirements. Layer hens need 16-18% protein feed, while broilers require 20-22% protein. Consider supplementing with kitchen scraps, greens, and clean water always available.

**4. Disease Prevention**
Implement a strict vaccination schedule and biosecurity measures. Keep your coop clean, isolate new birds, and monitor your flock daily for signs of illness. Common diseases in Kenya include Newcastle disease, fowl pox, and coccidiosis.

**5. Record Keeping**
Maintain detailed records of feed consumption, egg production, mortality rates, and expenses. This data helps you track profitability and identify areas for improvement.

**6. Marketing Strategy**
Develop a solid marketing plan before you start. Identify your target market - local consumers, restaurants, or supermarkets. Build relationships with potential customers and consider value-added products like processed eggs or chicken meat.

**7. Financial Management**
Keep track of all expenses and income. Calculate your cost of production per egg or per kilogram of meat. This helps you price your products competitively while maintaining profitability.

**8. Seasonal Planning**
Plan your production cycles according to market demand and seasonal factors. Egg production typically increases during festive seasons, while meat demand peaks during holidays.

**9. Continuous Learning**
Stay updated with the latest poultry farming techniques, market trends, and government policies. Join farmer groups, attend workshops, and read agricultural publications.

**10. Start Small, Scale Gradually**
Begin with a manageable number of birds (50-100) to learn the ropes before expanding. This approach minimizes risks and allows you to gain experience while building capital for future growth.

Remember, successful poultry farming requires patience, dedication, and continuous learning. Start with these fundamentals, and you'll be on your way to building a thriving poultry business in Kenya.`,
      author: "Dr. Jane Wanjiru",
      authorRole: "Poultry Specialist",
      publishDate: "2024-01-15",
      readTime: "5 min read",
      category: "tips",
      image: "https://media.istockphoto.com/id/1854952094/photo/healthy-brown-organic-chickens-roaming-in-barn.webp?a=1&b=1&s=612x612&w=0&k=20&c=GJbPvpqvO1W2PnP_-N-gKbWJLk9stNNopM6WujAYJ30=",
      views: 1250,
      comments: 24,
      tags: ["beginner", "farming", "tips"],
      status: "published"
    },
    {
      id: 2,
      title: "How Mary Transformed Her Backyard into a Profitable Poultry Business",
      excerpt: "Meet Mary Wanjiku, who started with 20 chicks and now supplies eggs to over 50 customers in Kiambu.",
      content: `Mary Wanjiku's journey into poultry farming began three years ago when she decided to utilize her small backyard in Kiambu County. What started as a simple experiment with 20 day-old chicks has transformed into a thriving business that supplies fresh eggs to over 50 customers in her community.

**The Beginning**
"I was working as a teacher, but the salary wasn't enough to support my family," Mary recalls. "I had a small piece of land behind my house that was just sitting idle. I thought, why not try poultry farming?"

Mary started with 20 Kienyeji chicks, investing KSh 2,000 in the initial setup. She built a simple coop using locally available materials and started learning about poultry management through online resources and farmer groups.

**The Learning Curve**
The first few months were challenging. Mary lost 5 chicks to diseases she didn't understand. "I didn't know about vaccination schedules or proper feeding," she admits. "But I was determined to learn."

She joined the Kiambu Poultry Farmers Association and attended workshops organized by the Ministry of Agriculture. She also connected with experienced farmers who became her mentors.

**Building the Business**
Within six months, Mary's remaining 15 hens started laying eggs. She began selling to neighbors and local shops. "The demand was higher than I expected," she says. "People preferred fresh, locally produced eggs."

Mary reinvested her profits to expand gradually. She added more hens, improved her housing, and started keeping detailed records of production and sales.

**Current Operations**
Today, Mary manages 200 laying hens in a well-designed coop system. She produces approximately 150-180 eggs daily, selling them at KSh 15-20 per egg depending on size.

Her customer base includes:
- Local households (60%)
- Small restaurants and hotels (25%)
- Local shops and kiosks (15%)

**Key Success Factors**
1. **Quality Focus**: Mary ensures her hens are well-fed and healthy, resulting in high-quality eggs
2. **Customer Relationships**: She maintains personal relationships with her customers, often delivering eggs herself
3. **Record Keeping**: Detailed tracking of costs, production, and sales helps her make informed decisions
4. **Continuous Learning**: She regularly attends training sessions and stays updated with best practices

**Challenges and Solutions**
Mary faces several challenges common to small-scale poultry farmers:

- **Feed Costs**: High feed prices affect profitability. Solution: She grows some feed ingredients and buys in bulk during harvest seasons
- **Disease Management**: Regular vaccination and biosecurity measures help prevent disease outbreaks
- **Market Competition**: She differentiates through quality and personal service

**Financial Impact**
Mary's poultry business now generates approximately KSh 45,000-60,000 monthly profit, significantly supplementing her teaching income. She has been able to:
- Pay school fees for her children
- Improve her family's nutrition
- Save for future investments
- Help other women in her community start similar businesses

**Future Plans**
Mary plans to expand to 500 hens within the next year and is considering adding broiler production. She also wants to start a small hatchery to supply day-old chicks to other farmers in her area.

**Advice for New Farmers**
"Start small, learn continuously, and be patient," Mary advises. "Poultry farming is not a get-rich-quick scheme, but with dedication and proper management, it can provide a stable income and improve your family's livelihood."

Mary's story demonstrates that with determination, proper knowledge, and community support, small-scale poultry farming can be a viable and profitable enterprise in Kenya.`,
      author: "Mary Wanjiku",
      authorRole: "Farmer",
      publishDate: "2024-01-12",
      readTime: "7 min read",
      category: "stories",
      image: "https://images.unsplash.com/photo-1737652384227-d7858678edac?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTZ8fGFmcmljYW4lMjBsYWR5JTIwb24lMjBoZXIlMjBiYWNreWFyZCUyMGhvbGRpbmclMjBhJTIwY2hpY2tlbnxlbnwwfHwwfHx8MA%3D%3D",
      views: 890,
      comments: 18,
      tags: ["success-story", "layers", "business"],
      status: "published"
    },
    {
      id: 3,
      title: "Kenya's Poultry Industry: Market Trends and Opportunities 2024",
      excerpt: "Analysis of the current state of Kenya's poultry industry and emerging opportunities for farmers and investors.",
      content: "The Kenyan poultry industry has shown remarkable growth over the past decade, with production increasing by 15% annually...",
      author: "Prof. Samuel Kiprotich",
      authorRole: "Agricultural Economist",
      publishDate: "2024-01-10",
      readTime: "8 min read",
      category: "news",
      image: "https://media.istockphoto.com/id/2196796614/photo/farmer-photographing-hen-in-a-chicken-coop.webp?a=1&b=1&s=612x612&w=0&k=20&c=bKHpUNB_maAK-dtqdIOzO__XxMqXZph08QjOgAhLpBc=",
      views: 2100,
      comments: 31,
      tags: ["market-analysis", "trends", "investment"],
      status: "published"
    },
    {
      id: 4,
      title: "Preventing Newcastle Disease: A Comprehensive Guide",
      excerpt: "Learn how to protect your flock from one of the most devastating poultry diseases affecting Kenyan farmers.",
      content: "Newcastle disease remains one of the most significant threats to poultry farmers in Kenya...",
      author: "Dr. Grace Akinyi",
      authorRole: "Veterinarian",
      publishDate: "2024-01-08",
      readTime: "6 min read",
      category: "tips",
      image: "https://i.pinimg.com/736x/65/d2/e6/65d2e63d0e73dd44b1e8d307b0d4a58d.jpg",
      views: 1650,
      comments: 42,
      tags: ["health", "disease-prevention", "vaccination"],
      status: "published"
    },
    {
      id: 5,
      title: "From Farm to Table: Building a Sustainable Poultry Supply Chain",
      excerpt: "How local farmers are creating direct-to-consumer channels and building sustainable business models.",
      content: "The traditional poultry supply chain in Kenya has been dominated by middlemen, but innovative farmers are changing this...",
      author: "Peter Mwangi",
      authorRole: "Agribusiness Consultant",
      publishDate: "2024-01-05",
      readTime: "9 min read",
      category: "news",
      image: "https://media.istockphoto.com/id/1667183203/photo/happy-gay-couple-and-holding-hands-with-black-family-on-chicken-farm-for-agriculture.webp?a=1&b=1&s=612x612&w=0&k=20&c=G8GUZk-J8EnLcX_Bj2jTh5C-Yy1DbLp3yucCwzYxa3A=",
      views: 975,
      comments: 16,
      tags: ["supply-chain", "business-model", "sustainability"],
      status: "published"
    },
    {
      id: 6,
      title: "The Journey of John Kamau: From Unemployed to Poultry Entrepreneur",
      excerpt: "How unemployment led John to discover his passion for poultry farming and build a thriving business.",
      content: "John Kamau never imagined that losing his job would be the beginning of his most successful venture...",
      author: "John Kamau",
      authorRole: "Poultry Farmer",
      publishDate: "2024-01-03",
      readTime: "6 min read",
      category: "stories",
      image: "https://images.unsplash.com/photo-1687422808191-93810cd07ab0?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fFRoZSUyMEpvdXJuZXklMjBvZiUyMEpvaG4lMjBLYW1hdSUzQSUyMEZyb20lMjBVbmVtcGxveWVkJTIwdG8lMjBQb3VsdHJ5JTIwRW50cmVwcmVuZXVyfGVufDB8fDB8fHww",
      views: 1340,
      comments: 28,
      tags: ["entrepreneur", "inspiration", "broilers"],
      status: "published"
    }
  ];

  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'tips': return 'bg-green-100 text-green-800';
      case 'news': return 'bg-blue-100 text-blue-800';
      case 'stories': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleExpanded = (postId: number) => {
    setExpandedPost(expandedPost === postId ? null : postId);
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h3 key={index} className="text-lg font-semibold text-primary mt-4 mb-2">{line.slice(2, -2)}</h3>;
      } else if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 mb-1">{line.slice(2)}</li>;
      } else if (line.trim() === '') {
        return <br key={index} />;
      } else {
        return <p key={index} className="mb-3 text-gray-700 leading-relaxed">{line}</p>;
      }
    });
  };

  const featuredPost = blogPosts[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary mb-4">Poultry Farming Blog</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stay updated with the latest insights, tips, and success stories from Kenya's poultry farming community.
            </p>
          </div>

          {/* Featured Post */}
          <Card className="mb-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="relative h-64 lg:h-auto">
                <img 
                  src={featuredPost.image} 
                  alt={featuredPost.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-accent text-black">Featured</Badge>
                </div>
              </div>
              <CardContent className="p-8">
                <div className="flex items-center space-x-4 mb-4">
                  <Badge className={getCategoryColor(featuredPost.category)}>
                    {categories.find(c => c.id === featuredPost.category)?.name}
                  </Badge>
                  <span className="text-sm text-gray-500">{featuredPost.readTime}</span>
                </div>
                
                <h2 className="text-2xl font-bold text-primary mb-4">{featuredPost.title}</h2>
                <p className="text-gray-600 mb-6">{featuredPost.excerpt}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <User className="h-4 w-4 mr-1" />
                      {featuredPost.author}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {featuredPost.publishDate}
                    </div>
                  </div>
                  <Button className="btn-primary" onClick={() => toggleExpanded(featuredPost.id)}>
                    {expandedPost === featuredPost.id ? 'Show Less' : 'Read More'}
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Expanded Content Modal */}
          {expandedPost && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-primary">
                      {blogPosts.find(post => post.id === expandedPost)?.title}
                    </h2>
                    <button
                      onClick={() => setExpandedPost(null)}
                      className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="prose max-w-none">
                    {expandedPost && formatContent(blogPosts.find(post => post.id === expandedPost)?.content || '')}
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>By {blogPosts.find(post => post.id === expandedPost)?.author}</span>
                        <span>•</span>
                        <span>{blogPosts.find(post => post.id === expandedPost)?.publishDate}</span>
                        <span>•</span>
                        <span>{blogPosts.find(post => post.id === expandedPost)?.readTime}</span>
                      </div>
                      <Button onClick={() => setExpandedPost(null)} variant="outline">
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Search */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search posts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Categories */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-primary mb-4">Categories</h3>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{category.name}</span>
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

              {/* Popular Tags */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-primary mb-4">Popular Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {['farming', 'health', 'business', 'tips', 'layers', 'broilers', 'vaccination', 'nutrition'].map(tag => (
                      <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-primary">
                  {selectedCategory === 'all' 
                    ? 'Latest Posts' 
                    : categories.find(c => c.id === selectedCategory)?.name
                  }
                </h2>
                <p className="text-sm text-gray-500">
                  {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'} found
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPosts.slice(1).map(post => (
                  <Card key={post.id} className="card-hover overflow-hidden">
                    <div className="relative h-48">
                      <img 
                        src={post.image} 
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className={getCategoryColor(post.category)}>
                          {categories.find(c => c.id === post.category)?.name}
                        </Badge>
                      </div>
                    </div>
                    
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg text-primary mb-2 line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            {post.author}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {post.publishDate}
                          </div>
                        </div>
                        <span>{post.readTime}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            {post.views}
                          </div>
                          <div className="flex items-center">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            {post.comments}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => toggleExpanded(post.id)}>
                          {expandedPost === post.id ? 'Show Less' : 'Read More'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredPosts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No posts found matching your criteria.</p>
                  <p className="text-gray-400 mt-2">Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Blog;
