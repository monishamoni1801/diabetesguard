from werkzeug.security import generate_password_hash, check_password_hash
from flask import session, redirect, url_for, flash, request
from functools import wraps
from database import get_user_by_username
import re
from werkzeug.security import check_password_hash

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

def hash_password(password):
    return generate_password_hash(password)

def check_password(hashed_password, password):
    return check_password_hash(hashed_password, password)

def authenticate_user(username, password):
    user = get_user_by_username(username)
    if user and check_password(user['password'], password):
        return user
    return None

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, "Password is valid"



# Add this function to auth.py
def check_password(hashed_password, password):
    return check_password_hash(hashed_password, password)