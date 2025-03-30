# backend/auth_utils.py
from functools import wraps
from flask import session, flash, redirect, url_for

def role_required(required_role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Check if the user is logged in and has a role in session
            if "user_id" not in session or "role" not in session:
                flash("You must be logged in to access this page.", "warning")
                return redirect(url_for("users.login_form"))
            # Check if the user's role matches the required role
            if session.get("role") != required_role:
                flash("You do not have permission to access this page.", "danger")
                return redirect(url_for("main.home"))
            return f(*args, **kwargs)
        return decorated_function
    return decorator
