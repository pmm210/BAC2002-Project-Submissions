const pool = require("../config/db");

const User = {
    async createUser(email, username, hashedPassword) {
        try {
            const result = await pool.query(
                "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *",
                [email, username, hashedPassword]
            );
            return result.rows[0];
        } catch (error) {
            console.error("Database error creating user:", error);
            // Check for specific PostgreSQL error codes
            if (error.code === '23505') { // Unique violation
                if (error.constraint.includes('email')) {
                    throw new Error("Email already exists");
                } else if (error.constraint.includes('username')) {
                    // This should not happen after removing the constraint
                    throw new Error("There is still a database constraint on usernames");
                }
            }
            throw error;
        }
    },

    async getUserByEmail(email) {
        try {
            const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
            return result.rows[0];
        } catch (error) {
            console.error("Database error getting user by email:", error);
            throw error;
        }
    },

    // This function is kept for reference but won't be used to check uniqueness
    async getUserByUsername(username) {
        try {
            const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            return result.rows[0];
        } catch (error) {
            console.error("Database error getting user by username:", error);
            throw error;
        }
    },

    async getUserById(userId) {
        try {
            const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
            return result.rows[0];
        } catch (error) {
            console.error("Database error getting user by ID:", error);
            throw error;
        }
    }
};

module.exports = User;