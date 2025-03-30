document.addEventListener("DOMContentLoaded", async function () {
    try {
        const sessionResponse = await fetch("http://localhost:5000/auth/session", {
            method: "GET",
            credentials: "include",
        });

        const sessionData = await sessionResponse.json();
        const userNav = document.getElementById("userNav");
        const userDropdown = document.getElementById("userDropdown");
        const userDropdownMenu = document.getElementById("userDropdownMenu");
        const logoutBtn = document.getElementById("logoutBtn");

        if (sessionData.loggedIn && sessionData.address) {
            console.log(`✅ User logged in as: ${sessionData.address}`);

            // ✅ Update Navbar to show user wallet
            userDropdown.innerHTML = `Welcome, ${sessionData.address.substring(0, 6)}...${sessionData.address.slice(-4)}`;
            userNav.style.display = "block";

            // ✅ Handle Logout
            logoutBtn.addEventListener("click", async function () {
                const logoutResponse = await fetch("http://localhost:5000/auth/logout", {
                    method: "POST",
                    credentials: "include",
                });

                const logoutData = await logoutResponse.json();
                if (logoutData.success) {
                    alert("✅ Logged out successfully!");
                    window.location.href = "login.html"; // Redirect to login page
                }
            });

            // ✅ Toggle dropdown on click
            userDropdown.addEventListener("click", function (event) {
                event.preventDefault();
                userDropdownMenu.classList.toggle("show");
            });

        } else {
            console.warn("⚠️ No active session. Showing Login button...");
            userDropdown.innerHTML = `<a href="login.html">Login / Sign Up</a>`;
            userDropdownMenu.style.display = "none";
        }
    } catch (err) {
        console.error("❌ Error checking session:", err);
    }
});
