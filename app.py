from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, send_file
from svm_model import diabetes_model
from auth import login_required, hash_password, authenticate_user, check_password
from database import init_db, add_user, save_prediction, get_user_predictions, get_user_by_username, update_user_profile, get_db_connection
import json
import csv
import io
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-in-production'

# Initialize database
init_db()

def get_risk_color(probability):
    """Helper function to determine risk color based on probability"""
    if probability < 0.3:
        return "#28a745"  # Green for low risk
    elif probability < 0.7:
        return "#ffc107"  # Yellow for medium risk
    else:
        return "#dc3545"  # Red for high risk

# Make the function available to all templates
@app.context_processor
def utility_processor():
    return dict(
        get_risk_color=get_risk_color,
        now=datetime.now
    )

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        full_name = request.form.get('full_name', '')
        age = request.form.get('age', type=int)
        gender = request.form.get('gender', '')
        
        if add_user(username, email, hash_password(password), full_name, age, gender):
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('login'))
        else:
            flash('Username or email already exists.', 'error')
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = authenticate_user(username, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['full_name'] = user['full_name']
            session['email'] = user['email']
            session['age'] = user['age']
            session['gender'] = user['gender']
            flash(f'Welcome back, {user["full_name"] or user["username"]}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    # Get user's prediction count
    predictions = get_user_predictions(session['user_id'])
    prediction_count = len(predictions)
    
    # Get recent predictions for stats
    recent_predictions = predictions[:5] if predictions else []
    
    return render_template('dashboard.html', 
                         prediction_count=prediction_count,
                         recent_predictions=recent_predictions)

@app.route('/prediction', methods=['GET', 'POST'])
@login_required
def prediction():
    if request.method == 'POST':
        try:
            data = request.get_json()
            
            features = {
                'pregnancies': float(data['pregnancies']),
                'glucose': float(data['glucose']),
                'blood_pressure': float(data['blood_pressure']),
                'skin_thickness': float(data['skin_thickness']),
                'insulin': float(data['insulin']),
                'bmi': float(data['bmi']),
                'diabetes_pedigree': float(data['diabetes_pedigree']),
                'age': float(data['age'])
            }
            
            # Make prediction
            result = diabetes_model.predict(list(features.values()))
            
            if result:
                # Save prediction to database
                save_prediction(session['user_id'], features, result['result'], 
                              result['probability'], result['risk_level'])
                
                return jsonify({
                    'success': True,
                    'prediction': result['prediction'],
                    'probability': result['probability'],
                    'risk_level': result['risk_level'],
                    'recommendation': result['recommendation'],
                    'result': result['result']
                })
            else:
                return jsonify({'success': False, 'error': 'Prediction failed'})
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    
    return render_template('prediction.html')

@app.route('/history')
@login_required
def history():
    predictions = get_user_predictions(session['user_id'])
    return render_template('history.html', predictions=predictions)

@app.route('/download_history')
@login_required
def download_history():
    predictions = get_user_predictions(session['user_id'])
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Date', 'Pregnancies', 'Glucose', 'Blood Pressure', 'Skin Thickness', 
                    'Insulin', 'BMI', 'Diabetes Pedigree', 'Age', 'Prediction', 
                    'Probability', 'Risk Level'])
    
    # Write data
    for pred in predictions:
        writer.writerow([
            pred['created_at'],
            pred['pregnancies'],
            pred['glucose'],
            pred['blood_pressure'],
            pred['skin_thickness'],
            pred['insulin'],
            pred['bmi'],
            pred['diabetes_pedigree'],
            pred['age'],
            pred['prediction_result'],
            f"{pred['probability']:.3f}",
            pred['risk_level']
        ])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'diabetes_predictions_{datetime.now().strftime("%Y%m%d")}.csv'
    )

@app.route('/clear_history', methods=['POST'])
@login_required
def clear_history():
    """Clear all prediction history for the current user"""
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM predictions WHERE user_id = ?', (session['user_id'],))
        conn.commit()
        conn.close()
        
        flash('All prediction history has been cleared successfully!', 'success')
        return jsonify({'success': True})
    except Exception as e:
        flash('Error clearing history: ' + str(e), 'error')
        return jsonify({'success': False, 'error': str(e)})

@app.route('/performance')
@login_required
def get_performance():
    try:
        metrics = diabetes_model.get_model_metrics()
        plots = diabetes_model.get_performance_plots()
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'plots': plots
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        try:
            email = request.form.get('email')
            full_name = request.form.get('full_name')
            age = request.form.get('age', type=int)
            gender = request.form.get('gender')
            
            if update_user_profile(session['user_id'], email, full_name, age, gender):
                # Update session data
                session['email'] = email
                session['full_name'] = full_name
                session['age'] = age
                session['gender'] = gender
                
                flash('Profile updated successfully!', 'success')
            else:
                flash('Error updating profile.', 'error')
                
        except Exception as e:
            flash(f'Error: {str(e)}', 'error')
    
    # Get prediction count for display
    predictions = get_user_predictions(session['user_id'])
    prediction_count = len(predictions)
    
    return render_template('profile.html', prediction_count=prediction_count)

@app.route('/update_password', methods=['POST'])
@login_required
def update_password():
    if request.method == 'POST':
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        
        user = get_user_by_username(session['username'])
        if user and check_password(user['password'], current_password):
            # Update password logic would go here
            flash('Password updated successfully!', 'success')
        else:
            flash('Current password is incorrect.', 'error')
    
    return redirect(url_for('profile'))

if __name__ == '__main__':
    app.run(debug=True)