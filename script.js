/**
 * Offline Calorie Calculator PWA
 * TDEE Calculator using Mifflin-St Jeor equation
 */

// ===== APPLICATION STATE =====
const AppState = {
    isMetric: true,
    isCalculating: false,
    lastCalculation: null,
    form: null,
    elements: {}
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
    /**
     * Convert pounds to kilograms
     */
    lbsToKg: (lbs) => lbs * 0.453592,
    
    /**
     * Convert kilograms to pounds
     */
    kgToLbs: (kg) => kg * 2.204623,
    
    /**
     * Convert feet and inches to centimeters
     */
    feetInchesToCm: (feet, inches) => (feet * 12 + inches) * 2.54,
    
    /**
     * Convert centimeters to feet and inches
     */
    cmToFeetInches: (cm) => {
        const totalInches = cm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        return { feet, inches };
    },
    
    /**
     * Debounce function calls
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Format number for display
     */
    formatNumber: (num, decimals = 0) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },
    
    /**
     * Animate number changes
     */
    animateNumber: (element, from, to, duration = 1000) => {
        const start = performance.now();
        const step = (timestamp) => {
            const progress = Math.min((timestamp - start) / duration, 1);
            const current = from + (to - from) * progress;
            element.textContent = Utils.formatNumber(current);
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }
};

// ===== VALIDATION FUNCTIONS =====
const Validation = {
    /**
     * Validate age input
     */
    validateAge: (age) => {
        const num = parseInt(age);
        if (!age || isNaN(num)) {
            return 'Age is required';
        }
        if (num < 1 || num > 105) {
            return 'Age must be between 1 and 105 years';
        }
        return null;
    },
    
    /**
     * Validate gender selection
     */
    validateGender: (gender) => {
        if (!gender) {
            return 'Please select your gender';
        }
        if (!['male', 'female'].includes(gender)) {
            return 'Please select a valid gender';
        }
        return null;
    },
    
    /**
     * Validate height input
     */
    validateHeight: (height, isMetric, feet = null, inches = null) => {
        if (isMetric) {
            const num = parseFloat(height);
            if (!height || isNaN(num)) {
                return 'Height is required';
            }
            if (num < 50 || num > 300) {
                return 'Height must be between 50 and 300 cm';
            }
        } else {
            const feetNum = parseInt(feet);
            const inchesNum = parseInt(inches);
            if (!feet || isNaN(feetNum)) {
                return 'Feet is required';
            }
            if (!inches || isNaN(inchesNum)) {
                return 'Inches is required';
            }
            if (feetNum < 1 || feetNum > 9) {
                return 'Feet must be between 1 and 9';
            }
            if (inchesNum < 0 || inchesNum > 11) {
                return 'Inches must be between 0 and 11';
            }
        }
        return null;
    },
    
    /**
     * Validate weight input
     */
    validateWeight: (weight, isMetric) => {
        const num = parseFloat(weight);
        if (!weight || isNaN(num)) {
            return 'Weight is required';
        }
        
        if (isMetric) {
            if (num < 20 || num > 500) {
                return 'Weight must be between 20 and 500 kg';
            }
        } else {
            if (num < 44 || num > 1100) {
                return 'Weight must be between 44 and 1100 lbs';
            }
        }
        return null;
    },
    
    /**
     * Validate activity level
     */
    validateActivityLevel: (activityLevel) => {
        if (!activityLevel) {
            return 'Please select your activity level';
        }
        const validLevels = ['1.2', '1.375', '1.55', '1.725', '1.9'];
        if (!validLevels.includes(activityLevel)) {
            return 'Please select a valid activity level';
        }
        return null;
    }
};

