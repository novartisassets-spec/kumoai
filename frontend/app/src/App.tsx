import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ChevronLeft, ChevronRight, Menu, X, Sparkles, Smartphone, Brain, FileText, Target, Heart, Globe, Zap, Rocket, Building, Star, Gift, Layers, CreditCard, Play, Mail, Phone, MapPin, Github, Twitter, Linkedin, Instagram, Lock, User, ArrowRight, Eye, EyeOff, School, ArrowLeft, LayoutDashboard, Users, BookOpen, BarChart3, Settings, Search, Bell, LogOut, GraduationCap, UserPlus, Upload, Check, CheckCircle, Clock, Table, TrendingUp, Share2, Download, AlertCircle, Shield, Camera, QrCode, Calendar, Award, Loader2 } from 'lucide-react';
import { ConnectAI, ConnectAICard } from './components/ConnectAI';
import { AdminSetupWizard } from './components/AdminSetupWizard';
import { PhoneInput } from './components/PhoneInput';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { authService } from './lib/auth';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Navigation Component
function Navigation({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'docs', label: 'Docs' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => onNavigate('landing')} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">KUMO-AI</span>
        </button>

        {/* Center Links - Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id as any)}
              className="nav-link"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Right CTA */}
        <div className="hidden md:block">
          <button onClick={() => onNavigate('login')} className="cta-pill">
            <span className="cta-pill-icon">
              <MessageCircle className="w-3.5 h-3.5" />
            </span>
            <span>Enter the KUMO-AI Realm</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#4a4f55]/95 backdrop-blur-xl border-t border-white/10 p-6">
          <div className="flex flex-col gap-4">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => {
                  onNavigate(link.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className="text-white/70 hover:text-white py-2 text-left"
              >
                {link.label}
              </button>
            ))}
            <div className="border-t border-white/10 pt-4 mt-2">
              <button 
                onClick={() => {
                  onNavigate('login');
                  setIsMobileMenuOpen(false);
                }} 
                className="cta-pill w-full justify-center"
              >
                <span className="cta-pill-icon">
                  <MessageCircle className="w-3.5 h-3.5" />
                </span>
                <span>Enter the KUMO-AI Realm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// Hero Section - Exact match to reference
