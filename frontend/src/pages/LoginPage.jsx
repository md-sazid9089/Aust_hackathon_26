/*
 * Login Page — Full-Screen Authentication
 * ========================================
 * Minimalist login interface with email/password, social auth,
 * form validation, accessibility, animations, and error handling.
 *
 * Features:
 *   - Full-screen responsive design with background overlay
 *   - Email & password validation with real-time feedback
 *   - Password visibility toggle
 *   - Social login (Google, GitHub)
 *   - Loading spinner during submission
 *   - Error message display
 *   - Keyboard accessibility & screen reader support
 *   - Smooth fade-in animations
 */

import { useState } from 'react';
import { Eye, EyeOff, Loader2, AlertCircle, ChevronLeft } from 'lucide-react';

export default function LoginPage({ onNavigateToHome, onNavigateToSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // ── Form Validation ──────────────────────────────────────────
  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form Submission ──────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await loginUser({ email, password });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Success - redirect or update auth state
      console.log('Login successful:', { email, password });
      
      // Example: localStorage.setItem('token', response.token);
      // Example: navigate('/map');
    } catch (error) {
      setApiError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Social Login Handlers ────────────────────────────────────
  const handleSocialLogin = (provider) => {
    console.log(`Login with ${provider}`);
    // TODO: Implement OAuth flows for Google and GitHub
  };

  const isFormValid = validateEmail(email) && password.length >= 8;

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex">
      {/* ═══ LEFT SIDE — BACKGROUND IMAGE WITH OVERLAY ═══════════════ */}
      <div className="hidden md:flex md:w-1/2 relative">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect fill="%230a0d14" width="1000" height="1000"/><defs><filter id="blur"><feGaussianBlur in="SourceGraphic" stdDeviation="3" /></filter><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="%231e293b" stroke-width="0.5"/></pattern><radialGradient id="grad" cx="40%" cy="40%"><stop offset="0%25" style="stop-color:%238b5cf6;stop-opacity:0.15" /><stop offset="100%25" style="stop-color:%236366f1;stop-opacity:0.05" /></radialGradient></defs><rect width="1000" height="1000" fill="url(%23grid)"/><rect width="1000" height="1000" fill="url(%23grad)"/><circle cx="300" cy="200" r="200" fill="%238b5cf6" opacity="0.12" filter="url(%23blur)"/><circle cx="700" cy="800" r="250" fill="%236366f1" opacity="0.10" filter="url(%23blur)"/><path d="M 0 400 Q 250 300 500 400 T 1000 400" stroke="%236366f1" stroke-width="1" fill="none" opacity="0.1"/></svg>')`,
            backgroundAttachment: 'fixed',
            filter: 'blur(2px)',
          }}
        />
        
        {/* Dark overlay on left */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/0" />
        
        {/* Content on left side */}
        <div className="relative z-10 flex flex-col justify-center items-start p-12 max-w-sm">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
              Welcome to <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">GoliTransit</span>
            </h1>
            <p className="text-slate-300 text-lg mb-6">
              Multi-modal hyper-local routing engine for seamless urban mobility
            </p>
          </div>
          
          {/* Features list */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-slate-300">Smart routing technology</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-slate-300">Real-time traffic insights</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-slate-300">Sustainable commute options</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SIDE — LOGIN FORM ═══════════════════════════════ */}
      <div className="w-full md:w-1/2 bg-slate-950/95 relative overflow-y-auto">
        {/* Background pattern for right side */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="%23ffffff"/></pattern></defs><rect width="100" height="100" fill="url(%23dots)"/></svg>')`,
          }}
        />

        {/* Form Container */}
        <div className="relative z-10 flex flex-col justify-center min-h-screen px-8 py-12 md:px-12 animate-fade-in">
        
        {/* Back Button */}
        <button
          onClick={() => onNavigateToHome && onNavigateToHome()}
          className="mb-8 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors group w-fit"
          aria-label="Go back to home"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Form Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 mb-4">
            <span className="text-xl font-bold text-white">⬡</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
          <p className="text-slate-400 text-sm">Access your GoliTransit routing dashboard</p>
        </div>

        {/* Horizontal line */}
        <div className="w-20 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full mb-8" />

        {/* API Error Message */}
          {apiError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 animate-slide-down">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{apiError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
            
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: '' });
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                aria-label="Enter your email"
                aria-describedby={errors.email ? 'email-error' : undefined}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 rounded-lg bg-slate-800/50 border-2 transition-all duration-200 focus:outline-none ${
                  focusedField === 'email'
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                    : errors.email
                    ? 'border-red-500/50'
                    : 'border-slate-700 hover:border-slate-600'
                } text-white placeholder-slate-500`}
              />
              {errors.email && (
                <p id="email-error" className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <span className="text-base">⚠</span>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: '' });
                  }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  aria-label="Enter your password"
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  placeholder="Minimum 8 characters"
                  className={`w-full px-4 py-3 pr-12 rounded-lg bg-slate-800/50 border-2 transition-all duration-200 focus:outline-none ${
                    focusedField === 'password'
                      ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                      : errors.password
                      ? 'border-red-500/50'
                      : 'border-slate-700 hover:border-slate-600'
                  } text-white placeholder-slate-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <span className="text-base">⚠</span>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <a
                href="#forgot-password"
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors underline-offset-2 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                isLoading || !isFormValid
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
              }`}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">OR</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Social Login Options */}
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {/* Google Button */}
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="py-3 px-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
              aria-label="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="text-sm">Google</span>
            </button>

            {/* GitHub Button */}
            <button
              type="button"
              onClick={() => handleSocialLogin('github')}
              className="py-3 px-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
              aria-label="Sign in with GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-sm">GitHub</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-slate-400 mt-6 max-w-sm">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigateToSignUp && onNavigateToSignUp()}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors underline-offset-2 hover:underline bg-none border-none p-0 cursor-pointer"
            >
              Sign up here
            </button>
          </p>

          {/* Footer Note */}
          <p className="text-center text-xs text-slate-500 mt-8">
            This is a demo. For testing, use any email and password (min 8 chars).
          </p>
        </div>
      </div>

      {/* ═══ TAILWIND ANIMATIONS (add to tailwind.config.js) ═════ */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
