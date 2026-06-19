import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Database, Lock, Cookie, CreditCard, MessageSquare, FileText, CheckCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Card, CardContent } from '../components/ui/card';

const PrivacyPolicy = () => {
  const sections = [
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: '1. Introduction',
      content: [
        'This Privacy Policy explains how KukuSoko collects, uses, stores, and protects personal information when you use our platform.',
        'It applies to customers, vendors, administrators, and visitors who interact with KukuSoko through our website and related services.',
        'By using KukuSoko, you acknowledge that your information may be processed as described in this policy, subject to applicable law.'
      ]
    },
    {
      icon: <Database className="h-6 w-6 text-primary" />,
      title: '2. Information We Collect',
      content: [
        'We may collect account information such as your name, email address, phone number, role, and vendor profile details.',
        'We may collect order and transaction information such as products ordered, pickup or delivery details, payment reference, and order status.',
        'We may collect marketplace activity data such as ratings, reviews, chat activity, advertisement interactions, and support requests.',
        'We may also collect technical information such as device details, browser information, IP address, cookies, local storage data, and session data needed for platform functionality and security.'
      ]
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: '3. How We Use Your Information',
      content: [
        'We use personal data to create and manage accounts, process orders, support checkout and payment flow, and provide marketplace functionality.',
        'We use information to support communication features such as vendor chat, notifications, customer support, and order updates.',
        'We may use data to improve platform usability, analyze system performance, detect abuse, investigate disputes, and maintain platform security.',
        'Where applicable, we may use information for compliance, record-keeping, fraud prevention, and enforcement of our platform rules.'
      ]
    },
    {
      icon: <Cookie className="h-6 w-6 text-primary" />,
      title: '4. Cookies, Local Storage, and Session Data',
      content: [
        'KukuSoko uses cookies, local storage, session storage, and similar browser technologies to support login state, cart continuity, theme preferences, checkout progress, ad tracking, and session management.',
        'Examples include cart data for guest users, authentication tokens, session identifiers, checkout session data, and dismissed advertisement state.',
        'Some browser-stored data is necessary for the platform to work properly. Disabling it may affect login, cart, checkout, chat, or related user experience.'
      ]
    },
    {
      icon: <CreditCard className="h-6 w-6 text-primary" />,
      title: '5. Payments and Transaction Data',
      content: [
        'Payments made through the platform are processed through Paystack and any supported channels made available in that payment flow.',
        'KukuSoko may store transaction references, payment status, and related order metadata needed for verification, fulfillment, support, and audit purposes.',
        'We do not state that full payment card or financial credentials are stored directly by KukuSoko unless expressly required and lawfully handled through approved payment processing arrangements.'
      ]
    },
    {
      icon: <MessageSquare className="h-6 w-6 text-primary" />,
      title: '6. Chats, Ratings, and User Content',
      content: [
        'When you use chat, reviews, ratings, vendor listings, advertisements, or similar interactive features, the content you submit may be stored and processed to provide the service.',
        'We may review or remove content that violates our rules, creates legal risk, or harms platform safety or integrity.',
        'User-generated content may be visible to other users where that visibility is part of the feature design.'
      ]
    },
    {
      icon: <Lock className="h-6 w-6 text-primary" />,
      title: '7. Sharing of Information',
      content: [
        'We may share necessary information with vendors, customers, administrators, payment processors, hosting providers, technical service providers, and legal or regulatory authorities where required.',
        'Information is shared only to the extent reasonably necessary to provide services, operate the platform, comply with legal obligations, or protect rights and security.',
        'We do not sell personal information to third parties.'
      ]
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: '8. Data Security',
      content: [
        'We take reasonable technical and organizational steps to protect personal data against unauthorized access, misuse, loss, or disclosure.',
        'However, no website, payment flow, or internet transmission can be guaranteed to be completely secure.',
        'Users are also responsible for keeping their account credentials private and using the platform safely.'
      ]
    },
    {
      icon: <Database className="h-6 w-6 text-primary" />,
      title: '9. Data Retention',
      content: [
        'We retain information for as long as necessary to provide services, maintain records, resolve disputes, enforce agreements, and comply with legal, accounting, fraud-prevention, or operational requirements.',
        'Some records may be retained even after account closure where retention is required or reasonably necessary.'
      ]
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-primary" />,
      title: '10. Your Rights',
      content: [
        'Subject to applicable Kenyan law, you may have rights to request access to, correction of, objection to, or deletion of eligible personal data.',
        'You may contact KukuSoko to make a privacy-related request, and we may ask for reasonable verification before processing it.',
        'Some requests may be limited where data must be retained for legal, security, fraud-prevention, transaction, or operational reasons.'
      ]
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: '11. Third-Party Services',
      content: [
        'KukuSoko uses third-party services and integrations, including payment processing and certain technical tools, which may process data under their own terms and policies.',
        'Our platform may also reference or embed third-party content such as maps, media, learning content, or external links.',
        'We are not responsible for the privacy practices of third-party websites or services outside our control.'
      ]
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: '12. Policy Updates',
      content: [
        'We may update this Privacy Policy from time to time to reflect legal, technical, operational, or product changes.',
        'Where appropriate, we may display the updated date or provide notice through the platform.'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-primary mb-4">Privacy Policy</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              This policy explains how KukuSoko handles personal information used to operate the marketplace and related services.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Last Updated: April 5, 2026
            </p>
          </div>

          <Card className="mb-8 border-l-4 border-l-accent bg-accent/5">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Shield className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Important Notice</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    This Privacy Policy should be read together with our Terms and Conditions. It is intended to describe how the platform currently operates and does not replace legal advice.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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

          <Card className="mt-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Privacy Questions?</h3>
                <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
                  If you have a question about this Privacy Policy or want to make a privacy-related request, please contact us.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    Contact Support
                  </Link>
                  <Link
                    to="/terms"
                    className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary border-2 border-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
                  >
                    View Terms & Conditions
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