// ===== CALCULATOR FUNCTIONS =====
const Calculator = {
    /**
     * Calculate BMR using Mifflin-St Jeor equation
     */
    calculateBMR: (weight, height, age, gender) => {
        // Mifflin-St Jeor equation:
        // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
        // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
        
        const baseBMR = 10 * weight + 6.25 * height - 5 * age;
        return gender === 'male' ? baseBMR + 5 : baseBMR - 161;
    },
    
    /**
     * Calculate TDEE (Total Daily Energy Expenditure)
     */
    calculateTDEE: (bmr, activityLevel) => {
        return bmr * parseFloat(activityLevel);
    },
    
    /**
     * Calculate weight management goals
     */
    calculateWeightGoals: (tdee) => {
        return {
            loss: {
                mild: tdee - 250,      // 0.5 lbs/week
                moderate: tdee - 500,  // 1 lb/week
                aggressive: tdee - 1000 // 2 lbs/week
            },
            gain: {
                mild: tdee + 250,      // 0.5 lbs/week
                moderate: tdee + 500   // 1 lb/week
            }
        };
    },
    
    /**
     * Main calculation function
     */
    calculate: (formData) => {
        try {
            // Convert units to metric if needed
            let weight = parseFloat(formData.weight);
            let height;
            
            if (AppState.isMetric) {
                height = parseFloat(formData.height);
            } else {
                // Convert imperial to metric
                weight = Utils.lbsToKg(weight);
                height = Utils.feetInchesToCm(
                    parseInt(formData.heightFeet), 
                    parseInt(formData.heightInches)
                );
            }
            
            const age = parseInt(formData.age);
            const gender = formData.gender;
            const activityLevel = formData.activityLevel;
            
            // Calculate BMR and TDEE
            const bmr = Calculator.calculateBMR(weight, height, age, gender);
            const tdee = Calculator.calculateTDEE(bmr, activityLevel);
            const goals = Calculator.calculateWeightGoals(tdee);
            
            return {
                bmr: Math.round(bmr),
                tdee: Math.round(tdee),
                goals,
                inputs: { weight, height, age, gender, activityLevel }
            };
        } catch (error) {
            console.error('Calculation error:', error);
            throw new Error('Failed to calculate results. Please check your inputs.');
        }
    }
};

