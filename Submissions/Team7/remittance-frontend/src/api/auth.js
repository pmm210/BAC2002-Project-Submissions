const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const API_URL = `${API_BASE_URL}/auth`;

/**
 * Login function with improved error handling
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - Response with token and user data or error
 */
export const login = async (email, password) => {
    try {
        console.log(`Making login request to: ${API_URL}/login`);
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Login error response:", data);
            throw {
                status: response.status,
                message: data.message || "Login failed",
                response: { data }
            };
        }
        
        return data;
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
};

/**
 * Register function with improved error handling
 * @param {string} email - User email
 * @param {string} username - User username
 * @param {string} password - User password
 * @returns {Promise<Object>} - Response with success message or error
 */
export const register = async (email, username, password) => {
    try {
        console.log(`Making register request to: ${API_URL}/register`);
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, username, password }),
        });

        const data = await response.json();
        console.log("Register response:", data);
        
        if (!response.ok) {
            console.error("Register error response:", data);
            throw {
                status: response.status,
                message: data.message || data.error || "Registration failed",
                response: { data }
            };
        }
        
        return data;
    } catch (error) {
        console.error("Registration error:", error);
        throw error;
    }
};