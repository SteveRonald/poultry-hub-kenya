import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { LocationSelect } from '../components/LocationSelect';

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [attemptedSteps, setAttemptedSteps] = useState<Set<number>>(new Set()); // Track which steps user has tried to proceed from
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    phone: '',
    // Vendor fields
    farmName: '',
    idNumber: '',
    farmDescription: '',
    // Location fields (vendor-only)
    countyId: null as number | null,
    constituencyId: null as number | null,
    wardId: null as number | null,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if there's a pending order in sessionStorage
    const pendingOrder = sessionStorage.getItem('pending_order');
    if (pendingOrder) {
      try {
        const orderContext = JSON.parse(pendingOrder);
        if (orderContext.source === 'advertisement') {
          toast.info('Please register to complete your order from the advertisement');
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, []);

  const handleChange = (name: string, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validation functions
  const validateStep1 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Full name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?254[0-9]{9}$|^0[0-9]{9}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid Kenyan phone number (e.g., +254 700 000 000 or 0700 000 000)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.role) {
      newErrors.role = 'Please select an account type';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    // Step 3 is only for vendors
    if (formData.role !== 'vendor') {
      return true; // Skip validation for non-vendors
    }
    
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.countyId) {
      newErrors.countyId = 'Please select a county';
    }
    
    if (!formData.constituencyId) {
      newErrors.constituencyId = 'Please select a subcounty';
    }
    
    if (!formData.wardId) {
      newErrors.wardId = 'Please select a ward/sublocation';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = (): boolean => {
    // Step 4 is only for vendors
    if (formData.role !== 'vendor') {
      return true; // Skip validation for non-vendors
    }
    
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.farmName.trim()) {
      newErrors.farmName = 'Farm name is required';
    } else if (formData.farmName.trim().length < 2) {
      newErrors.farmName = 'Farm name must be at least 2 characters';
    }
    
    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'ID number is required';
    } else if (!/^[0-9]{7,8}$/.test(formData.idNumber.trim())) {
      newErrors.idNumber = 'Please enter a valid Kenyan ID number (7-8 digits)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCurrentStep = (): { isValid: boolean; errors: { [key: string]: string } } => {
    // Clear ALL errors first - we'll only set errors for the current step
    const stepErrors: { [key: string]: string } = {};
    
    switch (currentStep) {
      case 1:
        // ONLY validate step 1 fields - clear all other step errors
        if (!formData.name.trim()) {
          stepErrors.name = 'Full name is required';
        } else if (formData.name.trim().length < 2) {
          stepErrors.name = 'Full name must be at least 2 characters';
        }
        if (!formData.email.trim()) {
          stepErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          stepErrors.email = 'Please enter a valid email address';
        }
        if (!formData.phone.trim()) {
          stepErrors.phone = 'Phone number is required';
        } else if (!/^\+?254[0-9]{9}$|^0[0-9]{9}$/.test(formData.phone.replace(/\s/g, ''))) {
          stepErrors.phone = 'Please enter a valid Kenyan phone number (e.g., +254 700 000 000 or 0700 000 000)';
        }
        // Only set errors for step 1 fields
        setErrors(stepErrors);
        return { isValid: Object.keys(stepErrors).length === 0, errors: stepErrors };
        
      case 2:
        // ONLY validate step 2 fields - clear all other step errors
        if (!formData.password) {
          stepErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
          stepErrors.password = 'Password must be at least 6 characters long';
        }
        if (!formData.confirmPassword) {
          stepErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
          stepErrors.confirmPassword = 'Passwords do not match';
        }
        if (!formData.role) {
          stepErrors.role = 'Please select an account type';
        }
        // Only set errors for step 2 fields
        setErrors(stepErrors);
        return { isValid: Object.keys(stepErrors).length === 0, errors: stepErrors };
        
      case 3:
        // ONLY validate step 3 fields (vendor only)
        if (formData.role !== 'vendor') {
          setErrors({});
          return { isValid: true, errors: {} };
        }
        if (!formData.countyId) {
          stepErrors.countyId = 'Please select a county';
        }
        if (!formData.constituencyId) {
          stepErrors.constituencyId = 'Please select a subcounty';
        }
        if (!formData.wardId) {
          stepErrors.wardId = 'Please select a ward/sublocation';
        }
        // Only set errors for step 3 fields
        setErrors(stepErrors);
        return { isValid: Object.keys(stepErrors).length === 0, errors: stepErrors };
        
      case 4:
        // ONLY validate step 4 fields (vendor only)
        if (formData.role !== 'vendor') {
          setErrors({});
          return { isValid: true, errors: {} };
        }
        if (!formData.farmName.trim()) {
          stepErrors.farmName = 'Farm name is required';
        } else if (formData.farmName.trim().length < 2) {
          stepErrors.farmName = 'Farm name must be at least 2 characters';
        }
        if (!formData.idNumber.trim()) {
          stepErrors.idNumber = 'ID number is required';
        } else if (!/^[0-9]{7,8}$/.test(formData.idNumber.trim())) {
          stepErrors.idNumber = 'Please enter a valid Kenyan ID number (7-8 digits)';
        }
        // Only set errors for step 4 fields
        setErrors(stepErrors);
        return { isValid: Object.keys(stepErrors).length === 0, errors: stepErrors };
        
      default:
        setErrors({});
        return { isValid: true, errors: {} };
    }
  };

  const getTotalSteps = (): number => {
    return formData.role === 'vendor' ? 4 : 2;
  };

  const canAccessStep = (step: number): boolean => {
    // Step 1 is always accessible
    if (step === 1) return true;
    
    // For step 2, step 1 must be completed
    if (step === 2) {
      return completedSteps.includes(1);
    }
    
    // For step 3 (vendor only), step 2 must be completed and role must be vendor
    if (step === 3) {
      return formData.role === 'vendor' && completedSteps.includes(2);
    }
    
    // For step 4 (vendor only), step 3 must be completed and role must be vendor
    if (step === 4) {
      return formData.role === 'vendor' && completedSteps.includes(3);
    }
    
    return false;
  };
  
  // Validate if step is accessible (for UI indication)
  const isStepAccessible = (step: number): boolean => {
    if (step === 1) return true;
    if (step === 2) return completedSteps.includes(1);
    if (step === 3) return formData.role === 'vendor' && completedSteps.includes(2);
    if (step === 4) return formData.role === 'vendor' && completedSteps.includes(3);
    return false;
  };

  const handleNext = () => {
    // Mark that user has attempted to proceed from current step
    setAttemptedSteps(prev => new Set([...prev, currentStep]));
    
    // Validate ONLY the current step before proceeding
    // This returns both validation result and errors
    const validation = validateCurrentStep();
    
    if (!validation.isValid) {
      // Validation failed - errors are already set by validateCurrentStep for current step only
      // IMPORTANT: Only show errors for the CURRENT step, clear all other step errors
      // Get only the errors for the current step
      const currentStepErrors: { [key: string]: string } = {};
      
      // Map step numbers to their field names
      const stepFields: { [key: number]: string[] } = {
        1: ['name', 'email', 'phone'],
        2: ['password', 'confirmPassword', 'role'],
        3: ['countyId', 'constituencyId', 'wardId'],
        4: ['farmName', 'idNumber']
      };
      
      // Only keep errors for fields in the current step
      const fieldsToKeep = stepFields[currentStep] || [];
      Object.keys(validation.errors).forEach(key => {
        if (fieldsToKeep.includes(key)) {
          currentStepErrors[key] = validation.errors[key];
        }
      });
      
      // Set only current step errors, clearing all others
      setErrors(currentStepErrors);
      
      // Don't show toast notifications - let inline errors handle it
      // Don't proceed to next step - stay on current step
      return;
    }
    
    // Validation passed - clear ALL errors and move to next step
    setErrors({});
    
      // Mark current step as completed
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      
      // Move to next step
      const nextStep = currentStep + 1;
      const totalSteps = getTotalSteps();
      
      if (nextStep <= totalSteps) {
      // Clear ALL errors when moving to next step - user hasn't attempted next step yet
      // This ensures no errors show when just navigating to a step
      setErrors({});
        setCurrentStep(nextStep);
      // Remove attemptedSteps for the next step if it exists (fresh start)
      setAttemptedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(nextStep);
        return newSet;
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      // Clear ALL errors when going back - user shouldn't see validation errors when navigating
      setErrors({});
      setCurrentStep(prevStep);
      // Remove attemptedSteps for the previous step to give fresh start
      setAttemptedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(prevStep);
        return newSet;
      });
    }
  };

  const handleStepClick = (step: number) => {
    if (canAccessStep(step)) {
      // Clear ALL errors when clicking on a step - only validate when user clicks Next or Submit
      setErrors({});
      setCurrentStep(step);
      // Remove attemptedSteps for the clicked step to give fresh start
      setAttemptedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(step);
        return newSet;
      });
    } else {
      toast.error('Please complete the previous steps first');
    }
  };

  const getAllValidationErrors = (): { messages: string[], step: number } => {
    const errorMessages: string[] = [];
    let firstErrorStep = 1;
    
    // Validate step 1 and collect errors
    const step1Errors: { [key: string]: string } = {};
    if (!formData.name.trim()) {
      step1Errors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      step1Errors.name = 'Full name must be at least 2 characters';
    }
    if (!formData.email.trim()) {
      step1Errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      step1Errors.email = 'Please enter a valid email address';
    }
    if (!formData.phone.trim()) {
      step1Errors.phone = 'Phone number is required';
    } else if (!/^\+?254[0-9]{9}$|^0[0-9]{9}$/.test(formData.phone.replace(/\s/g, ''))) {
      step1Errors.phone = 'Please enter a valid Kenyan phone number (e.g., +254 700 000 000 or 0700 000 000)';
    }
    Object.values(step1Errors).forEach(err => errorMessages.push(err));
    if (Object.keys(step1Errors).length > 0 && firstErrorStep === 1) {
      firstErrorStep = 1;
    }
    
    // Validate step 2 and collect errors
    const step2Errors: { [key: string]: string } = {};
    if (!formData.password) {
      step2Errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      step2Errors.password = 'Password must be at least 6 characters long';
    }
    if (!formData.confirmPassword) {
      step2Errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      step2Errors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.role) {
      step2Errors.role = 'Please select an account type';
    }
    Object.values(step2Errors).forEach(err => errorMessages.push(err));
    if (Object.keys(step2Errors).length > 0 && firstErrorStep === 1) {
      firstErrorStep = 2;
    }
    
    // Validate vendor steps if applicable
    const step3Errors: { [key: string]: string } = {};
    const step4Errors: { [key: string]: string } = {};
    
    if (formData.role === 'vendor') {
      // Validate step 3 (location)
      if (!formData.countyId) {
        step3Errors.countyId = 'Please select a county';
      }
      if (!formData.constituencyId) {
        step3Errors.constituencyId = 'Please select a subcounty';
      }
      if (!formData.wardId) {
        step3Errors.wardId = 'Please select a ward/sublocation';
      }
      Object.values(step3Errors).forEach(err => errorMessages.push(err));
      if (Object.keys(step3Errors).length > 0 && firstErrorStep <= 2) {
        firstErrorStep = 3;
      }
      
      // Validate step 4 (farm info)
      if (!formData.farmName.trim()) {
        step4Errors.farmName = 'Farm name is required';
      } else if (formData.farmName.trim().length < 2) {
        step4Errors.farmName = 'Farm name must be at least 2 characters';
      }
      if (!formData.idNumber.trim()) {
        step4Errors.idNumber = 'ID number is required';
      } else if (!/^\d{7,8}$/.test(formData.idNumber.trim())) {
        step4Errors.idNumber = 'Please enter a valid Kenyan ID number (7-8 digits)';
      }
      Object.values(step4Errors).forEach(err => errorMessages.push(err));
      if (Object.keys(step4Errors).length > 0 && firstErrorStep <= 3) {
        firstErrorStep = 4;
      }
    }
    
    // Set all errors in state
    setErrors({ 
      ...step1Errors, 
      ...step2Errors, 
      ...(formData.role === 'vendor' ? { ...step3Errors, ...step4Errors } : {}) 
    });
    
    return { messages: errorMessages, step: firstErrorStep };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
    e.preventDefault();
    }
    
    // Mark that user has attempted to submit the form (all steps)
    // This ensures errors are shown for all steps that have issues
    const allSteps = formData.role === 'vendor' ? [1, 2, 3, 4] : [1, 2];
    setAttemptedSteps(new Set(allSteps));
    
    // Validate all steps without showing toast - only show inline errors
    const step1Errors: { [key: string]: string } = {};
    const step2Errors: { [key: string]: string } = {};
    const step3Errors: { [key: string]: string } = {};
    const step4Errors: { [key: string]: string } = {};
    
    // Validate step 1
    if (!formData.name.trim()) step1Errors.name = 'Full name is required';
    else if (formData.name.trim().length < 2) step1Errors.name = 'Full name must be at least 2 characters';
    if (!formData.email.trim()) step1Errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) step1Errors.email = 'Please enter a valid email address';
    if (!formData.phone.trim()) step1Errors.phone = 'Phone number is required';
    else if (!/^\+?254[0-9]{9}$|^0[0-9]{9}$/.test(formData.phone.replace(/\s/g, ''))) step1Errors.phone = 'Please enter a valid Kenyan phone number';
    
    // Validate step 2
    if (!formData.password) step2Errors.password = 'Password is required';
    else if (formData.password.length < 6) step2Errors.password = 'Password must be at least 6 characters long';
    if (!formData.confirmPassword) step2Errors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) step2Errors.confirmPassword = 'Passwords do not match';
    if (!formData.role) step2Errors.role = 'Please select an account type';
    
    // Validate vendor steps if applicable
    if (formData.role === 'vendor') {
      if (!formData.countyId) step3Errors.countyId = 'Please select a county';
      if (!formData.constituencyId) step3Errors.constituencyId = 'Please select a subcounty';
      if (!formData.wardId) step3Errors.wardId = 'Please select a ward/sublocation';
      if (!formData.farmName.trim()) step4Errors.farmName = 'Farm name is required';
      else if (formData.farmName.trim().length < 2) step4Errors.farmName = 'Farm name must be at least 2 characters';
      if (!formData.idNumber.trim()) step4Errors.idNumber = 'ID number is required';
      else if (!/^[0-9]{7,8}$/.test(formData.idNumber.trim())) step4Errors.idNumber = 'Please enter a valid Kenyan ID number';
    }
    
    // Combine all errors
    const allErrorsObj = { 
      ...step1Errors, 
      ...step2Errors, 
      ...(formData.role === 'vendor' ? { ...step3Errors, ...step4Errors } : {}) 
    };
    
    // If there are errors, set them and navigate to first step with errors
    if (Object.keys(allErrorsObj).length > 0) {
      setErrors(allErrorsObj);
      
      // Find first step with errors
      let firstErrorStep = 1;
      if (Object.keys(step1Errors).length > 0) firstErrorStep = 1;
      else if (Object.keys(step2Errors).length > 0) firstErrorStep = 2;
      else if (formData.role === 'vendor' && Object.keys(step3Errors).length > 0) firstErrorStep = 3;
      else if (formData.role === 'vendor' && Object.keys(step4Errors).length > 0) firstErrorStep = 4;
      
      // Navigate to first step with errors - inline errors will show, no toast
      setCurrentStep(firstErrorStep);
      return;
    }
    
    // All validation passed - proceed with registration
    setIsLoading(true);

    try {
      // Prepare registration data
      const registrationData = {
        ...formData,
        county_id: formData.countyId,
        constituency_id: formData.constituencyId,
        ward_id: formData.wardId,
      };
      
      await register(registrationData);
      toast.success(
        formData.role === 'vendor' 
          ? 'Registration successful! Your account is pending approval.' 
          : 'Registration successful!'
      );
      
      // Check for pending order or redirect parameter
      const pendingOrder = sessionStorage.getItem('pending_order');
      const redirectParam = searchParams.get('redirect');
      const productParam = searchParams.get('product');
      const adParam = searchParams.get('ad');
      
      if (pendingOrder || (redirectParam && productParam)) {
        if (productParam) {
          const redirectUrl = adParam 
            ? `/products?product=${productParam}&ad=${adParam}`
            : `/products?product=${productParam}`;
          navigate(redirectUrl);
        } else {
          navigate('/products');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const totalSteps = getTotalSteps();
      const stepLabels = formData.role === 'vendor' 
        ? ['Personal Info', 'Account', 'Location', 'Farm Details']
        : ['Personal Info', 'Account'];
      
    return (
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = completedSteps.includes(stepNumber);
          const isCurrent = currentStep === stepNumber;
          const isAccessible = isStepAccessible(stepNumber);
          
          return (
            <React.Fragment key={stepNumber}>
              <div
          className={`flex items-center ${
            isAccessible ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'
          }`}
                onClick={() => isAccessible && handleStepClick(stepNumber)}
                title={!isAccessible ? 'Complete previous steps first' : stepLabels[i]}
        >
          <div
                  className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-colors ${
              isCompleted
                ? 'bg-green-500 border-green-500 text-white'
                : isCurrent
                ? 'bg-primary border-primary text-white'
                : isAccessible
                ? 'bg-white border-gray-300 text-gray-600 hover:border-primary'
                : 'bg-gray-100 border-gray-300 text-gray-400'
            }`}
          >
            {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
                    <span className="font-semibold text-sm sm:text-base">{stepNumber}</span>
            )}
          </div>
                <div className="ml-2 sm:ml-3 hidden sm:block">
            <div className={`text-sm font-medium ${
              isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : isAccessible ? 'text-gray-700' : 'text-gray-400'
            }`}>
                    Step {stepNumber}
            </div>
            <div className={`text-xs ${
              isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>{stepLabels[i]}</div>
          </div>
              </div>
              {stepNumber < totalSteps && (
            <div
                  className={`mx-2 sm:mx-4 h-0.5 w-6 sm:w-12 transition-colors ${
                    isCompleted ? 'bg-green-500' : completedSteps.includes(stepNumber + 1) ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          )}
            </React.Fragment>
          );
        })}
        </div>
      );
  };

  const renderStep1 = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Personal Information</h3>
      
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
          className={currentStep === 1 && attemptedSteps.has(1) && errors.name ? 'border-red-500' : ''}
        />
        {currentStep === 1 && attemptedSteps.has(1) && errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
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
          className={currentStep === 1 && attemptedSteps.has(1) && errors.email ? 'border-red-500' : ''}
        />
        {currentStep === 1 && attemptedSteps.has(1) && errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number *
        </label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+254 700 000 000 or 0700 000 000"
          className={currentStep === 1 && attemptedSteps.has(1) && errors.phone ? 'border-red-500' : ''}
        />
        {currentStep === 1 && attemptedSteps.has(1) && errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
        <p className="mt-1 text-xs text-gray-500">Format: +254 700 000 000 or 0700 000 000</p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Account Credentials</h3>
      
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
          Account Type *
        </label>
        <Select 
          value={formData.role} 
          onValueChange={(value) => {
            const wasVendor = formData.role === 'vendor';
            const isNowCustomer = value === 'customer';
            
            handleChange('role', value);
            
            // Clear errors when role changes
            setErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors.role;
              return newErrors;
            });
            
            // Reset vendor-specific fields if switching to customer
            if (wasVendor && isNowCustomer) {
              setFormData(prev => ({
                ...prev,
                role: value,
                farmName: '',
                idNumber: '',
                farmDescription: '',
                countyId: null,
                constituencyId: null,
                wardId: null,
              }));
              // Remove vendor-specific completed steps (3 and 4)
              setCompletedSteps(prev => prev.filter(step => step < 3));
              // If currently on step 3 or 4, go back to step 2
              if (currentStep >= 3) {
                setCurrentStep(2);
                setErrors({});
              }
            }
          }}
        >
          <SelectTrigger className={currentStep === 2 && attemptedSteps.has(2) && errors.role ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vendor">Vendor/Farmer</SelectItem>
          </SelectContent>
        </Select>
        {currentStep === 2 && attemptedSteps.has(2) && errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password *
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="Enter your password"
            className={currentStep === 2 && attemptedSteps.has(2) && errors.password ? 'border-red-500' : ''}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {currentStep === 2 && attemptedSteps.has(2) && errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password *
        </label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          placeholder="Confirm your password"
          className={currentStep === 2 && attemptedSteps.has(2) && errors.confirmPassword ? 'border-red-500' : ''}
        />
        {currentStep === 2 && attemptedSteps.has(2) && errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">Farm Location</h3>
      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
        Please select your farm location to help customers find you easily.
      </p>
      
      <LocationSelect
        countyId={formData.countyId}
        constituencyId={formData.constituencyId}
        wardId={formData.wardId}
        onCountyChange={(value) => handleChange('countyId', value)}
        onConstituencyChange={(value) => handleChange('constituencyId', value)}
        onWardChange={(value) => handleChange('wardId', value)}
        disabled={isLoading}
      />
      
      {currentStep === 3 && attemptedSteps.has(3) && errors.countyId && <p className="mt-1 text-sm text-red-600">{errors.countyId}</p>}
      {currentStep === 3 && attemptedSteps.has(3) && errors.constituencyId && <p className="mt-1 text-sm text-red-600">{errors.constituencyId}</p>}
      {currentStep === 3 && attemptedSteps.has(3) && errors.wardId && <p className="mt-1 text-sm text-red-600">{errors.wardId}</p>}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Farm Details</h3>
      
      <div>
        <label htmlFor="farmName" className="block text-sm font-medium text-gray-700 mb-1">
          Farm Name *
        </label>
        <Input
          id="farmName"
          type="text"
          value={formData.farmName}
          onChange={(e) => handleChange('farmName', e.target.value)}
          placeholder="Enter your farm name"
          className={currentStep === 4 && attemptedSteps.has(4) && errors.farmName ? 'border-red-500' : ''}
        />
        {currentStep === 4 && attemptedSteps.has(4) && errors.farmName && <p className="mt-1 text-sm text-red-600">{errors.farmName}</p>}
      </div>

      <div>
        <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 mb-1">
          ID Number *
        </label>
        <Input
          id="idNumber"
          type="text"
          value={formData.idNumber}
          onChange={(e) => handleChange('idNumber', e.target.value)}
          placeholder="Enter your Kenyan ID number"
          className={currentStep === 4 && attemptedSteps.has(4) && errors.idNumber ? 'border-red-500' : ''}
        />
        {currentStep === 4 && attemptedSteps.has(4) && errors.idNumber && <p className="mt-1 text-sm text-red-600">{errors.idNumber}</p>}
        <p className="mt-1 text-xs text-gray-500">Format: 7-8 digits (e.g., 12345678)</p>
      </div>

      <div>
        <label htmlFor="farmDescription" className="block text-sm font-medium text-gray-700 mb-1">
          Farm Description
        </label>
        <Textarea
          id="farmDescription"
          value={formData.farmDescription}
          onChange={(e) => handleChange('farmDescription', e.target.value)}
          placeholder="Tell us about your farm and what you produce"
          rows={4}
        />
        <p className="mt-1 text-xs text-gray-500">Optional: Describe your farm, products, and experience</p>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  const totalSteps = getTotalSteps();
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="min-h-screen bg-beige">
      <Navbar />
      <div className="py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl sm:text-2xl font-bold text-primary">
                Join PoultryConnect KE
              </CardTitle>
              <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
                Create your account to start buying or selling poultry products
              </p>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {/* Step Indicator */}
              <div className="mb-4 sm:mb-6">
              {renderStepIndicator()}
                </div>
                
              <form 
                onSubmit={(e) => {
                  // Always prevent default form submission
                  // Form submission should ONLY happen when user clicks "Create Account" button
    e.preventDefault();
                  e.stopPropagation();
                }} 
                onKeyDown={(e) => {
                  // Prevent form submission on Enter key in input fields
                  // Only allow submission when clicking the "Create Account" button
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // If user presses Enter on last step, trigger the Create Account button click
                    if (isLastStep) {
                      const submitButton = e.currentTarget.querySelector('button[type="button"]:last-child');
                      if (submitButton) {
                        (submitButton as HTMLButtonElement).click();
                      }
        } else {
                      // If not on last step, trigger Next button
                      const nextButton = e.currentTarget.querySelector('button[type="button"]:last-child');
                      if (nextButton) {
                        (nextButton as HTMLButtonElement).click();
                      }
                    }
                  }
                }}
                className="space-y-4 sm:space-y-6"
              >
                {/* Current Step Content - Remove fixed min-height, let content determine height */}
                <div className="min-h-0">
                  {renderCurrentStep()}
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 pt-4 sm:pt-6 border-t mt-4 sm:mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1 || isLoading}
                    className="w-full sm:w-auto flex items-center justify-center order-2 sm:order-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="text-xs sm:text-sm text-gray-500 order-1 sm:order-2">
                    Step {currentStep} of {totalSteps}
                  </div>
                  
                  {isLastStep ? (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      className="btn-primary w-full sm:w-auto flex items-center justify-center order-3"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create Account
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isLoading}
                      className="btn-primary w-full sm:w-auto flex items-center justify-center order-3"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </form>

              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-sm sm:text-base text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in here
                  </Link>
                </p>
              </div>

              {formData.role === 'vendor' && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm sm:text-base text-blue-800 mb-1 sm:mb-2">Vendor Registration Notice</h4>
                  <p className="text-xs sm:text-sm text-blue-700">
                    Your vendor account will be reviewed by our admin team before approval. 
                    You'll be notified once your account is active and you can start listing products.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Register;
