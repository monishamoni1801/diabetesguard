document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips and interactive elements
    initApplication();
});

function initApplication() {
    // Flash message close functionality
    document.querySelectorAll('.flash-close').forEach(button => {
        button.addEventListener('click', function() {
            this.parentElement.style.display = 'none';
        });
    });

    // Auto-hide flash messages after 5 seconds
    setTimeout(() => {
        document.querySelectorAll('.flash-message').forEach(message => {
            message.style.display = 'none';
        });
    }, 5000);

    // Mobile navigation toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
        });
    }

    // Initialize prediction form if exists
    const predictionForm = document.getElementById('prediction-form');
    if (predictionForm) {
        initPredictionForm(predictionForm);
    }

    // Initialize performance loader if exists
    const loadPerformanceBtn = document.getElementById('load-performance');
    if (loadPerformanceBtn) {
        initPerformanceLoader(loadPerformanceBtn);
    }

    // Add input validation and helpful tooltips
    initInputEnhancements();
}

function initPredictionForm(form) {
    const resultsSection = document.getElementById('results');
    const loading = document.getElementById('loading');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate form inputs
        if (!validatePredictionForm()) {
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        showLoading();
        
        try {
            const response = await fetch('/prediction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                displayPredictionResult(result);
                // Reset form for new prediction
                form.reset();
            } else {
                showError('Prediction failed: ' + result.error);
            }
        } catch (error) {
            showError('Error making prediction: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // Add real-time input validation
    form.querySelectorAll('input').forEach(input => {
        input.addEventListener('blur', validateInput);
        input.addEventListener('input', updateInputHelp);
    });
}

function initPerformanceLoader(button) {
    const performanceMetrics = document.getElementById('performance-metrics');
    const loading = document.getElementById('loading');

    button.addEventListener('click', async function() {
        showLoading();
        
        try {
            const response = await fetch('/performance');
            const data = await response.json();
            
            if (data.success) {
                displayPerformanceData(data);
                performanceMetrics.style.display = 'block';
                button.style.display = 'none'; // Hide button after loading
            } else {
                showError('Error loading performance data: ' + data.error);
            }
        } catch (error) {
            showError('Error loading performance data: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

function initInputEnhancements() {
    // Add range indicators for numeric inputs
    document.querySelectorAll('input[type="number"]').forEach(input => {
        const min = input.min || 0;
        const max = input.max || 100;
        const value = input.value || min;
        
        // Create range indicator
        const indicator = document.createElement('div');
        indicator.className = 'range-indicator';
        indicator.innerHTML = `
            <div class="range-labels">
                <span>${min}</span>
                <span>Current: ${value}</span>
                <span>${max}</span>
            </div>
            <div class="range-track">
                <div class="range-progress" style="width: ${((value - min) / (max - min)) * 100}%"></div>
            </div>
        `;
        
        input.parentNode.appendChild(indicator);
        
        // Update indicator on input change
        input.addEventListener('input', function() {
            const progress = ((this.value - min) / (max - min)) * 100;
            indicator.querySelector('.range-progress').style.width = progress + '%';
            indicator.querySelector('.range-labels span:nth-child(2)').textContent = `Current: ${this.value}`;
        });
    });
}

function validatePredictionForm() {
    let isValid = true;
    const inputs = document.querySelectorAll('#prediction-form input[required]');
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            markInputInvalid(input, 'This field is required');
            isValid = false;
        } else if (!validateInputRange(input)) {
            isValid = false;
        } else {
            markInputValid(input);
        }
    });
    
    return isValid;
}

function validateInputRange(input) {
    const value = parseFloat(input.value);
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    
    if (value < min || value > max) {
        markInputInvalid(input, `Please enter a value between ${min} and ${max}`);
        return false;
    }
    
    return true;
}

function validateInput(e) {
    const input = e.target;
    
    if (!input.value.trim()) {
        markInputInvalid(input, 'This field is required');
    } else if (!validateInputRange(input)) {
        // Error already shown by validateInputRange
    } else {
        markInputValid(input);
    }
}

function markInputInvalid(input, message) {
    input.style.borderColor = '#e63946';
    input.parentNode.classList.add('error');
    
    // Remove existing error message
    const existingError = input.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.color = '#e63946';
    errorMessage.style.fontSize = '0.875rem';
    errorMessage.style.marginTop = '0.25rem';
    errorMessage.textContent = message;
    input.parentNode.appendChild(errorMessage);
}

function markInputValid(input) {
    input.style.borderColor = '#28a745';
    input.parentNode.classList.remove('error');
    
    // Remove error message
    const errorMessage = input.parentNode.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

function updateInputHelp(e) {
    const input = e.target;
    const helpText = getInputHelpText(input.name, input.value);
    
    let helpElement = input.parentNode.querySelector('.dynamic-help');
    if (!helpElement) {
        helpElement = document.createElement('div');
        helpElement.className = 'dynamic-help form-help';
        input.parentNode.appendChild(helpElement);
    }
    
    helpElement.textContent = helpText;
}

function getInputHelpText(fieldName, value) {
    const helpTexts = {
        glucose: value > 140 ? 'High glucose level detected' : 'Normal range: 70-140 mg/dL',
        blood_pressure: value > 90 ? 'Elevated blood pressure' : 'Normal range: 60-90 mmHg',
        bmi: value > 30 ? 'Considered obese' : value > 25 ? 'Considered overweight' : 'Healthy range',
        age: value > 45 ? 'Higher risk age group' : 'Lower risk age group',
        pregnancies: value > 5 ? 'Multiple pregnancies may increase risk' : 'Normal range'
    };
    
    return helpTexts[fieldName] || 'Enter a valid value';
}

function displayPredictionResult(result) {
    const resultsSection = document.getElementById('results');
    const resultText = document.getElementById('result-text');
    const riskBadge = document.getElementById('risk-badge');
    const probabilityFill = document.getElementById('probability-fill');
    const probabilityValue = document.getElementById('probability-value');
    const recommendation = document.getElementById('recommendation');
    
    // Set result text and color
    resultText.textContent = result.result;
    resultText.className = `result-text ${result.prediction === 1 ? 'text-danger' : 'text-success'}`;
    
    // Set risk badge
    riskBadge.textContent = result.risk_level + ' Risk';
    riskBadge.className = `risk-badge risk-${result.risk_level.toLowerCase()}`;
    
    // Set probability
    const probabilityPercent = (result.probability * 100).toFixed(1);
    probabilityValue.textContent = probabilityPercent + '%';
    probabilityFill.style.width = probabilityPercent + '%';
    probabilityFill.style.background = getRiskGradient(result.probability);
    
    // Set recommendation
    recommendation.textContent = result.recommendation;
    
    // Show results section with animation
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Add celebration for low risk
    if (result.risk_level === 'Low') {
        showCelebration();
    }
}

function displayPerformanceData(data) {
    const metrics = data.metrics;
    const plots = data.plots;
    
    // Display metrics
    document.getElementById('accuracy-value').textContent = 
        (metrics.accuracy * 100).toFixed(2) + '%';
    document.getElementById('auc-value').textContent = 
        metrics.roc_auc.toFixed(3);
    document.getElementById('training-date').textContent = 
        metrics.training_date;
    
    // Display plots
    document.getElementById('confusion-matrix').src = 
        'data:image/png;base64,' + plots.confusion_matrix;
    document.getElementById('roc-curve').src = 
        'data:image/png;base64,' + plots.roc_curve;
    document.getElementById('feature-importance').src = 
        'data:image/png;base64,' + plots.feature_importance;
}

function getRiskGradient(probability) {
    if (probability < 0.3) return 'linear-gradient(90deg, #28a745, #20c997)';
    if (probability < 0.7) return 'linear-gradient(90deg, #ffc107, #fd7e14)';
    return 'linear-gradient(90deg, #dc3545, #e83e8c)';
}

function showCelebration() {
    const celebration = document.createElement('div');
    celebration.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(40, 167, 69, 0.1);
        z-index: 1500;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
    `;
    
    celebration.innerHTML = `
        <div style="text-align: center; color: #28a745;">
            <i class="fas fa-check-circle" style="font-size: 4rem; margin-bottom: 1rem;"></i>
            <h3 style="font-size: 2rem;">Great News!</h3>
            <p>Low diabetes risk detected. Keep up the healthy lifestyle!</p>
        </div>
    `;
    
    document.body.appendChild(celebration);
    
    setTimeout(() => {
        celebration.remove();
    }, 3000);
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    // Create error flash message
    const flashContainer = document.querySelector('.flash-container');
    const errorMessage = document.createElement('div');
    errorMessage.className = 'flash-message error';
    errorMessage.innerHTML = `
        <span>${message}</span>
        <button class="flash-close">&times;</button>
    `;
    
    flashContainer.appendChild(errorMessage);
    
    // Add close functionality
    errorMessage.querySelector('.flash-close').addEventListener('click', function() {
        errorMessage.remove();
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorMessage.parentNode) {
            errorMessage.remove();
        }
    }, 5000);
}

// Utility function to format numbers
function formatNumber(value, decimals = 2) {
    return parseFloat(value).toFixed(decimals);
}

// Export functions for global access
window.DiabetesApp = {
    validatePredictionForm,
    displayPredictionResult,
    showError,
    showLoading,
    hideLoading
};