function HeroSection({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login') => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-screen bg-[#4a4f55] overflow-hidden">
      {/* Background Blurred Text - Responsive sizing */}
      <div className="bg-text-blur">KUMO-AI</div>

      {/* Main Content Container */}
      <div className="relative z-30 min-h-screen flex flex-col lg:flex-row items-center justify-between px-6 lg:px-12 pt-28 pb-12 gap-8 lg:gap-4">

        {/* Left Column - Text */}
        <div
          className={`w-full lg:w-1/3 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow">For Teachers. For Schools. For Africa.</p>
          <h1 className="headline text-white">
            Let Teachers Teach.<br />
            Let <span className="text-black bg-[#ffd700] px-2 py-1 rounded-md text-[0.75em] inline-block font-bold shadow-md shadow-[#ffd700]/20 border border-[#ffed4e]">KUMO-AI</span> Handle The Rest.
          </h1>
          <p className="description">
            AI powered School Academic Operation management through WhatsApp.<br />
            Marks, reports, attendance, parent updates—all handled while you teach.<br />
            Seamless education management.
          </p>
          {/* Get Started Button */}
          <button onClick={() => onNavigate('signup')} className="get-started-btn mt-6 group">
            <span className="btn-content">
              <span>Get Started for Free</span>
              <Sparkles className="w-3.5 h-3.5 btn-icon" />
            </span>
          </button>
        </div>

        {/* Center Column - 3D Image */}
        <div 
          className={`w-full lg:w-1/3 flex items-center justify-center transition-all duration-1000 delay-300 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="relative w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
            <img 
              src="/hero-3d.png" 
              alt="KUMO-AI 3D"
              className="w-full h-auto animate-float"
            />
          </div>
        </div>

        {/* Right Column - Widget Card */}
        <div 
          className={`w-full lg:w-1/3 flex justify-center lg:justify-end transition-all duration-1000 delay-500 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}
        >
          <div className="feature-widget">
            <div className="feature-widget-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#7dd3c0]">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-2">
              <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="text-xs text-white/40 mt-3">
              <span className="text-white/60">01</span> / 8K ULTRA-VISION
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      title: 'WhatsApp-First',
      description: 'No apps to download. Teachers, parents, and admins use WhatsApp they already know.',
      icon: Smartphone,
    },
    {
      title: 'AI-Powered',
      description: 'Snap photos of mark sheets. Our AI extracts and validates data automatically.',
      icon: Brain,
    },
    {
      title: 'Instant Reports',
      description: 'Generate beautiful report cards and broadsheets with one click.',
      icon: FileText,
    },
  ];

  return (
    <section 
      id="features"
      ref={sectionRef}
      className="py-24 bg-[#4a4f55]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div 
          className={`mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow">Capabilities</p>
          <div className="section-header-pill">
            <div className="header-icon-container">
              <Rocket className="w-4 h-4 text-black header-icon" />
            </div>
            <h2 className="section-headline">Everything you need.</h2>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={index}
                className={`floating-card transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${200 + index * 150}ms` }}
              >
                <div className="feature-card-icon">
                  <IconComponent className="w-6 h-6 text-[#7dd3c0]" />
                </div>
                <h3 className="text-white font-medium text-lg mb-3">{feature.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps = [
    { num: '01', title: 'Setup', desc: 'Configure your school in minutes' },
    { num: '02', title: 'Invite', desc: 'Send tokens to teachers & parents' },
    { num: '03', title: 'Submit', desc: 'Teachers enter marks via WhatsApp' },
    { num: '04', title: 'Report', desc: 'Generate and share instantly' },
  ];

  return (
    <section 
      id="how-it-works"
      ref={sectionRef}
      className="py-24 bg-[#3a3f45]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div
          className={`mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow">The Experience</p>
          <div className="section-header-pill">
            <div className="header-icon-container">
              <Layers className="w-4 h-4 text-black header-icon" />
            </div>
            <h2 className="section-headline">How it works.</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`floating-card transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${200 + index * 100}ms` }}
            >
              <span className="text-3xl font-light text-white/20">{step.num}</span>
              <h3 className="text-white font-medium mt-4 mb-2">{step.title}</h3>
              <p className="text-white/50 text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Vision & Mission Section - Modern Grid Layout
function VisionMissionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const pillars = [
    {
      icon: Target,
      title: 'Our Mission',
      description: 'Eliminate administrative burden from African schools, empowering teachers to focus on educating the next generation.',
      stat: '500+',
      statLabel: 'Schools'
    },
    {
      icon: Heart,
      title: 'Our Vision',
      description: 'A future where every African school operates at peak efficiency and education technology serves people first.',
      stat: '1M+',
      statLabel: 'Students'
    },
    {
      icon: Globe,
      title: 'Our Reach',
      description: 'From Lagos to Nairobi, Accra to Johannesburg. Serving schools across 12 African countries with world-class standards.',
      stat: '12',
      statLabel: 'Countries'
    },
    {
      icon: Zap,
      title: 'Our Innovation',
      description: 'AI-powered solutions that work offline, work simply, and work for everyone via WhatsApp.',
      stat: '99%',
      statLabel: 'Accuracy'
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="vision"
      ref={sectionRef}
      className="relative min-h-screen bg-[#000000] overflow-hidden"
    >
      {/* Background Text */}
      <div className="bg-text-blur-gold">PURPOSE</div>

      {/* Main Content */}
      <div className="relative z-30 min-h-screen flex flex-col justify-center px-6 lg:px-12 py-24">
        
        {/* Top Section - Hero Style Text */}
        <div 
          className={`mb-16 lg:mb-24 transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow-gold">Why We Exist</p>
          <h2 className="headline-vision text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight max-w-4xl">
            Built for educators.<br />
            <span className="text-[#ffd700]">Powered by purpose.</span>
          </h2>
          <p className="description-vision mt-6 text-white/60 text-lg max-w-2xl">
            We're not just building software. We're fighting against the hours teachers lose to paperwork—the time that should be spent shaping young minds.
          </p>
        </div>

        {/* Top Gradient Blend */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#3a3f45] to-transparent z-20 pointer-events-none" />

        {/* Pillars Grid - Mobile First 2x2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 max-w-5xl mx-auto">
          {pillars.map((pillar, index) => {
            const IconComponent = pillar.icon;
            return (
              <div
                key={index}
                className={`vision-pillar-card transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                {/* Icon */}
                <div className="pillar-icon-wrapper">
                  <IconComponent className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </div>
                
                {/* Content */}
                <h3 className="text-white font-medium text-base mb-1.5">{pillar.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed mb-3 flex-grow">{pillar.description}</p>
                
                {/* Stat */}
                <div className="pt-3 border-t border-white/5">
                  <span className="text-xl font-semibold text-[#ffd700]">{pillar.stat}</span>
                  <span className="text-white/30 text-xs ml-1.5">{pillar.statLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div 
          className={`mt-16 text-center transition-all duration-1000 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-white/40 text-sm mb-4">Join the movement</p>
          <button className="get-started-btn-gold">
            <span className="btn-content">
              <span>Start Your Journey</span>
              <Sparkles className="w-3.5 h-3.5 btn-icon-gold" />
            </span>
          </button>
        </div>

        {/* Bottom Gradient Blend */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#4a4f55] to-transparent z-20 pointer-events-none" />
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const plans = [
    { 
      name: 'Free', 
      price: '$0', 
      period: '/term', 
      icon: 'Gift',
      color: 'from-[#ffd700]/20 via-[#ffed4e]/10 to-transparent',
      features: ['1 class', '1 teacher', 'Unlimited parents', '1 academic term (3 months)'],
      description: 'Try before you buy'
    },
    { 
      name: 'Starter', 
      price: '$49', 
      period: '/mo', 
      icon: 'Zap',
      color: 'from-[#ffd700]/20 via-[#ffed4e]/10 to-transparent',
      features: ['200 students', '1 school', 'Basic reports', 'WhatsApp support'],
      description: 'Perfect for small schools'
    },
    { 
      name: 'Professional', 
      price: '$99', 
      period: '/mo', 
      icon: 'Rocket',
      color: 'from-[#7dd3c0]/20 via-[#5fb3a0]/10 to-transparent',
      popular: true,
      features: ['1,000 students', '3 schools', 'Analytics', 'API access', 'Priority support'],
      description: 'Best for growing schools'
    },
    { 
      name: 'Enterprise', 
      price: 'Custom', 
      period: '', 
      icon: 'Building',
      color: 'from-[#ffd700]/30 via-[#7dd3c0]/20 to-transparent',
      features: ['Unlimited students', 'Unlimited schools', 'Custom integrations', 'Dedicated manager'],
      description: 'For large institutions'
    },
  ];

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'Gift': return <Gift className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'Rocket': return <Rocket className="w-5 h-5" />;
      case 'Building': return <Building className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  return (
    <section 
      id="pricing"
      ref={sectionRef}
      className="py-24 bg-[#4a4f55] relative overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#ffd700]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#7dd3c0]/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#ffd700]/10 via-transparent to-[#7dd3c0]/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
        <div
          className={`mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow">Pricing</p>
          <div className="section-header-pill">
            <div className="header-icon-container">
              <CreditCard className="w-4 h-4 text-black header-icon" />
            </div>
            <h2 className="section-headline">Simple & transparent.</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`premium-pricing-card group ${plan.popular ? 'popular' : ''} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
              style={{ transitionDelay: `${200 + index * 150}ms` }}
            >
              {/* Blurry Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl`} />
              
              {/* Card Content */}
              <div className="relative z-10 p-5 h-full flex flex-col">
                {/* Icon & Popular Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.popular || index === 0 ? 'bg-[#ffd700] text-black' : 'bg-white/10 text-white'} pricing-icon-3d`}>
                    {getIcon(plan.icon)}
                  </div>
                  {plan.popular && (
                    <span className="px-2 py-0.5 bg-[#ffd700] text-black text-[10px] font-bold rounded-full">
                      Popular
                    </span>
                  )}
                  {index === 0 && !plan.popular && (
                    <span className="px-2 py-0.5 bg-[#ffd700] text-black text-[10px] font-bold rounded-full">
                      Free
                    </span>
                  )}
                </div>

                {/* Plan Name */}
                <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
                <p className="text-white/50 text-xs mb-3">{plan.description}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-white pricing-price-glow">{plan.price}</span>
                  <span className="text-white/40 text-sm">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature, fi) => (
                    <li key={fi} className="text-white/70 text-xs flex items-center gap-2">
                       <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular || index === 0 ? 'bg-[#ffd700]/20' : 'bg-white/10'}`}>
                        <Check className="w-2.5 h-2.5 text-[#7dd3c0]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button className={`w-full mt-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 ${plan.popular || index === 0 ? 'bg-[#ffd700] text-black hover:bg-[#ffed4e]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {index === 0 ? 'Start Free' : 'Get Started'}
                </button>
              </div>

              {/* 3D Dark Academic Element */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 opacity-0 group-hover:opacity-100 transition-all duration-500 pricing-3d-element">
                <div className="w-full h-full bg-gradient-to-br from-black/40 to-black/20 rounded-full blur-sm flex items-center justify-center">
                  <GraduationCap className="w-10 h-10 text-white/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="py-24 bg-[#3a3f45]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
        <div 
          className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="eyebrow">Get Started</p>
          <div className="section-header-pill mb-6">
            <div className="header-icon-container">
              <Play className="w-4 h-4 text-black header-icon" />
            </div>
            <h2 className="section-headline">Ready to transform your school?</h2>
          </div>
          <p className="text-white/60 mb-8 max-w-md mx-auto">
            Join 500+ schools across Africa using KUMO-AI to simplify academic management.
          </p>
          <button className="cta-pill mx-auto">
            <span className="cta-pill-icon">
              <MessageCircle className="w-3.5 h-3.5" />
            </span>
            <span>Start Free Trial</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// Signup Page - 2 Step Wizard
function SignupPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'dashboard') => void }) {
  const { signup, clearError } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: 'SECONDARY' as 'PRIMARY' | 'SECONDARY' | 'BOTH',
    email: '',
    adminPhone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);
    clearError();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setSignupError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setSignupError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      await signup({
        schoolName: formData.schoolName,
        schoolType: formData.schoolType,
        adminPhone: formData.adminPhone,
        email: formData.email || undefined,
        password: formData.password
      });
      console.log('[Signup] Success, navigating to dashboard...');
      // Small delay to ensure auth state is updated
      setTimeout(() => {
        onNavigate('dashboard');
      }, 100);
    } catch (err: any) {
      console.error('[Signup] Error caught:', err);
      const errorMessage = err?.message || err?.toString() || 'Signup failed';
      setSignupError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const nextStep = () => {
    if (currentStep === 1 && formData.schoolName && formData.adminPhone) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* KUMO-AI Background Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#ffd700]/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#ffd700]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home */}
        <button onClick={() => onNavigate('landing')} className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-all ${
              currentStep === 1 ? 'bg-[#ffd700] text-black' : 'bg-white/10 text-white'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 rounded-full transition-all ${
              currentStep === 2 ? 'bg-[#ffd700]' : 'bg-white/10'
            }`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-all ${
              currentStep === 2 ? 'bg-[#ffd700] text-black' : 'bg-white/10 text-white/50'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-lg">
              <School className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {currentStep === 1 ? 'School Information' : 'Create Password'}
            </h1>
            <p className="text-white/50 text-sm">
              {currentStep === 1 ? 'Step 1 of 2: Tell us about your school' : 'Step 2 of 2: Secure your account'}
            </p>
          </div>

          {/* Error Display */}
          {signupError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm text-center">{signupError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {currentStep === 1 ? (
              <>
                {/* School Name */}
                <div className="space-y-1.5">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <School className="w-4 h-4" />
                    School Name
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type="text"
                      name="schoolName"
                      value={formData.schoolName}
                      onChange={handleChange}
                      placeholder="Enter your school name"
                      className="auth-input"
                      required
                    />
                  </div>
                </div>

                {/* School Type */}
                <div className="space-y-1.5">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    School Type
                  </label>
                  <div className="auth-input-wrapper">
                    <select
                      name="schoolType"
                      value={formData.schoolType}
                      onChange={(e) => setFormData({ ...formData, schoolType: e.target.value as 'PRIMARY' | 'SECONDARY' | 'BOTH' })}
                      className="auth-input bg-transparent"
                      required
                    >
                      <option value="SECONDARY">Secondary School (JSS 1 - SS 3)</option>
                      <option value="PRIMARY">Primary School (Primary 1-6)</option>
                      <option value="BOTH">Both Primary & Secondary</option>
                    </select>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email <span className="text-white/30 text-xs">(optional)</span>
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="school@example.com"
                      className="auth-input"
                    />
                  </div>
                </div>

                {/* Admin WhatsApp Number */}
                <PhoneInput
                  value={formData.adminPhone}
                  onChange={(fullNumber) => setFormData({ ...formData, adminPhone: fullNumber })}
                  placeholder="Enter phone number"
                  label="Admin WhatsApp Number"
                  required
                />
                <p className="text-white/30 text-xs -mt-2">Used for login and password recovery</p>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.schoolName || !formData.adminPhone}
                  className="auth-submit-btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a strong password"
                      className="auth-input pr-12"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Confirm Password
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      className="auth-input pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  {/* Back Button */}
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 py-3 px-4 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-all"
                  >
                    Back
                  </button>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !formData.password || formData.password !== formData.confirmPassword}
                    className="flex-[2] auth-submit-btn disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Login Link */}
          <p className="text-center text-white/50 text-sm">
            Already have an account?{' '}
            <button onClick={() => onNavigate('login')} className="text-[#ffd700] hover:text-[#ffed4e] font-medium transition-colors">
              Sign in
            </button>
          </p>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-white/30 text-xs">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Secure SSL
          </span>
          <span className="flex items-center gap-1.5">
            <School className="w-3.5 h-3.5" />
            500+ Schools
          </span>
        </div>
      </div>
    </div>
  );
}

// Login Page
function LoginPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'dashboard') => void }) {
  const { login, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);
    clearError();

    try {
      await login(formData.phone, formData.password);
      console.log('[Login] Success, navigating to dashboard...');
      // Small delay to ensure auth state is updated
      setTimeout(() => {
        onNavigate('dashboard');
      }, 100);
    } catch (err: any) {
      console.error('[Login] Error caught:', err);
      setLoginError(err?.message || error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    alert('Recovery code sent to your WhatsApp! (Frontend demo)');
    setShowRecovery(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (showRecovery) {
    return (
      <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>

        {/* Animated Background Elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-[#ffd700]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-[#ffd700]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />

        <div className="relative z-10 w-full max-w-md">
          <button
            onClick={() => setShowRecovery(false)}
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>

          <div className="auth-card backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#ffd700]/10 flex items-center justify-center mx-auto mb-4 border border-[#ffd700]/20 shadow-lg">
                <Phone className="w-8 h-8 text-[#ffd700]" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Password Recovery</h1>
              <p className="text-white/50 text-sm">Enter your registered WhatsApp number</p>
            </div>

            <form onSubmit={handleRecovery} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  WhatsApp Number
                </label>
                <div className="auth-input-wrapper">
                  <span className="absolute left-4 text-white/40 text-sm">+</span>
                  <input
                    type="tel"
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(e.target.value)}
                    placeholder="234 123 456 7890"
                    className="auth-input pl-8"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="auth-submit-btn"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Recovery Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#4a4f55] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* KUMO-AI Background Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#ffd700]/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#ffd700]/3 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />

      <div className="relative z-10 w-full max-w-md">
        {/* Back to Home */}
        <button onClick={() => onNavigate('landing')} className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        {/* Card */}
        <div className="auth-card backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-white/50 text-sm">Sign in to manage your school</p>
          </div>

          {/* Error Display */}
          {loginError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm text-center">{loginError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone Number */}
            <PhoneInput
              value={formData.phone}
              onChange={(fullNumber) => setFormData({ ...formData, phone: fullNumber })}
              placeholder="Enter phone number"
              label="WhatsApp Number"
              required
            />

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-white/70 text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="auth-input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-[#ffd700] hover:text-[#ffed4e] text-sm font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="auth-submit-btn"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Signup Link */}
          <p className="text-center text-white/50 text-sm">
            Don't have an account?{' '}
            <button onClick={() => onNavigate('signup')} className="text-[#ffd700] hover:text-[#ffed4e] font-medium transition-colors">
              Create one
            </button>
          </p>
        </div>


        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-white/30 text-xs">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Secure SSL
          </span>
          <span className="flex items-center gap-1.5">
            <School className="w-3.5 h-3.5" />
            500+ Schools
          </span>
        </div>
      </div>
    </div>
  );
}

// Footer
function Footer() {
  return (
    <footer className="relative bg-[#2a2f35] overflow-hidden">
      {/* Top decorative line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center border border-white/10">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-xl tracking-wide">KUMO-AI</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-xs">
              Academic management powered by WhatsApp and AI. No apps. No complexity. Just results.
            </p>
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a href="#" className="footer-social-icon">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="footer-social-icon">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="footer-social-icon">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="footer-social-icon">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-white/50" />
              Quick Links
            </h4>
            <ul className="space-y-3">
              <li><a href="#features" className="footer-link">Features</a></li>
              <li><a href="#how-it-works" className="footer-link">How it Works</a></li>
              <li><a href="#vision" className="footer-link">Our Mission</a></li>
              <li><a href="#pricing" className="footer-link">Pricing</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/50" />
              Resources
            </h4>
            <ul className="space-y-3">
              <li><a href="#" className="footer-link">Documentation</a></li>
              <li><a href="#" className="footer-link">Help Center</a></li>
              <li><a href="#" className="footer-link">API Reference</a></li>
              <li><a href="#" className="footer-link">Status</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-white/50" />
              Contact
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-white/40 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/30" />
                <span>Lagos, Nigeria<br />Nairobi, Kenya</span>
              </li>
              <li>
                <a href="mailto:hello@teecha-ai.com" className="footer-link flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  hello@teecha-ai.com
                </a>
              </li>
              <li>
                <a href="tel:+2341234567890" className="footer-link flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  +234 123 456 7890
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mb-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © 2024 KUMO-AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Terms of Service</a>
            <a href="#" className="text-white/30 text-xs hover:text-white/60 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Contact Page
function ContactPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    alert('Message sent! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-[#4a4f55]">
      <PublicNav onNavigate={onNavigate} currentPage="contact" />
      
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-6 overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>
        <div className="bg-text-blur">REACH</div>
        <div className="relative z-10 text-center max-w-4xl mx-auto pt-24">
          <p className="eyebrow mb-4">Get In Touch</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Let's <span className="text-[#ffd700]">Connect</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Have questions? We're here to help. Reach out and our team will respond within 24 hours.
          </p>
        </div>
        
        {/* Floating 3D Element */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:block">
          <div className="w-64 h-64 animate-float opacity-30">
            <div className="w-full h-full bg-gradient-to-br from-[#ffd700]/20 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12">
          {/* Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-white/70 text-sm mb-2">Your Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none transition-colors" required />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">Subject</label>
                <select value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none transition-colors" required>
                  <option value="" className="bg-[#4a4f55]">Select a topic</option>
                  <option value="sales" className="bg-[#4a4f55]">Sales Inquiry</option>
                  <option value="support" className="bg-[#4a4f55]">Technical Support</option>
                  <option value="partnership" className="bg-[#4a4f55]">Partnership</option>
                  <option value="other" className="bg-[#4a4f55]">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">Message</label>
                <textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} rows={5} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none transition-colors resize-none" required />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#000000] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-black/80 transition-all">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Send Message</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Contact Information</h3>
              <p className="text-white/60 mb-6">Our team is available Monday to Friday, 9 AM - 6 PM WAT.</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Email Us</h4>
                  <p className="text-white/60 text-sm mb-1">For general inquiries:</p>
                  <a href="mailto:hello@teecha-ai.com" className="text-[#ffd700] hover:underline">hello@teecha-ai.com</a>
                  <p className="text-white/60 text-sm mt-2 mb-1">For support:</p>
                  <a href="mailto:support@teecha-ai.com" className="text-[#ffd700] hover:underline">support@teecha-ai.com</a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Call Us</h4>
                  <p className="text-white/60 text-sm mb-1">Nigeria:</p>
                  <a href="tel:+2341234567890" className="text-[#ffd700] hover:underline">+234 123 456 7890</a>
                  <p className="text-white/60 text-sm mt-2 mb-1">Kenya:</p>
                  <a href="tel:+254123456789" className="text-[#ffd700] hover:underline">+254 123 456 789</a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Visit Us</h4>
                  <p className="text-white/60 text-sm">Lagos Office:<br />123 Innovation Hub,<br />Victoria Island, Lagos</p>
                  <p className="text-white/60 text-sm mt-3">Nairobi Office:<br />456 Tech Plaza,<br />Westlands, Nairobi</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-20 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-[#ffd700] mx-auto mb-4" />
              <p className="text-white/60">Interactive Map Coming Soon</p>
            </div>
          </div>
        </div>
      </section>

      <SimpleFooter onNavigate={onNavigate} />
    </div>
  );
}

// Documentation Page
function DocumentationPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: Rocket },
    { id: 'setup', title: 'School Setup', icon: School },
    { id: 'users', title: 'User Management', icon: User },
    { id: 'marks', title: 'Entering Marks', icon: FileText },
    { id: 'reports', title: 'Generating Reports', icon: Layers },
    { id: 'whatsapp', title: 'WhatsApp Integration', icon: MessageCircle },
    { id: 'api', title: 'API Reference', icon: Zap },
  ];

  const docsContent: Record<string, { title: string; content: React.ReactNode }> = {
    'getting-started': {
      title: 'Getting Started with KUMO-AI',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">Welcome to KUMO-AI! This guide will help you set up your school and start managing academic records efficiently.</p>
          <h3 className="text-xl font-bold text-white mt-6">What is KUMO-AI?</h3>
          <p className="text-white/70">KUMO-AI is a WhatsApp-first academic management platform designed specifically for African schools. It allows teachers to submit marks, generate reports, and communicate with parents—all through WhatsApp.</p>
          <h3 className="text-xl font-bold text-white mt-6">Key Features</h3>
          <ul className="space-y-2 text-white/70 list-disc list-inside">
            <li>WhatsApp-based mark submission</li>
            <li>AI-powered mark sheet scanning</li>
            <li>Automatic report generation</li>
            <li>Parent communication</li>
            <li>Multi-tenant architecture</li>
          </ul>
          <h3 className="text-xl font-bold text-white mt-6">Quick Start</h3>
          <ol className="space-y-2 text-white/70 list-decimal list-inside">
            <li>Sign up for a KUMO-AI account</li>
            <li>Complete school setup</li>
            <li>Add teachers and students</li>
            <li>Start submitting marks via WhatsApp</li>
            <li>Generate and share reports</li>
          </ol>
        </div>
      )
    },
    'setup': {
      title: 'School Setup Guide',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">Setting up your school in KUMO-AI is a straightforward process. Follow these steps to get started.</p>
          <h3 className="text-xl font-bold text-white mt-6">Step 1: Basic Information</h3>
          <p className="text-white/70">Enter your school name, type (Primary/Secondary), and contact information.</p>
          <h3 className="text-xl font-bold text-white mt-6">Step 2: Grading Configuration</h3>
          <p className="text-white/70">Configure your assessment pillars. For example: CA1 (10%), CA2 (10%), Midterm (20%), Exam (60%).</p>
          <h3 className="text-xl font-bold text-white mt-6">Step 3: Academic Terms</h3>
          <p className="text-white/70">Set up your academic calendar with term dates and holidays.</p>
          <h3 className="text-xl font-bold text-white mt-6">Step 4: Connect WhatsApp</h3>
          <p className="text-white/70">Link your school's WhatsApp number for automated notifications and mark submissions.</p>
        </div>
      )
    },
    'users': {
      title: 'User Management',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">KUMO-AI supports three user roles: Administrators, Teachers, and Parents.</p>
          <h3 className="text-xl font-bold text-white mt-6">Administrators</h3>
          <p className="text-white/70">Full access to all features. Can manage school settings, users, and generate all reports.</p>
          <h3 className="text-xl font-bold text-white mt-6">Teachers</h3>
          <p className="text-white/70">Can submit marks for their assigned subjects and classes. Can view their students' performance.</p>
          <h3 className="text-xl font-bold text-white mt-6">Parents</h3>
          <p className="text-white/70">View-only access to their children's results and reports. Receive automated updates via WhatsApp.</p>
          <h3 className="text-xl font-bold text-white mt-6">Adding Users</h3>
          <p className="text-white/70">Users can be added individually or imported via CSV. Each user receives access credentials via SMS or email.</p>
        </div>
      )
    },
    'marks': {
      title: 'Entering Marks',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">KUMO-AI offers multiple ways to enter marks, with WhatsApp being the primary method.</p>
          <h3 className="text-xl font-bold text-white mt-6">Method 1: WhatsApp Photo</h3>
          <p className="text-white/70">Teachers can photograph their mark sheets and send them via WhatsApp. Our AI extracts the data automatically.</p>
          <h3 className="text-xl font-bold text-white mt-6">Method 2: Web Interface</h3>
          <p className="text-white/70">Enter marks directly through the web dashboard for quick updates.</p>
          <h3 className="text-xl font-bold text-white mt-6">Method 3: CSV Import</h3>
          <p className="text-white/70">Bulk import marks using our CSV template for large datasets.</p>
          <h3 className="text-xl font-bold text-white mt-6">Validation</h3>
          <p className="text-white/70">All marks go through automatic validation to ensure accuracy and completeness.</p>
        </div>
      )
    },
    'reports': {
      title: 'Generating Reports',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">Generate professional report cards and broadsheets with one click.</p>
          <h3 className="text-xl font-bold text-white mt-6">Report Types</h3>
          <ul className="space-y-2 text-white/70 list-disc list-inside">
            <li><strong>Individual Report Cards:</strong> Comprehensive student performance reports</li>
            <li><strong>Class Broadsheets:</strong> Class-wide mark summaries</li>
            <li><strong>Subject Analysis:</strong> Performance breakdown by subject</li>
            <li><strong>Progress Reports:</strong> Track student improvement over time</li>
          </ul>
          <h3 className="text-xl font-bold text-white mt-6">Customization</h3>
          <p className="text-white/70">Add your school logo, customize headers, and include teacher remarks.</p>
          <h3 className="text-xl font-bold text-white mt-6">Distribution</h3>
          <p className="text-white/70">Reports can be downloaded as PDFs or automatically sent to parents via WhatsApp.</p>
        </div>
      )
    },
    'whatsapp': {
      title: 'WhatsApp Integration',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">KUMO-AI leverages WhatsApp as its primary interface for teachers and parents.</p>
          <h3 className="text-xl font-bold text-white mt-6">Setup Process</h3>
          <ol className="space-y-2 text-white/70 list-decimal list-inside">
            <li>Register your school's WhatsApp Business number</li>
            <li>Connect it to KUMO-AI in the settings</li>
            <li>Verify the connection with a test message</li>
            <li>Share the WhatsApp number with teachers and parents</li>
          </ol>
          <h3 className="text-xl font-bold text-white mt-6">Supported Actions</h3>
          <ul className="space-y-2 text-white/70 list-disc list-inside">
            <li>Submit marks via photo</li>
            <li>Request reports</li>
            <li>Check student results</li>
            <li>Receive automated notifications</li>
            <li>Mark attendance</li>
          </ul>
          <h3 className="text-xl font-bold text-white mt-6">Commands</h3>
          <p className="text-white/70">Teachers and parents can use simple text commands like "RESULTS", "ATTENDANCE", or "HELP" to interact with the system.</p>
        </div>
      )
    },
    'api': {
      title: 'API Reference',
      content: (
        <div className="space-y-6">
          <p className="text-white/70">KUMO-AI provides a RESTful API for integrating with other systems.</p>
          <h3 className="text-xl font-bold text-white mt-6">Authentication</h3>
          <p className="text-white/70">All API requests require an API key passed in the header: <code className="bg-white/10 px-2 py-1 rounded text-[#ffd700]">X-API-Key: your_key_here</code></p>
          <h3 className="text-xl font-bold text-white mt-6">Endpoints</h3>
          <div className="space-y-3">
            <div className="bg-black/30 p-4 rounded-lg border border-white/10">
              <p className="text-[#ffd700] font-mono text-sm">GET /api/v1/students</p>
              <p className="text-white/60 text-sm mt-1">Retrieve all students for your school</p>
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-white/10">
              <p className="text-[#ffd700] font-mono text-sm">POST /api/v1/marks</p>
              <p className="text-white/60 text-sm mt-1">Submit marks for a student</p>
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-white/10">
              <p className="text-[#ffd700] font-mono text-sm">GET /api/v1/reports/:studentId</p>
              <p className="text-white/60 text-sm mt-1">Generate a report for a specific student</p>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mt-6">Rate Limits</h3>
          <p className="text-white/70">Standard plans: 100 requests/minute. Enterprise plans: 500 requests/minute.</p>
        </div>
      )
    }
  };

  const ActiveIcon = sections.find(s => s.id === activeSection)?.icon || Rocket;

  return (
    <div className="min-h-screen bg-[#4a4f55]">
      <PublicNav onNavigate={onNavigate} currentPage="docs" />
      
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex items-center justify-center px-6 overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>
        <div className="bg-text-blur">DOCS</div>
        <div className="relative z-10 text-center max-w-4xl mx-auto pt-24">
          <p className="eyebrow mb-4">Documentation</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Learn & <span className="text-[#ffd700]">Master</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Everything you need to know about using KUMO-AI effectively.
          </p>
        </div>
        
        <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden lg:block">
          <div className="w-48 h-48 animate-float opacity-20" style={{animationDelay: '1s'}}>
            <div className="w-full h-full bg-gradient-to-tr from-[#ffd700]/30 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Docs Content */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sticky top-24">
              <h3 className="text-white font-semibold mb-4 px-2">Contents</h3>
              <nav className="space-y-1">
                {sections.map(section => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        activeSection === section.id 
                          ? 'bg-[#ffd700] text-black' 
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center">
                  <ActiveIcon className="w-6 h-6 text-black" />
                </div>
                <h2 className="text-3xl font-bold text-white">{docsContent[activeSection].title}</h2>
              </div>
              <div className="prose prose-invert max-w-none">
                {docsContent[activeSection].content}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SimpleFooter onNavigate={onNavigate} />
    </div>
  );
}

// FAQs Page
function FAQsPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is KUMO-AI and how does it work?",
      answer: "KUMO-AI is a WhatsApp-first academic management platform designed for African schools. Teachers can submit marks by photographing mark sheets and sending them via WhatsApp. Our AI extracts the data automatically, validates it, and generates reports. Parents receive results directly on WhatsApp."
    },
    {
      question: "Do I need to download any apps?",
      answer: "No! KUMO-AI works entirely through WhatsApp, which most teachers and parents already have. There's no need to learn new software or remember additional passwords. Simply use WhatsApp as you normally would."
    },
    {
      question: "How accurate is the AI mark extraction?",
      answer: "Our AI has a 99% accuracy rate for clearly written mark sheets. For best results, ensure good lighting and clear handwriting. You can also review and edit extracted marks before finalizing."
    },
    {
      question: "Can I use KUMO-AI for multiple schools?",
      answer: "Yes! KUMO-AI supports multi-tenancy. If you're a school group or education consultant managing multiple schools, you can access all of them from a single dashboard. Contact us for group pricing."
    },
    {
      question: "What happens if I lose internet connection?",
      answer: "No problem! Photos taken offline are queued and processed automatically when connectivity returns. This is especially useful in areas with intermittent internet."
    },
    {
      question: "How secure is my school's data?",
      answer: "Very secure. We use industry-standard encryption for all data in transit and at rest. Each school has isolated data storage. We comply with GDPR and local data protection regulations."
    },
    {
      question: "Can parents see other students' results?",
      answer: "No. Parents only have access to their own children's data. Access is controlled through unique access tokens sent via WhatsApp. Each parent can only view results for students they're authorized to see."
    },
    {
      question: "What grading systems do you support?",
      answer: "KUMO-AI is fully customizable. You can configure any grading pillars (CA1, CA2, Midterm, Exam, etc.) with custom weightings. We support percentage, letter grades, and GPA systems."
    },
    {
      question: "How long does it take to set up KUMO-AI?",
      answer: "Most schools are fully operational within 30 minutes. The process involves: 1) Creating your account, 2) Configuring grading pillars, 3) Adding teachers and students, 4) Connecting WhatsApp."
    },
    {
      question: "What support options are available?",
      answer: "We offer multiple support channels: WhatsApp support (fastest), email support, documentation, and video tutorials. Enterprise plans include dedicated account managers and priority support."
    },
    {
      question: "Can I export my data?",
      answer: "Yes. You can export all data including student records, marks, and reports in multiple formats (PDF, Excel, CSV). Your data belongs to you."
    },
    {
      question: "Is there a free trial?",
      answer: "Yes! We offer a 14-day free trial with full access to all features. No credit card required. At the end of the trial, you can choose a plan that fits your needs."
    }
  ];

  return (
    <div className="min-h-screen bg-[#4a4f55]">
      <PublicNav onNavigate={onNavigate} currentPage="faqs" />
      
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex items-center justify-center px-6 overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>
        <div className="bg-text-blur">FAQS</div>
        <div className="relative z-10 text-center max-w-4xl mx-auto pt-24">
          <p className="eyebrow mb-4">Support</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Common <span className="text-[#ffd700]">Questions</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Find answers to frequently asked questions about KUMO-AI.
          </p>
        </div>
        
        <div className="absolute right-20 bottom-20 hidden lg:block">
          <div className="w-40 h-40 animate-float opacity-20" style={{animationDelay: '0.5s'}}>
            <div className="w-full h-full bg-gradient-to-bl from-[#ffd700]/40 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* FAQs Content */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-white font-medium pr-8">{faq.question}</span>
                  <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}>
                    <ChevronRight className="w-5 h-5 text-white/60 rotate-90" />
                  </div>
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-96' : 'max-h-0'}`}
                >
                  <div className="px-6 pb-6 text-white/60 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-16 text-center">
            <p className="text-white/60 mb-4">Still have questions?</p>
            <button onClick={() => onNavigate('contact')} className="inline-flex items-center gap-2 bg-[#000000] text-white px-6 py-3 rounded-full font-medium hover:bg-black/80 transition-all">
              <Mail className="w-4 h-4" />
              Contact Support
            </button>
          </div>
        </div>
      </section>

      <SimpleFooter onNavigate={onNavigate} />
    </div>
  );
}

// Detailed Features Page
function FeaturesPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const features = [
    {
      icon: Smartphone,
      title: "WhatsApp-First Design",
      description: "No apps to download or learn. Teachers and parents use WhatsApp they already know and trust. Send marks by simply photographing mark sheets and sending them via WhatsApp.",
      benefits: ["Zero learning curve", "Works on any phone", "No internet? No problem", "Automatic synchronization"]
    },
    {
      icon: Brain,
      title: "AI-Powered Recognition",
      description: "Our advanced AI automatically extracts marks from photographed sheets with 99% accuracy. It recognizes handwriting, validates entries, and flags inconsistencies.",
      benefits: ["99% accuracy rate", "Handles handwriting", "Gap detection", "Auto-validation"]
    },
    {
      icon: FileText,
      title: "Instant Report Generation",
      description: "Generate beautiful, professional report cards and broadsheets with one click. Customize with your school logo, colors, and specific formatting requirements.",
      benefits: ["One-click generation", "Custom branding", "Multiple formats", "Bulk generation"]
    },
    {
      icon: Target,
      title: "Comprehensive Analytics",
      description: "Track student performance, identify trends, and make data-driven decisions. Get insights into class performance, subject mastery, and student progress over time.",
      benefits: ["Performance tracking", "Trend analysis", "Predictive insights", "Export reports"]
    },
    {
      icon: Globe,
      title: "Built for Africa",
      description: "Designed specifically for African schools with offline-first architecture, support for local grading systems, and integration with popular African payment methods.",
      benefits: ["Offline capability", "Local currencies", "Multi-language support", "Data sovereignty"]
    },
    {
      icon: Zap,
      title: "Lightning Fast Setup",
      description: "Get your school operational in under 30 minutes. Simple onboarding process with guided setup and dedicated support to ensure smooth adoption.",
      benefits: ["30-minute setup", "Guided onboarding", "Training included", "24/7 support"]
    }
  ];

  const workflowSteps = [
    { step: 1, title: "Setup", desc: "Configure your school in minutes with our guided setup wizard" },
    { step: 2, title: "Invite", desc: "Send access tokens to teachers and parents via WhatsApp" },
    { step: 3, title: "Submit", desc: "Teachers submit marks by photographing mark sheets" },
    { step: 4, title: "Process", desc: "AI extracts and validates marks automatically" },
    { step: 5, title: "Review", desc: "Administrators review and approve mark entries" },
    { step: 6, title: "Report", desc: "Generate and distribute reports automatically" }
  ];

  return (
    <div className="min-h-screen bg-[#4a4f55]">
      <PublicNav onNavigate={onNavigate} currentPage="features" />
      
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-6 overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>
        <div className="bg-text-blur">POWER</div>
        <div className="relative z-10 text-center max-w-5xl mx-auto pt-24">
          <p className="eyebrow mb-4">Features</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Everything You <span className="text-[#ffd700]">Need</span>
          </h1>
          <p className="text-white/60 text-xl max-w-3xl mx-auto mb-10">
            Powerful features designed to eliminate paperwork and streamline academic management for African schools.
          </p>
          <button onClick={() => onNavigate('signup')} className="inline-flex items-center gap-2 bg-[#000000] text-white px-8 py-4 rounded-full font-semibold hover:bg-black/80 transition-all">
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="absolute left-10 bottom-20 hidden lg:block">
          <div className="w-56 h-56 animate-float opacity-20">
            <div className="w-full h-full bg-gradient-to-tr from-[#ffd700]/30 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
        <div className="absolute right-10 top-40 hidden lg:block">
          <div className="w-48 h-48 animate-float opacity-20" style={{animationDelay: '1.5s'}}>
            <div className="w-full h-full bg-gradient-to-bl from-[#ffd700]/20 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] hover:border-white/20 transition-all group">
                  <div className="w-14 h-14 bg-[#ffd700] rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-black" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-white/60 mb-6 leading-relaxed">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-white/50 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700]" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">How It Works</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white">Simple 6-Step Process</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflowSteps.map((item, index) => (
              <div key={index} className="relative bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#ffd700] rounded-xl flex items-center justify-center font-bold text-black text-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 mt-2">{item.title}</h3>
                <p className="text-white/50 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to Transform Your School?</h2>
          <p className="text-white/60 text-lg mb-8">Join 500+ schools already using KUMO-AI to simplify academic management.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => onNavigate('signup')} className="w-full sm:w-auto bg-[#ffd700] text-black px-8 py-4 rounded-full font-semibold hover:bg-[#ffed4e] transition-all">
              Start Free Trial
            </button>
            <button onClick={() => onNavigate('contact')} className="w-full sm:w-auto bg-white/10 text-white border border-white/20 px-8 py-4 rounded-full font-semibold hover:bg-white/20 transition-all">
              Talk to Sales
            </button>
          </div>
        </div>
      </section>

      <SimpleFooter onNavigate={onNavigate} />
    </div>
  );
}

// Detailed Pricing Page
function PricingPage({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  
  const plans = [
    {
      name: "Free",
      description: "Try before you buy - 1 term free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      icon: "Gift",
      color: "from-[#ffd700]/20 via-[#ffed4e]/10 to-transparent",
      features: [
        "1 class",
        "1 teacher",
        "Unlimited parents",
        "1 academic term (3 months)",
        "WhatsApp support",
        "Basic reports"
      ],
      notIncluded: [
        "Multiple schools",
        "API access",
        "Custom integrations"
      ],
      popular: false
    },
    {
      name: "Starter",
      description: "Perfect for small schools just getting started",
      monthlyPrice: 49,
      yearlyPrice: 39,
      icon: "Zap",
      color: "from-[#ffd700]/20 via-[#ffed4e]/10 to-transparent",
      features: [
        "Up to 200 students",
        "1 school location",
        "3 teacher accounts",
        "Basic reports",
        "WhatsApp support",
        "Email support"
      ],
      notIncluded: [
        "Advanced analytics",
        "API access",
        "Custom integrations"
      ],
      popular: false
    },
    {
      name: "Professional",
      description: "Best for growing schools with advanced needs",
      monthlyPrice: 99,
      yearlyPrice: 79,
      icon: "Rocket",
      color: "from-[#7dd3c0]/20 via-[#5fb3a0]/10 to-transparent",
      features: [
        "Up to 1,000 students",
        "3 school locations",
        "Unlimited teachers",
        "Advanced reports & analytics",
        "API access",
        "Priority WhatsApp support",
        "Custom branding",
        "Data export"
      ],
      notIncluded: [
        "Dedicated account manager"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      description: "For large school groups and districts",
      monthlyPrice: null,
      yearlyPrice: null,
      icon: "Building",
      color: "from-[#ffd700]/30 via-[#7dd3c0]/20 to-transparent",
      features: [
        "Unlimited students",
        "Unlimited locations",
        "Unlimited everything",
        "Custom integrations",
        "Dedicated account manager",
        "24/7 phone support",
        "SLA guarantee",
        "On-premise deployment option",
        "Custom AI training"
      ],
      notIncluded: [],
      popular: false
    }
  ];

  const getPlanIcon = (iconName: string) => {
    switch(iconName) {
      case 'Gift': return <Gift className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'Rocket': return <Rocket className="w-5 h-5" />;
      case 'Building': return <Building className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#4a4f55]">
      <PublicNav onNavigate={onNavigate} currentPage="pricing" />
      
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center px-6 overflow-hidden">
        {/* KUMO-AI Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[20vw] font-bold text-white/[0.03] blur-sm">KUMO-AI</span>
        </div>
        <div className="bg-text-blur">PRICE</div>
        <div className="relative z-10 text-center max-w-4xl mx-auto pt-24">
          <p className="eyebrow mb-4">Pricing</p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
            Simple & <span className="text-[#ffd700]">Transparent</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Choose the plan that fits your school. All plans include a 14-day free trial.
          </p>
        </div>
        
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 hidden lg:block">
          <div className="w-96 h-48 animate-float opacity-10">
            <div className="w-full h-full bg-gradient-to-t from-[#ffd700]/40 to-transparent rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Billing Toggle */}
      <section className="px-6 pb-12">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-white/50'}`}>Monthly</span>
          <button 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-16 h-8 bg-black/50 rounded-full border border-white/20"
          >
            <div className={`absolute top-1 w-6 h-6 bg-[#ffd700] rounded-full transition-all ${billingCycle === 'yearly' ? 'left-9' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-white' : 'text-white/50'}`}>
            Yearly <span className="text-[#ffd700]">(Save 20%)</span>
          </span>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6 relative">
        {/* Background Decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#ffd700]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#7dd3c0]/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 relative z-10">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`premium-pricing-card group ${plan.popular ? 'popular' : ''}`}
              style={{ animationDelay: `${index * 200}ms` }}
            >
              {/* Blurry Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl`} />
              
              {/* Card Content */}
              <div className="relative z-10 p-5 h-full flex flex-col">
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ffd700] text-black px-3 py-0.5 rounded-full text-xs font-bold shadow-lg shadow-[#ffd700]/30">
                    Most Popular
                  </div>
                )}
                {index === 0 && !plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7dd3c0] text-black px-3 py-0.5 rounded-full text-xs font-bold shadow-lg shadow-[#7dd3c0]/30">
                    Free
                  </div>
                )}
                
                {/* Icon & Title */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.popular ? 'bg-[#ffd700] text-black' : index === 0 ? 'bg-[#7dd3c0] text-black' : 'bg-white/10 text-white'} pricing-icon-3d`}>
                    {getPlanIcon(plan.icon)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-white/50 text-xs">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  {plan.monthlyPrice !== null ? (
                    <div className="flex items-baseline gap-1">
                      {plan.monthlyPrice > 0 && <span className="text-white/50 text-base">$</span>}
                      <span className="text-3xl font-bold text-white pricing-price-glow">
                        {billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                      </span>
                      {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && <span className="text-white/50 text-sm">/month</span>}
                      {plan.monthlyPrice !== null && plan.monthlyPrice === 0 && <span className="text-white/50 text-sm">/term</span>}
                    </div>
                  ) : (
                    <div className="text-3xl font-bold text-white pricing-price-glow">Custom</div>
                  )}
                  {plan.monthlyPrice !== null && plan.monthlyPrice > 0 && billingCycle === 'yearly' && (
                    <p className="text-[#ffd700] text-xs mt-1 font-medium">Billed annually (${(plan.yearlyPrice || 0) * 12}/year)</p>
                  )}
                </div>

                {/* CTA Button */}
                <button 
                  onClick={() => plan.monthlyPrice !== null ? onNavigate('signup') : onNavigate('contact')}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 mb-4 ${
                    plan.popular || index === 0
                      ? 'bg-[#ffd700] text-black hover:bg-[#ffed4e]' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {index === 0 ? 'Start Free' : plan.monthlyPrice !== null ? 'Get Started' : 'Contact Sales'}
                </button>

                {/* Features */}
                <div className="space-y-2 flex-1">
                  <p className="text-white font-medium text-xs">What's included:</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-white/70 text-xs">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.popular || index === 0 ? 'bg-[#ffd700]/20' : 'bg-white/10'}`}>
                          <Check className="w-2.5 h-2.5 text-[#ffd700]" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {plan.notIncluded.length > 0 && (
                    <>
                      <p className="text-white/40 font-medium text-xs mt-4">Not included:</p>
                      <ul className="space-y-2">
                        {plan.notIncluded.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-white/40 text-xs">
                            <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <X className="w-2.5 h-2.5" />
                            </div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              {/* 3D Academic Element */}
              <div className="absolute -bottom-2 -right-2 w-16 h-16 opacity-0 group-hover:opacity-100 transition-all duration-500 pricing-3d-element">
                <div className="w-full h-full bg-gradient-to-br from-black/40 to-black/20 rounded-full blur-sm flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-white/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-black/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Can I change plans later?</h3>
              <p className="text-white/60 text-sm">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Is there a setup fee?</h3>
              <p className="text-white/60 text-sm">No setup fees for Starter and Professional plans. Enterprise plans may have a one-time setup fee depending on requirements.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-white/60 text-sm">We accept credit cards, bank transfers, and mobile money payments. Enterprise customers can also pay via invoice.</p>
            </div>
          </div>
        </div>
      </section>

      <SimpleFooter onNavigate={onNavigate} />
    </div>
  );
}

// Public Navigation Component
function PublicNav({ onNavigate, currentPage }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void, currentPage: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'docs', label: 'Docs' },
    { id: 'faqs', label: 'FAQs' },
    { id: 'contact', label: 'Contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#4a4f55]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <button onClick={() => onNavigate('landing')} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">KUMO-AI</span>
        </button>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id as any)}
              className={`text-sm font-medium transition-colors ${
                currentPage === link.id ? 'text-[#ffd700]' : 'text-white/60 hover:text-white'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <button onClick={() => onNavigate('login')} className="text-white/60 hover:text-white text-sm font-medium transition-colors">
            Sign In
          </button>
          <button onClick={() => onNavigate('signup')} className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-black/80 transition-all">
            Get Started
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#4a4f55]/95 backdrop-blur-xl border-t border-white/10 p-6">
          <div className="flex flex-col gap-4">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => {
                  onNavigate(link.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={`text-left py-2 ${
                  currentPage === link.id ? 'text-[#ffd700]' : 'text-white/70 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="border-t border-white/10 pt-4 mt-2 flex flex-col gap-3">
              <button onClick={() => onNavigate('login')} className="text-white/70 hover:text-white py-2 text-left">
                Sign In
              </button>
              <button onClick={() => onNavigate('signup')} className="bg-black text-white py-3 rounded-full font-medium">
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

// Simple Footer for Public Pages
function SimpleFooter({ onNavigate }: { onNavigate: (page: 'landing' | 'signup' | 'login' | 'contact' | 'docs' | 'faqs' | 'features' | 'pricing') => void }) {
  return (
    <footer className="bg-[#2a2f35] border-t border-white/10 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold">KUMO-AI</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <button onClick={() => onNavigate('features')} className="text-white/50 hover:text-white transition-colors">Features</button>
            <button onClick={() => onNavigate('pricing')} className="text-white/50 hover:text-white transition-colors">Pricing</button>
            <button onClick={() => onNavigate('docs')} className="text-white/50 hover:text-white transition-colors">Docs</button>
            <button onClick={() => onNavigate('contact')} className="text-white/50 hover:text-white transition-colors">Contact</button>
          </div>
          
          <p className="text-white/30 text-sm">© 2024 KUMO-AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// Chat Support Widget
// UI COMPONENTS

const VerifiedBadge = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={`${className} inline-flex items-center justify-center`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="verifiedBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <linearGradient id="verifiedCheckGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#f0fdf4" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="11" fill="url(#verifiedBadgeGrad)" />
    <path 
      d="M8 12.5L10.5 15L16 9" 
      stroke="url(#verifiedCheckGrad)" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

function WhatsAppSupportWidget() {
  return (
    <a 
      href="https://wa.me/2341234567890" 
      target="_blank" 
      rel="noopener noreferrer"
      className="whatsapp-floating-btn"
      title="Chat with KUMO-AI Support"
    >
      <div className="relative">
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-ping" />
      </div>
      <span className="whatsapp-badge">WhatsApp Support</span>
    </a>
  );
}

function ChatSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Hi! I\'m your KUMO-AI Global Support Assistant. How can I help you manage your school today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    
    const userMsg = inputValue.trim();
    setMessages(prev => [...prev, { type: 'user', text: userMsg }]);
    setInputValue('');
    setIsTyping(true);
    
    console.log(`[Support Chat] Sending message to: ${API_URL}/support/chat`);
    
    try {
      const response = await fetch(`${API_URL}/support/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMsg, history: messages })
      });
      
      const data = await response.json();
      console.log('[Support Chat] Response received:', data);
      
      if (data.success) {
        setMessages(prev => [...prev, { type: 'bot', text: data.reply }]);
      } else {
        console.error('[Support Chat] Server error:', data.error);
        setMessages(prev => [...prev, { type: 'bot', text: `Error: ${data.error || 'The AI assistant is currently unavailable.'}` }]);
      }
    } catch (error: any) {
      console.error('[Support Chat] Fetch failed:', error);
      setMessages(prev => [...prev, { type: 'bot', text: 'Connection lost. Please check your internet and try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="chat-floating-btn"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window shadow-2xl">
          <div className="chat-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#ffd700] flex items-center justify-center">
                <Brain className="w-4 h-4 text-black" />
              </div>
              <div>
                <h4 className="text-white font-medium text-sm">KUMO-AI AI Support</h4>
                <p className="text-green-400 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Always Active
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-white/30 hover:text-white transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="chat-messages dashboard-scroll">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-message ${msg.type === 'user' ? 'user' : 'bot shadow-md'}`}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="chat-message bot opacity-50 italic text-xs">
                KUMO-AI is thinking...
              </div>
            )}
          </div>
          
          <div className="chat-input-area">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="How do I set up grading?"
              className="chat-input"
              disabled={isTyping}
            />
            <button 
              onClick={handleSend} 
              className={`chat-send-btn ${isTyping ? 'opacity-50' : ''}`}
              disabled={isTyping}
            >
              {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// DASHBOARD COMPONENTS

// Dashboard Layout with Sidebar
function DashboardLayout({ children, currentPage, onNavigate }: { children: React.ReactNode, currentPage: string, onNavigate: (page: string) => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate('login');
  };

const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'recharge', label: 'Recharge', icon: CreditCard, highlight: true },
    { id: 'connect', label: 'Connect AI', icon: QrCode },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#4a4f55] flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-[#3a3f45] border-r border-white/10
        transition-all duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'w-20' : 'w-64'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <span className="text-white font-semibold text-lg">KUMO-AI</span>
            )}
          </button>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="ml-auto hidden lg:block text-white/50 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive 
                    ? 'bg-[#ffd700] text-black' 
                    : item.highlight 
                      ? 'bg-gradient-to-r from-[#ffd700]/20 to-[#7dd3c0]/20 text-[#ffd700] hover:from-[#ffd700]/30 hover:to-[#7dd3c0]/30 border border-[#ffd700]/30'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 space-y-2">
          <button 
            onClick={() => onNavigate('profile')}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
              ${currentPage === 'profile' ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}
            `}
          >
            <div className="w-8 h-8 rounded-full bg-[#ffd700] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-black" />
            </div>
            {!isSidebarCollapsed && (
              <div className="text-left">
                <p className="text-sm font-medium text-white flex items-center gap-1">
                  {user?.schoolName || 'Admin'}
                  <VerifiedBadge />
                </p>
                <p className="text-xs text-white/50">{user?.phone || 'admin@school.edu'}</p>
              </div>
            )}
          </button>
          
          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-white/70 hover:bg-red-500/20 hover:text-red-400"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && (
              <span className="font-medium text-sm">Logout</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-[#3a3f45]/50 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-white/70 hover:text-white p-2"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-white font-semibold capitalize">{currentPage}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="hidden sm:flex items-center bg-black/20 rounded-full px-4 py-2 border border-white/10">
              <Search className="w-4 h-4 text-white/50 mr-2" />
              <input 
                type="text" 
                placeholder="Search..."
                className="bg-transparent text-white text-sm outline-none placeholder:text-white/30 w-32 lg:w-48"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-white/70 hover:text-white">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ffd700] rounded-full" />
            </button>

            {/* Logout */}
            <button 
              onClick={() => onNavigate('landing')}
              className="p-2 text-white/70 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// Dashboard Overview Page - Fintech Style
function DashboardOverview({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  
  console.log('[DashboardOverview] Component rendering, user:', user);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'reports'>('overview');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // Real data state
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.schoolId) {
        console.log('[Dashboard] No schoolId found, skipping data fetch');
        setIsLoading(false);
        return;
      }
      
      console.log('[Dashboard] Fetching data for school:', user.schoolId);
      setIsLoading(true);
      setError(null);
      
      try {
        const [statsRes, schoolRes] = await Promise.all([
          authService.getDashboardStats(),
          authService.getSchoolInfo()
        ]);
        
        console.log('[Dashboard] Stats response:', statsRes);
        console.log('[Dashboard] School response:', schoolRes);
        
        if (statsRes.success) {
          setStats(statsRes.data);
        } else {
          console.error('[Dashboard] Stats fetch failed:', statsRes.error);
        }
        if (schoolRes.success) {
          setSchoolInfo(schoolRes.data);
        } else {
          console.error('[Dashboard] School info fetch failed:', schoolRes.error);
        }
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.schoolId]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const quickStats = [
    { label: 'Students', value: stats?.studentsCount?.toLocaleString() || '0', icon: Users, navigateTo: 'users', filterTab: 'student' },
    { label: 'Teachers', value: stats?.teachersCount?.toString() || '0', icon: GraduationCap, navigateTo: 'users', filterTab: 'teacher' },
    { label: 'Classes', value: stats?.classesCount?.toString() || '0', icon: School, navigateTo: 'academics', filterTab: null },
  ];

  const recentTransactions = [
    { id: 1, type: 'marks', title: 'Math Test Uploaded', class: 'JSS 3', time: '2m ago', status: 'success' },
    { id: 2, type: 'report', title: 'Terminal Report Gen', class: 'All Classes', time: '15m ago', status: 'success' },
    { id: 3, type: 'student', title: 'New Student Added', name: 'Chidi Okonkwo', time: '1h ago', status: 'pending' },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#ffd700] animate-spin" />
          <p className="text-white/50 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-white/70 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-[#ffd700] text-sm hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* School Identity Card */}
      <div className="relative bg-[#000000] rounded-2xl p-5 border border-white/10 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffd700]/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#ffd700]/5 rounded-full blur-xl" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center">
                <School className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg flex items-center gap-1">
                  {schoolInfo?.name || 'My School'}
                  <VerifiedBadge className="w-5 h-5" />
                </h2>
                <p className="text-white/50 text-xs">ID: {schoolInfo?.id?.slice(0, 12) || 'SCH-000'}</p>
              </div>
            </div>
            {/* Verification Badge */}
            <button 
              onClick={() => !isVerified && setShowVerificationModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isVerified || schoolInfo?.setupStatus === 'COMPLETED'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
              }`}
            >
              {isVerified || schoolInfo?.setupStatus === 'COMPLETED' ? (
                <><CheckCircle className="w-3.5 h-3.5" /> Verified</>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5" /> Setup</>
              )}
            </button>
          </div>

          {/* Balance/Stats Display */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-white/50 text-xs mb-1">Active Students</p>
            <p className="text-3xl font-bold text-white mb-3">{stats?.studentsCount?.toLocaleString() || '0'}</p>
            <div className="flex items-center gap-2">
              {(stats?.pendingMarksCount > 0 || stats?.pendingTransactionsCount > 0) && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                  {stats.pendingMarksCount || 0} pending marks
                </span>
              )}
              <span className="text-white/30 text-xs">WhatsApp: {stats?.whatsappStatus || 'disconnected'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Connect AI Card - Quick Access */}
      <ConnectAICard schoolId={user?.schoolId || ''} onNavigate={onNavigate} />

      {/* Compact Tab Menu */}
      <div className="bg-white/5 rounded-2xl p-1.5 border border-white/10">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#000000] text-white shadow-lg' 
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isActive ? 'bg-[#ffd700] text-black' : 'bg-black/50 text-white/70'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              {quickStats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <button 
                    key={idx}
                    onClick={() => {
                      if (stat.filterTab) {
                        // Store the selected tab in sessionStorage so UsersPage can read it
                        sessionStorage.setItem('users_page_filter', stat.filterTab);
                      }
                      onNavigate(stat.navigateTo);
                    }}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-center hover:bg-white/[0.07] transition-all active:scale-95"
                  >
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-5 h-5 text-white/70" />
                    </div>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-white/40 text-xs">{stat.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Recent Activity - Compact List */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-white font-medium text-sm">Recent Activity</span>
                <button className="text-[#ffd700] text-xs">View All</button>
              </div>
              <div className="divide-y divide-white/5">
                {recentTransactions.map((item) => (
                  <button 
                    key={item.id}
                    className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.03] transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.status === 'success' ? 'bg-green-500/10' : 'bg-yellow-500/10'
                    }`}>
                      {item.type === 'marks' && <Upload className="w-5 h-5 text-green-400" />}
                      {item.type === 'report' && <FileText className="w-5 h-5 text-blue-400" />}
                      {item.type === 'student' && <UserPlus className="w-5 h-5 text-yellow-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.title}</p>
                      <p className="text-white/40 text-xs">{item.class || item.name}</p>
                    </div>
                    <span className="text-white/30 text-xs">{item.time}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'academics' && (
          <div className="space-y-3">
            {/* Quick Upload */}
            <button 
              onClick={() => onNavigate('academics')}
              className="w-full bg-[#000000] border border-white/10 rounded-xl p-4 flex items-center gap-3 hover:bg-black/80 transition-all"
            >
              <div className="w-12 h-12 bg-[#ffd700] rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">Upload Marks</p>
                <p className="text-white/50 text-xs">Photo or CSV</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>

            {/* Current Term Info */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs mb-1">Current Term</p>
              <p className="text-white font-bold">First Term 2024/2025</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                  <div className="w-3/4 h-full bg-[#ffd700] rounded-full" />
                </div>
                <span className="text-white/50 text-xs">Week 8/12</span>
              </div>
            </div>

            {/* Pending Actions */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-medium">Pending</span>
              </div>
              <p className="text-white text-sm">3 classes need marks uploaded</p>
              <button 
                onClick={() => onNavigate('academics')}
                className="mt-2 text-[#ffd700] text-xs font-medium"
              >
                Upload Now →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-3">
            {/* Generate Report Button */}
            <button 
              onClick={() => onNavigate('reports')}
              className="w-full bg-[#ffd700] text-black rounded-xl p-4 flex items-center justify-center gap-2 font-semibold hover:bg-[#ffed4e] transition-all"
            >
              <FileText className="w-5 h-5" />
              Generate Report
            </button>

            {/* Report Types */}
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:bg-white/[0.07] transition-all">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5 text-white/70" />
                </div>
                <p className="text-white text-sm font-medium">Broadsheet</p>
                <p className="text-white/40 text-xs">Class Summary</p>
              </button>
              <button className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:bg-white/[0.07] transition-all">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-5 h-5 text-white/70" />
                </div>
                <p className="text-white text-sm font-medium">Individual</p>
                <p className="text-white/40 text-xs">Student Card</p>
              </button>
            </div>

            {/* Recent Reports */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs mb-3">Recently Generated</p>
              <div className="space-y-2">
                {['JSS 3 - Midterm', 'SS 2 - Terminal', 'All Classes - Summary'].map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-white text-sm">{report}</span>
                    <button className="text-[#ffd700] text-xs">Download</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#3a3f45] border border-white/10 rounded-2xl p-6 w-full max-w-sm animate-scaleIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Verify School</h3>
              <p className="text-white/60 text-sm">Complete verification to unlock all features</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-white text-sm">School Registration</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-white text-sm">Email Confirmed</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <Clock className="w-5 h-5 text-yellow-400" />
                <span className="text-white text-sm">Documents Pending</span>
              </div>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => {
                  setIsVerified(true);
                  setShowVerificationModal(false);
                }}
                className="w-full bg-[#ffd700] text-black py-3 rounded-xl font-semibold hover:bg-[#ffed4e] transition-all"
              >
                Complete Verification
              </button>
              <button 
                onClick={() => setShowVerificationModal(false)}
                className="w-full bg-white/5 text-white py-3 rounded-xl font-medium hover:bg-white/10 transition-all"
              >
                Do It Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Users Management Page
function UsersPage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const { user: currentUser } = useAuth(); // Get current user for schoolId
  const [activeTab, setActiveTab] = useState<'all' | 'teacher' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [_showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for pre-selected tab from dashboard navigation
  useEffect(() => {
    const preSelectedTab = sessionStorage.getItem('users_page_filter');
    if (preSelectedTab && ['teacher', 'student'].includes(preSelectedTab)) {
      setActiveTab(preSelectedTab as 'teacher' | 'student');
      // Clear it so it doesn't persist on refresh
      sessionStorage.removeItem('users_page_filter');
    }
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser?.schoolId) {
        setError('School ID not found.');
        setLoadingUsers(false);
        return;
      }
      setLoadingUsers(true);
      setError(null);
      try {
        const [studentsResponse, teachersResponse] = await Promise.all([
          authService.getStudents(),
          authService.getTeachers()
        ]);

        const fetchedStudents = studentsResponse.data?.map((s: any) => ({
          id: s.id,
          name: s.name,
          role: 'student',
          class: s.class_level, // Assuming class_level from backend
          phone: s.phone,
          status: s.status || 'active',
          email: s.email
        })) || [];

        const fetchedTeachers = teachersResponse.data?.map((t: any) => ({
          id: t.id,
          name: t.name,
          role: 'teacher',
          subject: t.subject_taught, // Assuming subject_taught from backend
          phone: t.phone,
          status: t.status || 'active',
          email: t.email
        })) || [];
        
        // Combine all and deduplicate if necessary (by phone or ID)
        const combinedUsers = [...fetchedStudents, ...fetchedTeachers];
        setAllUsers(combinedUsers);

      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users. Please try again later.');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [currentUser?.schoolId]);

  const filteredUsers = allUsers.filter(user => {
    if (activeTab !== 'all' && user.role !== activeTab) return false;
    if (searchQuery && !user.name.toLowerCase().includes(searchQuery.toLowerCase()) && !user.phone.includes(searchQuery)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-black/20 rounded-xl p-1 border border-white/10">
          {[
            { id: 'all', label: 'All People' },
            { id: 'teacher', label: 'Teachers' },
            { id: 'student', label: 'Students' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'all' | 'teacher' | 'student')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#ffd700] text-black' 
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#ffd700] text-black px-4 py-2 rounded-xl font-medium hover:bg-[#ffed4e] transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
        <input
          type="text"
          placeholder="Search users by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:border-[#ffd700] focus:outline-none"
        />
      </div>

      {loadingUsers && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 text-[#ffd700] animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading users...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
          <p>{error}</p>
        </div>
      )}

      {!loadingUsers && !error && filteredUsers.length === 0 && (
        <div className="text-center py-10 text-white/50">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white/30" />
          </div>
          <p className="text-white/70 font-medium mb-2">
            {activeTab === 'all' ? 'No users added yet' : 
             activeTab === 'teacher' ? 'No teachers added yet' : 
             'No students added yet'}
          </p>
          <p className="text-sm">
            Click "Add User" button above to get started
          </p>
        </div>
      )}

      {/* Users Grid */}
      {!loadingUsers && !error && filteredUsers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#ffd700] to-[#ffed4e] rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-lg">{user.name.charAt(0)}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  user.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {user.status}
                </span>
              </div>
              <h3 className="text-white font-semibold mb-1">{user.name}</h3>
              <p className="text-white/50 text-sm mb-3 capitalize">{user.role}</p>
              <div className="space-y-2 text-sm">
                {user.subject && (
                  <div className="flex items-center gap-2 text-white/60">
                    <BookOpen className="w-4 h-4" />
                    {user.subject}
                  </div>
                )}
                {user.class && (
                  <div className="flex items-center gap-2 text-white/60">
                    <GraduationCap className="w-4 h-4" />
                    {user.class}
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2 text-white/60">
                    <Smartphone className="w-4 h-4" />
                    {user.phone}
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-2 text-white/60">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// Academics Page
function AcademicsPage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [_marks, setMarks] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [gradingConfig, setGradingConfig] = useState<any>(null);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localMarks, setLocalMarks] = useState<{ [studentId: string]: any }>({});

  // Fetch initial metadata
  useEffect(() => {
    const fetchAcademicsMetadata = async () => {
      if (!user?.schoolId) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const [classesRes, termsRes, schoolRes] = await Promise.all([
          authService.getClasses(),
          authService.getTerms(),
          authService.getSchoolInfo()
        ]);
        
        if (classesRes?.success && Array.isArray(classesRes.data)) {
          const classNames = classesRes.data.map((c: any) => c?.name).filter(Boolean);
          setClasses(classNames);
          if (classNames.length > 0 && !selectedClass) setSelectedClass(classNames[0]);
        }
        
        if (termsRes?.success && Array.isArray(termsRes.data)) {
          setTerms(termsRes.data);
          const current = termsRes.data.find((t: any) => t?.isCurrent);
          if (current) setSelectedTerm(current.id);
        }

        if (schoolRes?.success) {
          setGradingConfig(schoolRes.data.gradingConfig);
        }
      } catch (err) {
        console.error('Failed to fetch academics metadata:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAcademicsMetadata();
  }, [user?.schoolId]);

  // Fetch subjects when class changes
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user?.schoolId || !selectedClass) return;
      try {
        const res = await authService.getSubjects({ class_level: selectedClass });
        if (res?.success && Array.isArray(res.data)) {
          const names: string[] = res.data
            .map((s: any) => s?.name)
            .filter((n: any): n is string => typeof n === 'string' && n.length > 0);
          const subjectNames: string[] = Array.from(new Set(names));
          setSubjects(subjectNames);
          if (subjectNames.length > 0) setSelectedSubject(subjectNames[0]);
          else setSelectedSubject('');
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      }
    };
    fetchSubjects();
  }, [user?.schoolId, selectedClass]);

  // Fetch students and marks when selection changes
  useEffect(() => {
    const fetchMarksData = async () => {
      if (!user?.schoolId || !selectedClass || !selectedSubject) return;
      
      try {
        const [studentsRes, marksRes] = await Promise.all([
          authService.getStudents({ class_level: selectedClass }),
          authService.getMarks({ 
            class_level: selectedClass, 
            subject: selectedSubject,
            term_id: selectedTerm || undefined
          })
        ]);
        
        if (studentsRes?.success && Array.isArray(studentsRes.data)) {
          setStudents(studentsRes.data);
          
          // Initialize local marks
          const initialLocal: any = {};
          studentsRes.data.forEach((s: any) => {
            const existing = marksRes.data?.find((m: any) => m.studentId === s.id);
            initialLocal[s.id] = existing?.marks || {};
          });
          setLocalMarks(initialLocal);
        } else {
          setStudents([]);
          setLocalMarks({});
        }
        
        if (marksRes?.success && Array.isArray(marksRes.data)) {
          setMarks(marksRes.data);
        } else {
          setMarks([]);
        }
      } catch (err) {
        console.error('Failed to fetch marks data:', err);
        setStudents([]);
        setMarks([]);
      }
    };
    
    fetchMarksData();
  }, [user?.schoolId, selectedClass, selectedSubject, selectedTerm]);

  const handleMarkChange = (studentId: string, pillarId: string, value: string) => {
    setLocalMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [pillarId]: value
      }
    }));
  };

  const saveMarks = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (!selectedClass || !selectedSubject || !selectedTerm) return;
    
    setIsSaving(true);
    try {
      const marksToSave = students.map(s => ({
        studentId: s.id,
        studentName: s.name,
        classLevel: selectedClass,
        subject: selectedSubject,
        termId: selectedTerm,
        marks: localMarks[s.id] || {}
      }));

      await authService.saveMarks({ marks: marksToSave, status });
      alert(`Marks ${status === 'DRAFT' ? 'saved as draft' : 'submitted'} successfully!`);
    } catch (err) {
      console.error('Failed to save marks:', err);
      alert('Failed to save marks. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pillars = gradingConfig?.pillars || [
    { id: 'ca1', name: 'CA1', maxScore: 10 },
    { id: 'ca2', name: 'CA2', maxScore: 10 },
    { id: 'midterm', name: 'Midterm', maxScore: 20 },
    { id: 'exam', name: 'Exam', maxScore: 60 }
  ];

  const getTotalScore = (studentMarks: any) => {
    if (!studentMarks) return 0;
    return pillars.reduce((sum: number, pillar: any) => {
      return sum + (Number(studentMarks[pillar.id]) || 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#ffd700] animate-spin" />
      </div>
    );
  }

  if (!user?.schoolId) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
        <p className="text-red-400">Error: School context not found. Please re-login.</p>
      </div>
    );
  }

  const currentTerm = Array.isArray(terms) ? terms.find((t: any) => t?.isCurrent) : null;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-gradient-to-r from-[#ffd700]/10 to-transparent border border-[#ffd700]/20 rounded-2xl p-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Upload Marks</h2>
            <p className="text-white/60">
              {currentTerm ? `Current: ${currentTerm.name}` : 'No term configured'}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-[#ffd700] text-black px-6 py-3 rounded-xl font-medium hover:bg-[#ffed4e] transition-all">
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </button>
            <button className="flex items-center gap-2 bg-white/10 text-white border border-white/20 px-6 py-3 rounded-xl font-medium hover:bg-white/20 transition-all">
              <Upload className="w-5 h-5" />
              Upload CSV
            </button>
          </div>
        </div>
      </div>

      {/* Class, Subject & Term Selection */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-white/70 text-sm mb-3">Select Class</label>
          <div className="flex flex-wrap gap-2">
            {!Array.isArray(classes) || classes.length === 0 ? (
              <span className="text-white/30 text-sm">No classes defined in setup</span>
            ) : (
              classes.map(cls => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedClass === cls 
                      ? 'bg-[#ffd700] text-black' 
                      : 'bg-black/20 text-white/70 hover:bg-black/30'
                  }`}
                >
                  {cls}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-white/70 text-sm mb-3">Select Subject</label>
          <div className="flex flex-wrap gap-2">
            {!Array.isArray(subjects) || subjects.length === 0 ? (
              <span className="text-white/30 text-sm">No subjects for this class</span>
            ) : (
              subjects.map(subj => (
                <button
                  key={subj}
                  onClick={() => setSelectedSubject(subj)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSubject === subj 
                      ? 'bg-[#ffd700] text-black' 
                      : 'bg-black/20 text-white/70 hover:bg-black/30'
                  }`}
                >
                  {subj}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-white/70 text-sm mb-3">Select Term</label>
          <div className="flex flex-wrap gap-2">
            {!Array.isArray(terms) || terms.length === 0 ? (
              <span className="text-white/30 text-sm">No terms</span>
            ) : (
              terms.map(term => (
                <button
                  key={term.id}
                  onClick={() => setSelectedTerm(term.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTerm === term.id 
                      ? 'bg-[#ffd700] text-black' 
                      : 'bg-black/20 text-white/70 hover:bg-black/30'
                  }`}
                >
                  {term.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Marks Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {selectedSubject || 'Select Subject'} - {selectedClass || 'Select Class'}
          </h3>
          <div className="flex items-center gap-4">
            {gradingConfig?.gradingScale && (
              <span className="text-xs px-2 py-1 bg-[#ffd700]/10 text-[#ffd700] rounded border border-[#ffd700]/20">
                Scale: {gradingConfig.gradingScale}
              </span>
            )}
            <button className="text-[#ffd700] text-sm hover:underline">Download Template</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {!Array.isArray(students) || students.length === 0 ? (
            <div className="p-8 text-center text-white/50">
              No students found in this class. Add students first to enter marks.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-black/20">
                <tr>
                  <th className="text-left text-white/70 text-sm font-medium p-4">Student Name</th>
                  {pillars.map((pillar: any) => (
                    <th key={pillar.id} className="text-center text-white/70 text-sm font-medium p-4">
                      {pillar.name} ({pillar.maxScore}%)
                    </th>
                  ))}
                  <th className="text-center text-white/70 text-sm font-medium p-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => {
                  if (!student) return null;
                  const studentMarks = localMarks[student.id] || {};
                  return (
                    <tr key={student.id} className="border-t border-white/5">
                      <td className="p-4 text-white font-medium">{student.name}</td>
                      {pillars.map((pillar: any) => (
                        <td key={pillar.id} className="p-4 text-center">
                          <input 
                            type="number" 
                            value={studentMarks[pillar.id] || ''} 
                            onChange={(e) => handleMarkChange(student.id, pillar.id, e.target.value)}
                            min="0" max={pillar.maxScore}
                            className="w-16 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-center focus:border-[#ffd700] focus:outline-none transition-all" 
                          />
                        </td>
                      ))}
                      <td className="p-4 text-center text-[#ffd700] font-bold">
                        {getTotalScore(studentMarks)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end gap-3">
          <button 
            disabled={isSaving}
            onClick={() => saveMarks('DRAFT')}
            className="px-6 py-2 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            disabled={isSaving || !Array.isArray(students) || students.length === 0}
            onClick={() => saveMarks('CONFIRMED')}
            className="px-6 py-2 bg-[#ffd700] text-black rounded-lg font-medium hover:bg-[#ffed4e] transition-all disabled:opacity-50"
          >
            {isSaving ? 'Submitting...' : 'Submit Marks'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reports Page
function ReportsPage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Generate Report Card */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="w-14 h-14 bg-[#ffd700] rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-black" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Individual Report Card</h3>
          <p className="text-white/50 text-sm mb-4">Generate comprehensive report card for a single student</p>
          <button className="w-full py-3 bg-black/20 text-white rounded-xl hover:bg-black/30 transition-all">
            Generate
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mb-4">
            <Table className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Class Broadsheet</h3>
          <p className="text-white/50 text-sm mb-4">Generate full class summary with all students and subjects</p>
          <button className="w-full py-3 bg-black/20 text-white rounded-xl hover:bg-black/30 transition-all">
            Generate
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Progress Report</h3>
          <p className="text-white/50 text-sm mb-4">Track student improvement over multiple terms</p>
          <button className="w-full py-3 bg-black/20 text-white rounded-xl hover:bg-black/30 transition-all">
            Generate
          </button>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white/5 border border-white/10 rounded-2xl">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Recently Generated Reports</h3>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { name: 'JSS 3 Broadsheet - First Term', date: 'Jan 15, 2024', type: 'Broadsheet', size: '245 KB' },
            { name: 'Chidi Okonkwo Report Card', date: 'Jan 14, 2024', type: 'Individual', size: '1.2 MB' },
            { name: 'SS 2 Mathematics Analysis', date: 'Jan 12, 2024', type: 'Subject', size: '890 KB' },
            { name: 'End of Term Reports - All Classes', date: 'Jan 10, 2024', type: 'Batch', size: '15.4 MB' },
          ].map((report, idx) => (
            <div key={idx} className="p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white/50" />
                </div>
                <div>
                  <p className="text-white font-medium">{report.name}</p>
                  <p className="text-white/50 text-sm">{report.date} • {report.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-sm">{report.size}</span>
                <button className="p-2 text-white/50 hover:text-[#ffd700] transition-colors">
                  <Download className="w-5 h-5" />
                </button>
                <button className="p-2 text-white/50 hover:text-white transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Analytics Page
function AnalyticsPage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const { user: currentUser } = useAuth();
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [classPerformance, setClassPerformance] = useState<any[]>([]); // To be derived from marks
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]); // To be derived from marks
  const [topStudents, setTopStudents] = useState<any[]>([]); // To be derived from marks and students
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentUser?.schoolId) {
        setError('School ID not found.');
        setLoadingAnalytics(false);
        return;
      }
      setLoadingAnalytics(true);
      setError(null);
      try {
        const statsResponse = await authService.getDashboardStats();
        setDashboardStats(statsResponse.data);

        // Fetch marks and students for performance and top students
        const [marksResponse, studentsResponse] = await Promise.all([
          authService.getMarks(),
          authService.getStudents()
        ]);

        const allMarks = marksResponse.data || [];
        const allStudents = studentsResponse.data || [];

        // Process Class Performance (example: average score per class over time)
        // This is a simplified aggregation. Actual implementation might need more sophisticated backend support or frontend logic.
        const classScores: { [key: string]: { totalScore: number; count: number } } = {};
        allMarks.forEach((mark: any) => {
          const classLevel = mark.class_level; // Assuming marks have class_level
          if (classLevel) {
            if (!classScores[classLevel]) {
              classScores[classLevel] = { totalScore: 0, count: 0 };
            }
            classScores[classLevel].totalScore += mark.total_score || 0; // Assuming total_score
            classScores[classLevel].count++;
          }
        });

        const processedClassPerformance = Object.keys(classScores).map(classLevel => ({
          class: classLevel,
          score: classScores[classLevel].count > 0 ? Math.round(classScores[classLevel].totalScore / classScores[classLevel].count) : 0,
        }));
        setClassPerformance(processedClassPerformance);

        // Process Subject Performance
        const subjectScores: { [key: string]: { totalScore: number; count: number } } = {};
        allMarks.forEach((mark: any) => {
          const subject = mark.subject; // Assuming marks have subject
          if (subject) {
            if (!subjectScores[subject]) {
              subjectScores[subject] = { totalScore: 0, count: 0 };
            }
            subjectScores[subject].totalScore += mark.total_score || 0;
            subjectScores[subject].count++;
          }
        });
        const processedSubjectPerformance = Object.keys(subjectScores).map(subject => ({
          subject: subject,
          score: subjectScores[subject].count > 0 ? Math.round(subjectScores[subject].totalScore / subjectScores[subject].count) : 0,
          students: allStudents.filter((s:any) => s.class_level === allMarks.find((m:any) => m.subject === subject)?.class_level).length // Placeholder
        }));
        setSubjectPerformance(processedSubjectPerformance);

        // Process Top Performing Students
        const studentAverages: { [key: string]: { totalScore: number; count: number; name: string } } = {};
        allMarks.forEach((mark: any) => {
          const studentId = mark.student_id; // Assuming marks have student_id
          const studentName = allStudents.find((s:any) => s.id === studentId)?.name || 'Unknown';
          if (studentId) {
            if (!studentAverages[studentId]) {
              studentAverages[studentId] = { totalScore: 0, count: 0, name: studentName };
            }
            studentAverages[studentId].totalScore += mark.total_score || 0;
            studentAverages[studentId].count++;
          }
        });

        const processedTopStudents = Object.keys(studentAverages)
          .map(studentId => ({
            id: studentId,
            name: studentAverages[studentId].name,
            avg: studentAverages[studentId].count > 0 ? (studentAverages[studentId].totalScore / studentAverages[studentId].count).toFixed(1) : '0.0',
          }))
          .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))
          .slice(0, 5) // Top 5 students
          .map((s, idx) => ({ ...s, rank: idx + 1 })); // Add rank
        
        setTopStudents(processedTopStudents);

      } catch (err: any) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics data. Please try again later.');
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [currentUser?.schoolId]);


  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      {loadingAnalytics && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 text-[#ffd700] animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading analytics...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
          <p>{error}</p>
        </div>
      )}

      {!loadingAnalytics && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Students', value: dashboardStats?.totalStudents || 0, icon: Users },
              { label: 'Total Teachers', value: dashboardStats?.totalTeachers || 0, icon: User },
              { label: 'Avg. Score', value: dashboardStats?.averageScore ? `${dashboardStats.averageScore.toFixed(1)}%` : 'N/A', icon: BarChart3 },
              { label: 'Pass Rate', value: dashboardStats?.passRate ? `${dashboardStats.passRate.toFixed(1)}%` : 'N/A', icon: CheckCircle },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className="w-5 h-5 text-white/50" />
                    {/* <span className={`text-xs font-medium ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.trend}
                    </span> */}
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-white/50 text-sm">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Class Performance Chart */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Class Performance Trends</h3>
            <div className="h-64 flex items-end justify-around gap-4">
              {classPerformance.length > 0 ? (
                classPerformance.map((data, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full max-w-[60px] bg-gradient-to-t from-[#ffd700] to-[#ffed4e] rounded-t-lg transition-all"
                      style={{ height: `${data.score}px`, maxHeight: '100%' }} // Adjust height to scale better
                    />
                    <span className="text-white/50 text-sm">{data.class}</span>
                    <span className="text-white font-medium">{data.score}%</span>
                  </div>
                ))
              ) : (
                <div className="text-white/50 text-sm w-full text-center">No class performance data available.</div>
              )}
            </div>
          </div>

          {/* Subject Performance & Top Students */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Subject Performance</h3>
              <div className="space-y-4">
                {subjectPerformance.length > 0 ? (
                  subjectPerformance.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="w-24 text-white text-sm truncate">{item.subject}</span>
                      <div className="flex-1 h-3 bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#ffd700] rounded-full"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-white font-medium">{item.score}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/50 text-sm">No subject performance data available.</div>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Top Performing Students</h3>
              <div className="space-y-4">
                {topStudents.length > 0 ? (
                  topStudents.map((student, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-black/20 rounded-xl">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        student.rank <= 3 ? 'bg-[#ffd700] text-black' : 'bg-white/10 text-white'
                      }`}>
                        {student.rank}
                      </div>
                      <span className="flex-1 text-white font-medium">{student.name}</span>
                      <span className="text-[#ffd700] font-bold">{student.avg}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-white/50 text-sm">No top performing students data available.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Recharge Page - Subscription Plans with Paystack Integration
function RechargePage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user: _user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [currency, setCurrency] = useState('NGN');
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [pollingRef, setPollingRef] = useState<string | null>(null);

  const CURRENCIES = [
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
    { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
    { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', flag: '🇬🇭' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
    { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
  ];

  const PLAN_FEATURES: Record<string, { features: string[], notIncluded: string[] }> = {
    'Free': {
      features: ['Up to 50 students', '1 class', '1 teacher account', 'Unlimited parents', '1 academic term', 'Basic reports'],
      notIncluded: ['Multiple classes', 'Advanced analytics', 'API access']
    },
    'Starter': {
      features: ['Up to 200 students', '3 classes', '5 teacher accounts', 'Unlimited parents', 'Full academic year', 'Basic reports', 'WhatsApp support'],
      notIncluded: ['Advanced analytics', 'API access', 'Custom branding']
    },
    'Professional': {
      features: ['Up to 1,000 students', 'Unlimited classes', 'Unlimited teachers', 'Advanced reports & analytics', 'API access', 'Priority support', 'Custom branding', 'Data export'],
      notIncluded: ['Dedicated account manager']
    },
    'Enterprise': {
      features: ['Unlimited students', 'Unlimited everything', 'Multi-branch support', 'Custom integrations', 'Dedicated account manager', '24/7 Priority support', 'White-label solution', 'SLA guarantee'],
      notIncluded: []
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pollingRef) {
      interval = setInterval(async () => {
        try {
          const result = await authService.verifyPayment(pollingRef);
          if (result.success && result.data.status === 'success') {
            clearInterval(interval);
            setPollingRef(null);
            setPaymentDetails(null);
            await loadData();
            alert(`🎉 Payment successful! You're now on ${result.data.plan} plan!`);
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [pollingRef]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subResult, plansResult] = await Promise.all([
        authService.getSubscriptionStatus(),
        authService.getPlans(currency)
      ]);
      
      if (subResult.success) {
        setSubscription(subResult.data);
        setCurrency(subResult.data.currency || 'NGN');
      }
      if (plansResult.success) {
        setPlans(plansResult.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    try {
      await authService.updateCurrency(newCurrency);
      setCurrency(newCurrency);
      const result = await authService.getPlans(newCurrency);
      if (result.success) {
        setPlans(result.data);
      }
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (planName === 'Free') return;
    
    setIsProcessing(planName);
    try {
      const result = await authService.initializePayment(planName, currency);
      
      if (result.success) {
        setPaymentDetails({
          ...result.data,
          planName
        });
        setPollingRef(result.data.reference);
      } else {
        alert(result.error || 'Failed to initialize payment');
      }
    } catch (error: any) {
      alert(error.message || 'Payment initialization failed');
    } finally {
      setIsProcessing(null);
    }
  };

  const cancelPayment = () => {
    setPaymentDetails(null);
    setPollingRef(null);
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'Free': return Gift;
      case 'Starter': return Zap;
      case 'Professional': return Rocket;
      case 'Enterprise': return Building;
      default: return Gift;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#ffd700] mx-auto mb-4" />
          <p className="text-white/60">Loading subscription...</p>
        </div>
      </div>
    );
  }

  if (paymentDetails) {
    const currentCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Payment Details Card */}
        <div className="bg-gradient-to-br from-[#ffd700]/10 to-[#7dd3c0]/10 rounded-2xl p-8 border border-[#ffd700]/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#ffd700]/20 flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-[#ffd700]" />
            </div>
            <h2 className="text-2xl font-bold text-white">Bank Transfer Details</h2>
            <p className="text-white/60 text-sm mt-2">Transfer the exact amount to the account below</p>
          </div>

          <div className="bg-black/30 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Plan</span>
              <span className="text-white font-semibold">{paymentDetails.planName}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Amount</span>
              <span className="text-[#ffd700] font-bold text-2xl">
                {currentCurrency.symbol}{paymentDetails.amount?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Bank</span>
              <span className="text-white font-semibold">Paystack Virtual Bank</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-white/60">Account Number</span>
              <span className="text-white font-mono font-bold text-xl tracking-wider">
                {paymentDetails.reference?.slice(0, 10).toUpperCase() || 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-white/60">Reference</span>
              <span className="text-white/50 text-xs font-mono">{paymentDetails.reference}</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#7dd3c0]/10 rounded-xl border border-[#7dd3c0]/30">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#7dd3c0] mt-2 animate-pulse" />
              <div>
                <p className="text-[#7dd3c0] font-medium text-sm">Waiting for payment...</p>
                <p className="text-white/60 text-xs mt-1">
                  Make a bank transfer of {currentCurrency.symbol}{paymentDetails.amount?.toLocaleString()} to the account above.
                  This page will automatically update when payment is confirmed.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={cancelPayment}
              className="flex-1 py-3 px-4 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-3 px-4 rounded-xl bg-[#ffd700] text-black font-semibold hover:bg-[#ffed4e] transition-all"
            >
              I've Paid - Refresh
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-white font-semibold mb-4">How to Pay</h3>
          <ol className="space-y-3 text-white/60 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span>Open your bank app (Bank app, USSD, or visit bank)</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span>Transfer {currentCurrency.symbol}{paymentDetails.amount?.toLocaleString()} to the account number above</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span>Wait for confirmation (usually 1-5 minutes)</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
              <span>Your plan will be automatically activated!</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white">Upgrade Your Plan</h1>
        <p className="text-white/60 max-w-2xl mx-auto">
          Choose the perfect plan for your school. Unlock more features and scale as you grow.
        </p>
        
        {/* Currency Selector */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-white/60 text-sm">Currency:</span>
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-[#ffd700] focus:outline-none"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-gradient-to-r from-[#ffd700]/10 via-[#7dd3c0]/10 to-[#ffd700]/10 rounded-2xl p-6 border border-[#ffd700]/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/60 text-sm">Current Plan</p>
            <p className="text-white font-semibold text-xl flex items-center gap-2">
              {subscription?.plan || 'Free'}
              {subscription?.status === 'active' && (
                <span className="text-xs bg-[#7dd3c0]/20 text-[#7dd3c0] px-2 py-0.5 rounded-full">Active</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Expiry Date</p>
            <p className="text-white font-semibold">{formatDate(subscription?.endDate)}</p>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan: any) => {
          const Icon = getPlanIcon(plan.name);
          const isCurrentPlan = subscription?.plan === plan.name;
          const currentCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
          
          return (
            <div
              key={plan.name}
              className={`
                relative rounded-2xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl
                ${plan.name === 'Professional' ? 'bg-gradient-to-br from-[#7dd3c0]/20 via-[#5fb3a0]/10 to-transparent' : 'bg-white/5'}
                ${plan.name === 'Professional' ? 'border-[#7dd3c0]/30' : 'border-white/10'}
                ${plan.name === 'Professional' ? 'ring-2 ring-[#ffd700] ring-offset-2 ring-offset-[#4a4f55]' : ''}
              `}
            >
              {plan.name === 'Professional' && (
                <div className="absolute top-0 right-0">
                  <div className="bg-[#ffd700] text-black text-xs font-bold px-3 py-1 rounded-bl-xl">
                    POPULAR
                  </div>
                </div>
              )}

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    plan.name === 'Professional' ? 'bg-[#ffd700] text-black' : 'bg-white/10 text-white'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                    <p className="text-white/50 text-xs">
                      {plan.name === 'Free' ? 'Try before you buy' : 
                       plan.name === 'Enterprise' ? 'For large institutions' : '3 months term'}
                    </p>
                  </div>
                </div>

                <div className="py-4 border-t border-white/10">
                  {plan.price === 0 || plan.price === null ? (
                    <div className="text-white font-bold text-2xl">
                      {plan.name === 'Enterprise' ? 'Custom' : 'Free'}
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-white font-bold text-3xl">{currentCurrency.symbol}{plan.price?.toLocaleString()}</span>
                      <span className="text-white/50 text-sm">/term</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 pt-4 border-t border-white/10">
                  {(PLAN_FEATURES[plan.name]?.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                      <Check className="w-4 h-4 text-[#7dd3c0] flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                  {(PLAN_FEATURES[plan.name]?.notIncluded || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-white/30 text-sm line-through">
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.name)}
                  disabled={isProcessing === plan.name || isCurrentPlan || plan.name === 'Free'}
                  className={`
                    w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300
                    ${plan.name === 'Professional' 
                      ? 'bg-[#ffd700] text-black hover:bg-[#ffed4e]' 
                      : isCurrentPlan || plan.name === 'Free'
                        ? 'bg-white/10 text-white/50 cursor-not-allowed'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }
                    disabled:opacity-50
                  `}
                >
                  {isProcessing === plan.name ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.name === 'Free' ? (
                    'Free'
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-white font-semibold mb-4">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-white/80 text-sm font-medium">How do I pay?</p>
            <p className="text-white/50 text-xs">Select a plan and you'll receive bank transfer details. Transfer the amount and your plan activates automatically.</p>
          </div>
          <div className="space-y-2">
            <p className="text-white/80 text-sm font-medium">How long does activation take?</p>
            <p className="text-white/50 text-xs">Usually 1-5 minutes after bank transfer. You'll see a confirmation on screen.</p>
          </div>
          <div className="space-y-2">
            <p className="text-white/80 text-sm font-medium">Can I get a refund?</p>
            <p className="text-white/50 text-xs">Yes, contact us within 30 days of payment for a full refund.</p>
          </div>
          <div className="space-y-2">
            <p className="text-white/80 text-sm font-medium">What happens when my term ends?</p>
            <p className="text-white/50 text-xs">You'll be notified 7 days before. You can renew anytime to continue your plan.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Page - School Setup Wizard
function SettingsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [setupStatus, setSetupStatus] = useState<'incomplete' | 'complete' | 'loading'>('loading');
  const [, setSchoolInfo] = useState<any>(null);
  const [, setTerms] = useState<any[]>([]);
  const schoolId = user?.schoolId;

  // Show error if no schoolId (not logged in properly)
  if (!schoolId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400">Error: Unable to load school information. Please log out and log in again.</p>
        </div>
      </div>
    );
  }

  // Fetch setup status, school info and terms on mount
  useEffect(() => {
    const fetchSettingsData = async () => {
      try {
        const [schoolRes, termsRes] = await Promise.all([
          authService.getSchoolInfo(),
          authService.getTerms()
        ]);
        
        if (schoolRes.success) {
          setSchoolInfo(schoolRes.data);
          setSetupStatus(schoolRes.data.setupStatus === 'COMPLETED' ? 'complete' : 'incomplete');
        }
        
        if (termsRes.success) {
          setTerms(termsRes.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setSetupStatus('incomplete');
      }
    };
    
    fetchSettingsData();
  }, [schoolId]);

  if (showWizard) {
    return (
      <AdminSetupWizard
        schoolId={schoolId}
        onComplete={() => {
          setShowWizard(false);
          setSetupStatus('complete');
          // Refresh school info
          authService.getSchoolInfo().then(res => {
            if (res.success) setSchoolInfo(res.data);
          });
        }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">School Settings</h2>
          <p className="text-gray-400 mt-1">Configure your school setup and preferences</p>
        </div>
        {setupStatus === 'incomplete' && (
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#ffd700] hover:bg-[#ffed4e] text-black font-semibold rounded-xl transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Complete Setup
          </button>
        )}
      </div>

      {/* Setup Status Card */}
      <div className={`rounded-2xl p-6 border ${
        setupStatus === 'complete'
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-yellow-500/10 border-yellow-500/20'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            setupStatus === 'complete' ? 'bg-green-500' : 'bg-yellow-500'
          }`}>
            {setupStatus === 'complete' ? (
              <CheckCircle className="w-6 h-6 text-white" />
            ) : (
              <AlertCircle className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">
              {setupStatus === 'complete' ? 'Setup Complete' : 'Setup Incomplete'}
            </h3>
            <p className="text-gray-400 text-sm">
              {setupStatus === 'complete'
                ? 'Your school is fully configured and ready to use'
                : 'Complete your school setup to unlock all features'}
            </p>
          </div>
          {setupStatus === 'incomplete' && (
            <button
              onClick={() => setShowWizard(true)}
              className="text-[#ffd700] hover:text-[#ffed4e] font-medium"
            >
              Continue →
            </button>
          )}
        </div>
      </div>

      {/* Quick Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* School Info */}
        <button
          onClick={() => setShowWizard(true)}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <School className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">School Information</h3>
          </div>
          <p className="text-gray-400 text-sm">Name, address, contact details</p>
        </button>

        {/* Academic Terms */}
        <button
          onClick={() => setShowWizard(true)}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">Academic Terms</h3>
          </div>
          <p className="text-gray-400 text-sm">Term dates and academic calendar</p>
        </button>

        {/* Grading Config */}
        <button
          onClick={() => setShowWizard(true)}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">Grading Configuration</h3>
          </div>
          <p className="text-gray-400 text-sm">Custom assessment pillars and scales</p>
        </button>

        {/* Classes & Subjects */}
        <button
          onClick={() => setShowWizard(true)}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">Classes & Subjects</h3>
          </div>
          <p className="text-gray-400 text-sm">School universe configuration</p>
        </button>

        {/* Teachers */}
        <button
          onClick={() => onNavigate('users')}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">Teachers</h3>
          </div>
          <p className="text-gray-400 text-sm">Manage teacher accounts</p>
        </button>

        {/* WhatsApp Connection */}
        <button
          onClick={() => onNavigate('connect')}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd700]/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-[#ffd700]" />
            </div>
            <h3 className="text-white font-medium">WhatsApp Connection</h3>
          </div>
          <p className="text-gray-400 text-sm">Connect school WhatsApp number</p>
        </button>
      </div>
    </div>
  );
}

// Profile Page
function ProfilePage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [, setProfileData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.userId) return;
      
      try {
        const response = await authService.request('/auth/me', { method: 'GET' }) as { success: boolean; data: any };
        if (response.success) {
          setProfileData(response.data);
          setName(response.data.name || '');
          setEmail(response.data.email || '');
          setPhone(response.data.phone || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user?.userId]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await authService.updateProfile({ name, email }) as { success: boolean; error?: string };
      if (response.success) {
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await authService.changePassword(currentPassword, newPassword) as { success: boolean; error?: string };
      if (response.success) {
        setSuccessMessage('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.error || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#ffd700] animate-spin" />
      </div>
    );
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'A';
  const roleLabel = user?.role === 'admin' ? 'Administrator' : user?.role === 'teacher' ? 'Teacher' : 'Parent';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-[#ffd700] to-[#ffed4e] rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-black text-3xl font-bold">{initials}</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center justify-center gap-1">
          {name || 'User'}
          <VerifiedBadge className="w-6 h-6" />
        </h2>
        <p className="text-white/50">{email || phone || 'No email'}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="px-3 py-1 bg-[#ffd700]/20 text-[#ffd700] rounded-full text-sm font-medium">{roleLabel}</span>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Personal Information</h3>
        <form onSubmit={handleProfileUpdate}>
          <div className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">WhatsApp Number</label>
              <input 
                type="tel" 
                value={phone}
                disabled
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white/50 cursor-not-allowed" 
              />
              <p className="text-white/30 text-xs mt-1">Phone number cannot be changed</p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button 
              type="submit" 
              disabled={isUpdating}
              className="bg-[#ffd700] text-black px-8 py-3 rounded-xl font-semibold hover:bg-[#ffed4e] transition-all disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>

        <div className="border-t border-white/10 pt-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-6">Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none" 
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-2">Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ffd700] focus:outline-none" 
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button 
                type="submit" 
                disabled={isUpdating || !currentPassword || !newPassword}
                className="bg-white/10 text-white border border-white/20 px-8 py-3 rounded-xl font-semibold hover:bg-white/20 transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main App
function App() {
  // Wake up Render backend when frontend is accessed
  useEffect(() => {
    const wakeUpRender = async () => {
      try {
        // Get the API URL from env or construct it
        const apiUrl = import.meta.env.VITE_API_URL || 'https://kumo-api.onrender.com/api';
        // Ping health endpoint - non-blocking, just wake up Render
        fetch(`${apiUrl}/health`, { 
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache'
        }).catch(() => {}); // Ignore errors - just wake up Render
      } catch (e) {
        // Ignore errors
      }
    };
    wakeUpRender();
  }, []);
  // Check URL for direct access routes
  const getPageFromUrl = () => {
    const path = window.location.pathname.replace('/', '');
    if (['dashboard', 'users', 'academics', 'reports', 'analytics', 'settings', 'profile', 'connect'].includes(path)) {
      return path;
    }
    return 'landing';
  };

  const [currentPage, setCurrentPage] = useState<string>(getPageFromUrl());

  const navigateTo = (page: string) => {
    console.log('[App] navigateTo called with page:', page);
    setCurrentPage(page);
    // Update URL without page reload for dashboard pages
    if (['dashboard', 'users', 'academics', 'reports', 'analytics', 'settings', 'profile', 'connect'].includes(page)) {
      window.history.pushState({}, '', `/${page}`);
    } else {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo(0, 0);
    console.log('[App] Navigation complete, currentPage set to:', page);
  };

// Dashboard pages
  if (['dashboard', 'users', 'academics', 'reports', 'analytics', 'settings', 'profile', 'connect', 'recharge'].includes(currentPage)) {
    console.log('[App] Rendering dashboard page:', currentPage);
    return (
      <ProtectedRoute onNavigate={navigateTo}>
        <DashboardLayout currentPage={currentPage} onNavigate={navigateTo}>
          {currentPage === 'dashboard' && <DashboardOverview onNavigate={navigateTo} />}
          {currentPage === 'recharge' && <RechargePage onNavigate={navigateTo} />}
          {currentPage === 'connect' && <ConnectAI />}
          {currentPage === 'users' && <UsersPage onNavigate={navigateTo} />}
          {currentPage === 'academics' && <AcademicsPage onNavigate={navigateTo} />}
          {currentPage === 'reports' && <ReportsPage onNavigate={navigateTo} />}
          {currentPage === 'analytics' && <AnalyticsPage onNavigate={navigateTo} />}
          {currentPage === 'settings' && <SettingsPage onNavigate={navigateTo} />}
          {currentPage === 'profile' && <ProfilePage onNavigate={navigateTo} />}
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // Render different pages based on current state
  switch (currentPage) {
    case 'signup':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <SignupPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'login':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <LoginPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'contact':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <ContactPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'docs':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <DocumentationPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'faqs':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <FAQsPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'features':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <FeaturesPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    case 'pricing':
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <PricingPage onNavigate={navigateTo} />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
    default:
      // Landing page
      return (
        <div className="min-h-screen bg-[#4a4f55]">
          <Navigation onNavigate={navigateTo} />
          <main>
            <HeroSection onNavigate={navigateTo} />
            <FeaturesSection />
            <HowItWorksSection />
            <VisionMissionSection />
            <PricingSection />
            <CTASection />
          </main>
          <Footer />
          <ChatSupportWidget />
          <WhatsAppSupportWidget />
        </div>
      );
  }
}

export default App;
