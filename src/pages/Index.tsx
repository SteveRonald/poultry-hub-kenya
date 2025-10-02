
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, ShieldCheck, TrendingUp, Star, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const Index = () => {
  const features = [
    {
      icon: <Users className="h-8 w-8 text-accent" />,
      title: "Trusted Network",
      description: "Connect with verified poultry farmers and vendors across Kenya"
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-accent" />,
      title: "Quality Assured",
      description: "All products are verified with real photos and quality standards"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-accent" />,
      title: "Growing Community",
      description: "Join thousands of farmers and customers in our marketplace"
    }
  ];

  const categories = [
    {
      name: "Chicks",
      image: "https://media.istockphoto.com/id/1251142367/photo/small-cute-chickens-close-up.webp?a=1&b=1&s=612x612&w=0&k=20&c=W6Cdm-2XcJOXfmNgYIxYVLQ0DEnDDgsSt1O-EemeYUc=",
      description: "Quality day-old chicks from certified hatcheries"
    },
    {
      name: "Eggs",
      image: "https://media.istockphoto.com/id/2187046189/photo/group-of-fresh-brown-chicken-eggs-in-stack-in-wicker-basket-isolated-on-white-background-with.jpg?s=612x612&w=0&k=20&c=64XDmOVpFPnfeyehQ9iQ1mOBymFs2QE5yR-neC7QKfY=",
      description: "Fresh eggs from free-range and battery cage systems"
    },
    {
      name: "Poultry Meat",
      image: "https://media.istockphoto.com/id/164660922/photo/raw-turkey-meats-and-cuts.jpg?s=612x612&w=0&k=20&c=eGx-H4HC4rUM5illAZvhSXfanZZVZ5LOoYVFxW1jGMg=",
      description: "Premium chicken meat from trusted suppliers"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Wanjiku",
      role: "Poultry Farmer",
      content: "PoultryHubKenya (KE) has transformed my business. I can now reach customers directly without middlemen.",
      rating: 5
    },
    {
      name: "Steve Ronald",
      role: "Customer",
      content: "I always find quality chicks here. The farmers are reliable and the prices are fair.",
      rating: 5
    },
    {
      name: "Grace Akinyi",
      role: "Vendor",
      content: "The platform is easy to use and has helped me grow my poultry supply business significantly.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-primary to-secondary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Kenya's Premier 
                <span className="text-accent"> Poultry</span> Marketplace
              </h1>
              <p className="text-xl mb-8 text-gray-200">
                Connect with trusted poultry farmers across Kenya. Buy quality chicks, eggs, and meat 
                directly from verified suppliers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/products">
                  <Button className="bg-accent hover:bg-accent/90 text-black font-semibold px-8 py-3 text-lg">
                    Browse Products
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" className="border-white text-primary hover:bg-white hover:text-black px-8 py-3 text-lg">
                    Become a Vendor
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8ZWdnfGVufDB8fDB8fHww" 
                alt="Poultry farming in Kenya" 
                className="rounded-lg shadow-2xl"
              />
              <div className="absolute -bottom-4 -right-4 bg-accent text-black p-4 rounded-lg shadow-lg">
                <p className="font-bold text-lg">500+ Farmers</p>
                <p className="text-sm">Trusted Network</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-3xl font-bold text-primary mb-4">
              Why Choose PoultryHubKenya (KE)?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're revolutionizing Kenya's poultry industry by connecting farmers directly with customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="card-hover">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-primary">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-beige">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Shop by Category
            </h2>
            <p className="text-xl text-gray-600">
              Find exactly what you need for your poultry business
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.map((category, index) => (
              <Card key={index} className="card-hover overflow-hidden">
                <div className="relative h-48">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                    <h3 className="text-2xl font-bold text-white">{category.name}</h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-4">{category.description}</p>
                  <Link to="/products" className="text-primary font-semibold flex items-center hover:text-primary/80">
                    Shop Now
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              What Our Community Says
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of satisfied farmers and customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-accent fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-primary">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 text-gray-200 max-w-2xl mx-auto">
            Join Kenya's largest poultry marketplace today and connect with trusted farmers and customers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button className="bg-accent hover:bg-accent/90 text-black font-semibold px-8 py-3 text-lg">
                Start Selling
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" className="border-white text-black hover:bg-white hover:text-primary px-8 py-3 text-lg">
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
