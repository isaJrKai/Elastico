const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Enable Cross-Origin Resource Sharing (CORS) so your front-end HTML can talk to this backend
app.use(cors());

// Configure body-parser to process JSON formats sent in requests
app.use(bodyParser.json());

const USERS_FILE = path.join(__dirname, "users.json");

// Helper function to read users safely from the file
function readUsersFromFile() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Error reading users file:", error);
    return [];
  }
}

// Helper function to write users safely back to the file
function writeUsersToFile(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing to users file:", error);
  }
}

// Secure database registration POST route
app.post("/api/register", (req, res) => {
  const { email, password } = req.body;

  // Simple validation checks
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required fields." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Load existing registered users
  const users = readUsersFromFile();

  // Check if the user's email already exists to prevent duplicates
  const userExists = users.some(u => u.email.trim().toLowerCase() === normalizedEmail);
  if (userExists) {
    return res.status(400).json({ error: "Error: A user with this email address already exists." });
  }

  // Create new user record
  const newUser = {
    email: normalizedEmail,
    password: password, // In production, never save plain-text passwords! Use bcrypt hashes.
    created_at: new Date().toISOString()
  };

  // Add the user and save
  users.push(newUser);
  writeUsersToFile(users);

  console.log(`Successfully registered: ${normalizedEmail}`);

  // Return a clear, friendly success message back to the client-side form
  return res.status(200).json({
    message: "Registration successful! Data synchronized with local file database.",
    user: { email: normalizedEmail }
  });
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`KickIQ AI Rookie Server is running smoothly on http://localhost:${PORT}`);
});
