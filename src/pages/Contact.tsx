
import React, { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, AlignCenter, HelpCircle, MessageSquare, ChevronDown } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { getApiUrl } from '../config/api';
import { CHATBASE_CONFIG } from '../config/chatbase';

const Contact = () => {
  const [activeTab, setActiveTab] = useState('contact');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    category: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatbaseLoaded, setChatbaseLoaded] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Load Chatbase help center when help tab is active
  useEffect(() => {
    if (activeTab === 'help') {
      // Check if bot ID is configured
      if (!CHATBASE_CONFIG.botId) {
        console.error('Chatbot not Available. Please try again later.');
        toast.error('Help center is not available. Please contact support.');
        return;
      }

      // Mark as loaded immediately since we're using iframe
      setChatbaseLoaded(true);
      console.log('Chatbase help center ready');
    }
  }, [activeTab]);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(getApiUrl('/api/contact'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Message sent successfully! We\'ll get back to you within 3hrs.');
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          category: '',
          message: ''
        });
      } else {
        toast.error(data.error || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Contact form error:', error);
      }
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: <Phone className="h-6 w-6 text-accent" />,
      title: "Phone",
      details: ["+254 799 422 635", "+254 794 437 135"],
      description: "Call Us Now 24/7 Availability"
    },
    {
      icon: <Mail className="h-6 w-6 text-accent" />,
      title: "Email",
      details: ["okothroni863@gmail.com", "support@kukusoko.com", "kothroni863@gmail.com"],
      description: "We'll respond within 24 hours"
    },
    {
      icon: <MapPin className="h-6 w-6 text-accent" />,
      title: "Office",
      details: ["Eldoret, Kenya", "CBD, Eldoret Street"],
      description: "Visit us by appointment"
    },
    {
      icon: <Clock className="h-6 w-6 text-accent" />,
      title: "Business Hours",
      details: ["Monday - Friday: 8AM - 6PM", "Saturday: 9AM - 4PM"],
      description: "Sunday: Closed (We operate fully online)"
    }
  ];

  const faqs = [
    {
      question: "How do I become a vendor on KukuSoko?",
      answer: "You can register as a vendor by clicking the 'Register' button and selecting 'Vendor/Farmer' as your account type. Your application will be reviewed by our admin team within 24-48 hours. Once approved, you can start listing your products and reach thousands of potential customers across Kenya."
    },
    {
      question: "Is there a commission fee for vendors?",
      answer: "Yes, vendors pay a small commission on each sale. Admin products are commission-free. Contact us for detailed pricing information. Our competitive rates ensure you maximize your profits while benefiting from our platform's reach and marketing."
    },
    {
      question: "How do I verify the quality of products?",
      answer: "All our vendors are verified and products must include real photos. We use AI-powered image verification to ensure authentic product images. Additionally, our quality assurance team conducts regular checks, and we encourage customer reviews to maintain high standards across the platform."
    },
    {
      question: "What payment methods are accepted?",
      answer: "We support multiple payment methods including M-Pesa, Visa, Mastercard, and bank transfers through our secure Paystack integration. All transactions are SSL encrypted and PCI-DSS compliant to ensure your payment information is safe."
    },
    {
      question: "Do you provide training for new poultry farmers?",
      answer: "Yes! We have a comprehensive training center with resources from trusted institutions like FAO, ILRI, and KALRO. Our training covers everything from basic poultry management to advanced breeding techniques, disease prevention, and business management."
    },
    {
      question: "How long does delivery take?",
      answer: "Delivery times vary depending on your location and the vendor's location. Typically, orders within Nairobi are delivered within 1-2 days, while upcountry deliveries take 2-5 days. You can track your order status in real-time through your dashboard."
    },
    {
      question: "What is your return and refund policy?",
      answer: "We offer a 7-day return policy for products that don't meet quality standards or arrive damaged. For live poultry, we have a 24-hour guarantee. Refunds are processed within 5-7 business days after the return is approved. Please contact our support team to initiate a return."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary mb-4">Contact & Support</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Have questions about our platform? Need help with your account? Find answers and get support for your poultry business.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Contact Us
              </TabsTrigger>
              <TabsTrigger value="help" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Help Center
              </TabsTrigger>
              <TabsTrigger value="faq" className="flex items-center gap-2">
                <AlignCenter className="h-4 w-4" />
                FAQ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Contact Information */}
                <div className="lg:col-span-1">
                  <div className="space-y-6">
                    {contactInfo.map((info, index) => (
                      <Card key={index}>
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="bg-accent/10 p-3 rounded-lg">
                              {info.icon}
                            </div>
                            <div>
                              <h3 className="font-semibold text-primary mb-2">{info.title}</h3>
                              {info.details.map((detail, idx) => {
                                const isEmail = detail.includes('@');
                                const isPhone = detail.startsWith('+');
                                if (isEmail) {
                                  return (
                                    <p key={idx} className="text-gray-600 text-sm">
                                      <a href={`mailto:${detail}`} className="hover:text-accent transition-colors">{detail}</a>
                                    </p>
                                  );
                                } else if (isPhone) {
                                  return (
                                    <p key={idx} className="text-gray-600 text-sm">
                                      <a href={`tel:${detail.replace(/\s/g, '')}`} className="hover:text-accent transition-colors">{detail}</a>
                                    </p>
                                  );
                                }
                                return <p key={idx} className="text-gray-600 text-sm">{detail}</p>;
                              })}
                              <p className="text-gray-500 text-xs mt-1">{info.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Contact Form */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageCircle className="h-5 w-5 mr-2" />
                        Send us a Message
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                              Full Name *
                            </label>
                            <Input
                              id="name"
                              type="text"
                              value={formData.name}
                              onChange={(e) => handleChange('name', e.target.value)}
                              placeholder="Enter your full name"
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                              Email Address *
                            </label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleChange('email', e.target.value)}
                              placeholder="Enter your email"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                              Phone Number
                            </label>
                            <Input
                              id="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => handleChange('phone', e.target.value)}
                              placeholder="+254 700 000 000"
                            />
                          </div>

                          <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                              Inquiry Category *
                            </label>
                            <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General Inquiry</SelectItem>
                                <SelectItem value="vendor">Vendor Support</SelectItem>
                                <SelectItem value="customer">Customer Support</SelectItem>
                                <SelectItem value="technical">Technical Issue</SelectItem>
                                <SelectItem value="partnership">Partnership</SelectItem>
                                <SelectItem value="training">Training Resources</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                            Subject *
                          </label>
                          <Input
                            id="subject"
                            type="text"
                            value={formData.subject}
                            onChange={(e) => handleChange('subject', e.target.value)}
                            placeholder="Brief description of your inquiry"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                            Message *
                          </label>
                          <Textarea
                            id="message"
                            value={formData.message}
                            onChange={(e) => handleChange('message', e.target.value)}
                            placeholder="Please provide details about your inquiry..."
                            rows={6}
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          className="w-full btn-primary flex items-center justify-center"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Message
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="help" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <HelpCircle className="h-5 w-5 mr-2" />
                    KukuSoko Help Center
                  </CardTitle>
                  <p className="text-gray-600">
                    Find answers to common questions, browse our knowledge base, and get help with using our platform.
                  </p>
                </CardHeader>
                <CardContent>
                  {CHATBASE_CONFIG.helpCenter.helpPageUrl ? (
                    <iframe
                      src={CHATBASE_CONFIG.helpCenter.helpPageUrl}
                      className="w-full rounded-lg border border-gray-200"
                      style={{
                        minHeight: '700px',
                        height: '700px',
                        border: 'none'
                      }}
                      frameBorder="0"
                      title="KukuSoko Help Center"
                      allow="clipboard-write"
                    />
                  ) : (
                    <div className="w-full min-h-[600px] bg-gray-50 rounded-lg border flex items-center justify-center">
                      <div className="text-center p-8">
                        <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">Help center is not configured</p>
                        <p className="text-sm text-gray-500">Please contact support for assistance</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq" className="space-y-8">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-primary mb-3">Frequently Asked Questions</h2>
                  <p className="text-gray-600">
                    Find quick answers to common questions about KukuSoko platform.
                  </p>
                </div>
                
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200"
                    >
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                        <ChevronDown
                          className={`h-5 w-5 text-primary flex-shrink-0 transition-transform duration-200 ${
                            openFaqIndex === index ? 'transform rotate-180' : ''
                          }`}
                        />
                      </button>
                      
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          openFaqIndex === index ? 'max-h-96' : 'max-h-0'
                        }`}
                      >
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                          <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
                  <div className="flex items-start space-x-4">
                    <HelpCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Still have questions?</h3>
                      <p className="text-gray-600 mb-4">
                        Can't find the answer you're looking for? Our support team is here to help.
                      </p>
                      <Button
                        onClick={() => setActiveTab('contact')}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Contact Support
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Contact;
