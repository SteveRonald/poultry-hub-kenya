import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, AlertCircle, CheckCircle, Scale, Users, ShoppingCart, CreditCard } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Card, CardContent } from '../components/ui/card';

const TermsAndConditions = () => {
  const sections = [
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: "1. Acceptance of Terms",
      content: [
        "By accessing and using KukuSoko platform, you accept and agree to be bound by these Terms and Conditions.",
        "If you do not agree to these terms, please do not use our services.",
        "We reserve the right to modify these terms at any time. Continued use of the platform constitutes acceptance of modified terms."
      ]
    },
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: "2. User Accounts",
      content: [
        "You must be at least 18 years old to create an account on KukuSoko.",
        "You are responsible for maintaining the confidentiality of your account credentials.",
        "You agree to provide accurate, current, and complete information during registration.",
        "You are responsible for all activities that occur under your account.",
        "We reserve the right to suspend or terminate accounts that violate our terms."
      ]
    },
    {
      icon: <ShoppingCart className="h-6 w-6 text-primary" />,
      title: "3. Vendor Terms",
      content: [
        "Vendors must provide accurate product descriptions, pricing, and availability information.",
        "All products must comply with Kenyan laws and regulations regarding poultry products.",
        "Vendors are responsible for product quality and must honor their stated return policies.",
        "A commission fee applies to all vendor sales as outlined in the vendor agreement.",
        "Vendors must respond to customer inquiries within 24 hours.",
        "False advertising or misrepresentation of products may result in account suspension."
      ]
    },
    {
      icon: <ShoppingCart className="h-6 w-6 text-primary" />,
      title: "4. Customer Terms",
      content: [
        "Customers must provide accurate delivery information and contact details.",
        "Payment must be completed before order processing begins.",
        "Customers are responsible for inspecting products upon delivery.",
        "Any issues with products must be reported within 24 hours for live poultry, 7 days for other products.",
        "Customers agree to treat vendors and delivery personnel with respect."
      ]
    },
    {
      icon: <CreditCard className="h-6 w-6 text-primary" />,
      title: "5. Payment Terms",
      content: [
        "All prices are listed in Kenyan Shillings (KSH) and include applicable taxes.",
        "We accept M-Pesa, Visa, Mastercard, and bank transfers through Paystack.",
        "Payment must be completed at the time of order placement.",
        "Refunds are processed according to our refund policy within 5-7 business days.",
        "KukuSoko is not responsible for payment processing fees charged by third-party providers.",
        "All transactions are secured with SSL encryption and PCI-DSS compliance."
      ]
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "6. Product Quality & Verification",
      content: [
        "All vendors are verified before being allowed to sell on our platform.",
        "We use AI-powered image verification to ensure product authenticity.",
        "Products must be accurately represented with real, unedited photos.",
        "We reserve the right to remove listings that do not meet our quality standards.",
        "Customer reviews and ratings help maintain quality across the platform."
      ]
    },
    {
      icon: <AlertCircle className="h-6 w-6 text-primary" />,
      title: "7. Delivery & Shipping",
      content: [
        "Delivery times are estimates and may vary based on location and vendor availability.",
        "Customers must be available to receive deliveries at the specified address.",
        "Failed delivery attempts due to customer unavailability may incur additional fees.",
        "KukuSoko is not liable for delays caused by circumstances beyond our control.",
        "Live poultry deliveries require special handling and may have different terms."
      ]
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-primary" />,
      title: "8. Returns & Refunds",
      content: [
        "We offer a 7-day return policy for products that don't meet quality standards.",
        "Live poultry has a 24-hour guarantee from delivery time.",
        "Products must be returned in their original condition with proof of purchase.",
        "Refunds are processed to the original payment method within 5-7 business days.",
        "Return shipping costs may apply depending on the reason for return.",
        "Custom orders and special requests may not be eligible for returns."
      ]
    },
    {
      icon: <Scale className="h-6 w-6 text-primary" />,
      title: "9. Intellectual Property",
      content: [
        "All content on KukuSoko, including logos, text, graphics, and software, is our property.",
        "You may not reproduce, distribute, or create derivative works without our permission.",
        "Vendors retain ownership of their product images but grant us license to display them.",
        "User-generated content (reviews, comments) may be used by KukuSoko for marketing purposes.",
        "DISCLAIMER: Our training resources may include third-party content such as YouTube videos, articles, and educational materials from organizations like FAO, ILRI, and KALRO. We do not claim ownership of this third-party content. All third-party content remains the property of its respective owners and is used for educational purposes only. We provide links and references to these resources to help our community learn and grow."
      ]
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "10. Privacy & Data Protection",
      content: [
        "We collect and process personal data in accordance with Kenya's Data Protection Act.",
        "Your information is used to provide services, process orders, and improve user experience.",
        "We do not sell your personal information to third parties.",
        "You have the right to access, correct, or delete your personal data.",
        "Please refer to our Privacy Policy for detailed information on data handling."
      ]
    },
    {
      icon: <AlertCircle className="h-6 w-6 text-primary" />,
      title: "11. Prohibited Activities",
      content: [
        "Using the platform for any illegal or unauthorized purpose.",
        "Attempting to gain unauthorized access to our systems or other user accounts.",
        "Posting false, misleading, or fraudulent content.",
        "Harassing, threatening, or abusing other users or staff.",
        "Manipulating prices, reviews, or ratings.",
        "Selling counterfeit, stolen, or prohibited products.",
        "Using automated systems (bots) to access the platform without permission."
      ]
    },
    {
      icon: <Scale className="h-6 w-6 text-primary" />,
      title: "12. Limitation of Liability",
      content: [
        "KukuSoko acts as a marketplace connecting buyers and sellers.",
        "We are not responsible for the quality, safety, or legality of products listed.",
        "We are not liable for any direct, indirect, or consequential damages arising from platform use.",
        "Our total liability is limited to the amount paid for the specific transaction in question.",
        "We do not guarantee uninterrupted or error-free service."
      ]
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: "13. Dispute Resolution",
      content: [
        "We encourage users to resolve disputes directly with vendors first.",
        "Our support team is available to mediate disputes between buyers and sellers.",
        "Unresolved disputes may be escalated to arbitration under Kenyan law.",
        "You agree to attempt good-faith resolution before pursuing legal action.",
        "Legal proceedings must be conducted in Kenyan courts."
      ]
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-primary" />,
      title: "14. Termination",
      content: [
        "We reserve the right to suspend or terminate accounts for violations of these terms.",
        "You may close your account at any time by contacting support.",
        "Upon termination, you lose access to your account and any associated data.",
        "Outstanding orders and financial obligations remain valid after termination.",
        "Certain provisions of these terms survive termination."
      ]
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: "15. Governing Law",
      content: [
        "These Terms and Conditions are governed by the laws of the Republic of Kenya.",
        "Any disputes arising from these terms shall be subject to the exclusive jurisdiction of Kenyan courts.",
        "If any provision is found invalid, the remaining provisions remain in effect."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-primary mb-4">Terms and Conditions</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Please read these terms and conditions carefully before using KukuSoko platform.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Last Updated: January 22, 2026
            </p>
          </div>

          {/* Important Notice */}
          <Card className="mb-8 border-l-4 border-l-accent bg-accent/5">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <AlertCircle className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Important Notice</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    By creating an account or using any part of KukuSoko's services, you acknowledge that you have read, 
                    understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part 
                    of these terms, you must not use our platform.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      {section.icon}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">{section.title}</h2>
                      <ul className="space-y-3">
                        {section.content.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Section */}
          <Card className="mt-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Questions About Our Terms?</h3>
                <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
                  If you have any questions or concerns about these Terms and Conditions, please don't hesitate to contact us. 
                  Our support team is here to help clarify any points.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    Contact Support
                  </Link>
                  <Link
                    to="/contact?tab=faq"
                    className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary border-2 border-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
                  >
                    View FAQs
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agreement Statement */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              By continuing to use KukuSoko, you acknowledge that you have read and understood these Terms and Conditions 
              and agree to be bound by them. These terms constitute a legally binding agreement between you and KukuSoko.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;