// ===== UI FUNCTIONS =====
const UI = {
    /**
     * Show/hide loading state
     */
    setLoading: (isLoading) => {
        const btn = AppState.elements.calculateBtn;
        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
        AppState.isCalculating = isLoading;
    },
    
    /**
     * Show form validation error
     */
    showFieldError: (fieldName, message) => {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const inputElement = document.getElementById(fieldName) || 
                            document.querySelector(`input[name="${fieldName}"]`);
        
        if (errorElement) {
            errorElement.textContent = message;
        }
        
        if (inputElement) {
            inputElement.classList.add('error');
            inputElement.classList.remove('success');
        }
    },
    
    /**
     * Clear form validation error
     */
    clearFieldError: (fieldName) => {
        const errorElement = document.getElementById(`${fieldName}-error`);
        const inputElement = document.getElementById(fieldName) || 
                            document.querySelector(`input[name="${fieldName}"]`);
        
        if (errorElement) {
            errorElement.textContent = '';
        }
        
        if (inputElement) {
            inputElement.classList.remove('error');
            inputElement.classList.add('success');
        }
    },
    
    /**
     * Clear all form errors
     */
    clearAllErrors: () => {
        const errorElements = document.querySelectorAll('.input-error');
        const inputElements = document.querySelectorAll('.input-field');
        
        errorElements.forEach(el => el.textContent = '');
        inputElements.forEach(el => {
            el.classList.remove('error', 'success');
        });
    },
    
    /**
     * Show notification toast
     */
    showToast: (message, type = 'info') => {
        const toast = AppState.elements.toast;
        const messageEl = AppState.elements.toastMessage;
        const iconEl = toast.querySelector('.toast__icon');
        
        // Set message and icon
        messageEl.textContent = message;
        
        // Set type-specific styling and icon
        toast.className = 'toast';
        toast.classList.add(type);
        
        switch (type) {
            case 'success':
                iconEl.textContent = '✅';
                break;
            case 'error':
                iconEl.textContent = '❌';
                break;
            case 'warning':
                iconEl.textContent = '⚠️';
                break;
            default:
                iconEl.textContent = 'ℹ️';
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    },
    
    /**
     * Display calculation results
     */
    displayResults: (results) => {
        const { bmr, tdee, goals } = results;
        
        // Show results section
        AppState.elements.resultsSection.style.display = 'block';
        
        // Animate BMR result
        const bmrValueEl = AppState.elements.bmrResult.querySelector('.result-value');
        Utils.animateNumber(bmrValueEl, 0, bmr, 1000);
        
        // Animate TDEE result
        const tdeeValueEl = AppState.elements.tdeeResult.querySelector('.result-value');
        Utils.animateNumber(tdeeValueEl, 0, tdee, 1200);
        
        // Update weight goals
        setTimeout(() => {
            document.getElementById('loss-mild').textContent = `${Utils.formatNumber(goals.loss.mild)} cal/day`;
            document.getElementById('loss-moderate').textContent = `${Utils.formatNumber(goals.loss.moderate)} cal/day`;
            document.getElementById('loss-aggressive').textContent = `${Utils.formatNumber(goals.loss.aggressive)} cal/day`;
            document.getElementById('gain-mild').textContent = `${Utils.formatNumber(goals.gain.mild)} cal/day`;
            document.getElementById('gain-moderate').textContent = `${Utils.formatNumber(goals.gain.moderate)} cal/day`;
        }, 800);
        
        // Scroll to results
        AppState.elements.resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        
        // Store last calculation
        AppState.lastCalculation = results;
        
        // Show success message
        UI.showToast('Calculation completed successfully!', 'success');
    },
    
    /**
     * Reset calculator to initial state
     */
    resetCalculator: () => {
        // Clear form
        AppState.form.reset();
        
        // Clear errors
        UI.clearAllErrors();
        
        // Hide results
        AppState.elements.resultsSection.style.display = 'none';
        
        // Reset state
        AppState.lastCalculation = null;
        
        // Focus first input
        document.getElementById('age').focus();
        
        // Show info message
        UI.showToast('Calculator reset. Ready for new calculation.', 'info');
    },
    
    /**
     * Toggle unit system
     */
    toggleUnits: () => {
        AppState.isMetric = !AppState.isMetric;
        
        // Update toggle switch
        const toggleSwitch = AppState.elements.unitToggle;
        toggleSwitch.setAttribute('aria-checked', AppState.isMetric ? 'false' : 'true');
        
        // Update labels
        const metricLabel = document.querySelector('.toggle-switch__label--metric');
        const imperialLabel = document.querySelector('.toggle-switch__label--imperial');
        
        if (AppState.isMetric) {
            metricLabel.classList.add('toggle-switch__label--active');
            imperialLabel.classList.remove('toggle-switch__label--active');
        } else {
            metricLabel.classList.remove('toggle-switch__label--active');
            imperialLabel.classList.add('toggle-switch__label--active');
        }
        
        // Update input labels and placeholders
        UI.updateInputLabels();
        
        // Show conversion message
        const system = AppState.isMetric ? 'metric' : 'imperial';
        UI.showToast(`Switched to ${system} units`, 'info');
    },
    
    /**
     * Update input labels based on unit system
     */
    updateInputLabels: () => {
        const heightLabel = document.querySelector('.height-label-text');
        const weightLabel = document.querySelector('.weight-label-text');
        const heightInput = document.getElementById('height');
        const imperialHeight = document.querySelector('.imperial-height');
        
        if (AppState.isMetric) {
            heightLabel.textContent = 'Height (cm)';
            weightLabel.textContent = 'Weight (kg)';
            heightInput.style.display = 'block';
            imperialHeight.style.display = 'none';
            heightInput.placeholder = 'e.g., 175';
            document.getElementById('weight').placeholder = 'e.g., 70';
        } else {
            heightLabel.textContent = 'Height';
            weightLabel.textContent = 'Weight (lbs)';
            heightInput.style.display = 'none';
            imperialHeight.style.display = 'flex';
            document.getElementById('height-feet').placeholder = 'ft';
            document.getElementById('height-inches').placeholder = 'in';
            document.getElementById('weight').placeholder = 'e.g., 154';
        }
    }
};

// ===== EVENT HANDLERS =====
const EventHandlers = {
    /**
     * Handle form submission
     */
    handleFormSubmit: async (event) => {
        event.preventDefault();
        
        if (AppState.isCalculating) return;
        
        // Clear previous errors
        UI.clearAllErrors();
        
        // Get form data
        const formData = new FormData(AppState.form);
        const data = {
            age: formData.get('age'),
            gender: formData.get('gender'),
            height: formData.get('height'),
            heightFeet: formData.get('height-feet'),
            heightInches: formData.get('height-inches'),
            weight: formData.get('weight'),
            activityLevel: formData.get('activity-level')
        };
        
        // Validate inputs
        let hasErrors = false;
        
        // Validate age
        const ageError = Validation.validateAge(data.age);
        if (ageError) {
            UI.showFieldError('age', ageError);
            hasErrors = true;
        }
        
        // Validate gender
        const genderError = Validation.validateGender(data.gender);
        if (genderError) {
            UI.showFieldError('gender', genderError);
            hasErrors = true;
        }
        
        // Validate height
        const heightError = Validation.validateHeight(
            data.height, 
            AppState.isMetric, 
            data.heightFeet, 
            data.heightInches
        );
        if (heightError) {
            UI.showFieldError('height', heightError);
            hasErrors = true;
        }
        
        // Validate weight
        const weightError = Validation.validateWeight(data.weight, AppState.isMetric);
        if (weightError) {
            UI.showFieldError('weight', weightError);
            hasErrors = true;
        }
        
        // Validate activity level
        const activityError = Validation.validateActivityLevel(data.activityLevel);
        if (activityError) {
            UI.showFieldError('activity-level', activityError);
            hasErrors = true;
        }
        
        if (hasErrors) {
            UI.showToast('Please correct the errors above', 'error');
            return;
        }
        
        try {
            // Show loading state
            UI.setLoading(true);
            
            // Simulate calculation delay for better UX
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Calculate results
            const results = Calculator.calculate(data);
            
            // Display results
            UI.displayResults(results);
            
        } catch (error) {
            console.error('Calculation failed:', error);
            UI.showToast(error.message || 'Calculation failed. Please try again.', 'error');
        } finally {
            UI.setLoading(false);
        }
    },
    
    /**
     * Handle unit toggle click
     */
    handleUnitToggle: (event) => {
        if (event.type === 'click' || (event.type === 'keydown' && event.key === 'Enter')) {
            UI.toggleUnits();
        }
    },
    
    /**
     * Handle reset button click
     */
    handleReset: () => {
        UI.resetCalculator();
    },
    
    /**
     * Handle toast close
     */
    handleToastClose: () => {
        AppState.elements.toast.classList.remove('show');
    },
    
    /**
     * Handle input validation on blur
     */
    handleInputValidation: Utils.debounce((event) => {
        const { name, value } = event.target;
        
        // Clear previous error for this field
        UI.clearFieldError(name);
        
        // Don't validate empty fields on blur
        if (!value.trim()) return;
        
        let error = null;
        
        switch (name) {
            case 'age':
                error = Validation.validateAge(value);
                break;
            case 'height':
                error = Validation.validateHeight(value, AppState.isMetric);
                break;
            case 'weight':
                error = Validation.validateWeight(value, AppState.isMetric);
                break;
        }
        
        if (error) {
            UI.showFieldError(name, error);
        }
    }, 300)
};

// ===== INITIALIZATION =====
const App = {
    /**
     * Initialize the application
     */
    init: () => {
        // Cache DOM elements
        AppState.form = document.getElementById('calorie-form');
        AppState.elements = {
            unitToggle: document.querySelector('.toggle-switch'),
            calculateBtn: document.getElementById('calculate-btn'),
            resetBtn: document.getElementById('reset-btn'),
            resultsSection: document.getElementById('results-section'),
            bmrResult: document.getElementById('bmr-result'),
            tdeeResult: document.getElementById('tdee-result'),
            toast: document.getElementById('notification-toast'),
            toastMessage: document.getElementById('toast-message')
        };
        
        // Set up event listeners
        App.setupEventListeners();
        
        // Initialize UI state
        UI.updateInputLabels();
        
        // Register service worker for PWA
        App.registerServiceWorker();
        
        // Show welcome message
        UI.showToast('Welcome! Calculator is ready to use offline.', 'success');
        
        console.log('Calorie Calculator PWA initialized successfully');
    },
    
    /**
     * Set up all event listeners
     */
    setupEventListeners: () => {
        // Form submission
        AppState.form.addEventListener('submit', EventHandlers.handleFormSubmit);
        
        // Unit toggle
        AppState.elements.unitToggle.addEventListener('click', EventHandlers.handleUnitToggle);
        AppState.elements.unitToggle.addEventListener('keydown', EventHandlers.handleUnitToggle);
        
        // Reset button
        AppState.elements.resetBtn.addEventListener('click', EventHandlers.handleReset);
        
        // Toast close button
        const toastClose = AppState.elements.toast.querySelector('.toast__close');
        toastClose.addEventListener('click', EventHandlers.handleToastClose);
        
        // Input validation
        const validateInputs = ['age', 'height', 'weight'];
        validateInputs.forEach(name => {
            const input = document.getElementById(name);
            if (input) {
                input.addEventListener('blur', EventHandlers.handleInputValidation);
            }
        });
        
        // Imperial height inputs validation
        document.getElementById('height-feet').addEventListener('blur', EventHandlers.handleInputValidation);
        document.getElementById('height-inches').addEventListener('blur', EventHandlers.handleInputValidation);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + R to reset (prevent default page reload)
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                UI.resetCalculator();
            }
            
            // Escape to close toast
            if (event.key === 'Escape') {
                AppState.elements.toast.classList.remove('show');
            }
        });
    },
    
    /**
     * Register service worker for PWA functionality
     */
    registerServiceWorker: async () => {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration.scope);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }
};

// ===== APPLICATION STARTUP =====
// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
} else {
    App.init();
} 