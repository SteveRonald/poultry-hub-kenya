
import React, { useState } from 'react';
import { Search, Filter, ShoppingCart, Star, MapPin } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Products = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Mock product data
  const products = [
    {
      id: 1,
      name: "Day-Old Chicks - Kienyeji",
      price: 80,
      image: "https://images.unsplash.com/photo-1498936178812-4b2e558d2937",
      category: "chicks",
      vendor: "Sunny Farm",
      location: "Nakuru",
      rating: 4.8,
      reviews: 24,
      description: "Healthy day-old Kienyeji chicks from certified hatchery"
    },
    {
      id: 2,
      name: "Fresh Farm Eggs - Tray of 30",
      price: 450,
      image: "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9",
      category: "eggs",
      vendor: "Green Valley Farm",
      location: "Kiambu",
      rating: 4.9,
      reviews: 18,
      description: "Fresh eggs from free-range hens, delivered daily"
    },
    {
      id: 3,
      name: "Broiler Chicks - Cobb 500",
      price: 120,
      image: "https://images.unsplash.com/photo-1498936178812-4b2e558d2937",
      category: "chicks",
      vendor: "Modern Poultry",
      location: "Nairobi",
      rating: 4.7,
      reviews: 31,
      description: "High-quality Cobb 500 broiler chicks, fast-growing breed"
    },
    {
      id: 4,
      name: "Whole Chicken - 2kg",
      price: 800,
      image: "https://images.unsplash.com/photo-1466721591366-2d5fba72006d",
      category: "meat",
      vendor: "Fresh Poultry Co",
      location: "Mombasa",
      rating: 4.6,
      reviews: 12,
      description: "Fresh whole chicken, free-range, ready for cooking"
    },
    {
      id: 5,
      name: "Layer Chicks - Lohmann Brown",
      price: 150,
      image: "https://images.unsplash.com/photo-1498936178812-4b2e558d2937",
      category: "chicks",
      vendor: "Elite Layers",
      location: "Eldoret",
      rating: 4.8,
      reviews: 22,
      description: "Premium layer chicks, excellent egg production capacity"
    },
    {
      id: 6,
      name: "Chicken Meat - Cut Portions",
      price: 1200,
      image: "https://images.unsplash.com/photo-1466721591366-2d5fba72006d",
      category: "meat",
      vendor: "Prime Cuts",
      location: "Kisumu",
      rating: 4.5,
      reviews: 8,
      description: "Premium cut chicken portions, various cuts available"
    }
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesLocation = selectedLocation === 'all' || product.location === selectedLocation;
    
    return matchesSearch && matchesCategory && matchesLocation;
  });

  const locations = ['all', ...new Set(products.map(p => p.location))];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Browse Products</h1>
            <p className="text-gray-600">Find quality poultry products from trusted farmers across Kenya</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search products or vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="chicks">Chicks</SelectItem>
                  <SelectItem value="eggs">Eggs</SelectItem>
                  <SelectItem value="meat">Meat</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location === 'all' ? 'All Locations' : location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <Card key={product.id} className="card-hover overflow-hidden">
                <div className="relative h-48">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-accent text-black px-2 py-1 rounded-full text-sm font-medium">
                    KSH {product.price}
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg text-primary mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-4 w-4 mr-1" />
                      {product.location}
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-accent fill-current mr-1" />
                      <span className="text-sm font-medium">{product.rating}</span>
                      <span className="text-sm text-gray-500 ml-1">({product.reviews})</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">by {product.vendor}</p>
                      <p className="text-lg font-bold text-primary">KSH {product.price}</p>
                    </div>
                    <Button className="btn-primary flex items-center">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
              <p className="text-gray-400 mt-2">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Products;
