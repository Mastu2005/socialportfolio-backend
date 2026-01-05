require("dotenv").config();

const auth = require("./middleware/auth");

const jwt = require("jsonwebtoken");

//const JWT_SECRET = "supersecretkey"; // later move to .env
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;


const bcrypt = require("bcrypt");

const mongoose = require("mongoose");
// mongoose.connect(
//   "mongodb+srv://meenamastram031_db_user:WuTAWKJkKgsHvCUf@cluster0.pr9zifx.mongodb.net/socialportfolio"
// )
// .then(() => console.log("MongoDB connected"))
// .catch(err => console.error(err));

//deploy
mongoose.connect(process.env.MONGO_URI);

const User = require("./models/User");


const express = require("express");
const cors = require("cors");
const app = express();//server

// middleware to read JSON
app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://socialportfolio-frontend-i7ce1agsw-mastu2005s-projects.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// IMPORTANT: allow preflight
app.options("*", cors());

app.use(express.json());

// test route
app.get("/", (req, res) => {
    res.send("Backend is running!");
});


//login API
app.post("/login", async (req, res) => {
    
    try {
        const { username, password } = req.body;
        

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password required"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Wrong Password!"
            });
        }

        // CREATE TOKEN
        const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// signup API
app.post("/signup", async (req, res) => {
    try {
        const { username, password } = req.body;

        // basic validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        // check if user already exists
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username already exists"
            });
        }

        // create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword
        });


        await newUser.save();

        res.status(201).json({
            success: true,
            username: newUser.username,
            message: "User registered successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// send connection request
app.post("/connections/request/:targetUserId", auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId= req.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot connect with yourself"
            });
        }

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // already connected
        if (targetUser.connections.includes(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: "Already connected"
            });
        }

        // request already sent
        if (targetUser.connectionRequests.includes(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: "Connection request already sent"
            });
        }

        // add incoming request to target user
        targetUser.connectionRequests.push(currentUserId);

        // add outgoing request to current user
        currentUser.sentConnectionRequests.push(targetUserId);

        await targetUser.save();
        await currentUser.save();

         //notification
        await createNotification(
            targetUserId,
            "connection_request",
            currentUserId,
            "sent you a connection request"
        );



        res.json({
            success: true,
            message: "Connection request sent"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// accept connection request
app.post("/connections/accept/:requesterId", auth, async (req, res) => {
    try {
        const { requesterId } = req.params;
        const currentUserId  = req.userId;

        const currentUser = await User.findById(currentUserId);
        const requester = await User.findById(requesterId);

        if (!currentUser || !requester) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // check request exists
        if (!currentUser.connectionRequests.includes(requesterId)) {
            return res.status(400).json({
                success: false,
                message: "No such connection request"
            });
        }

        // remove request
        currentUser.connectionRequests =
            currentUser.connectionRequests.filter(
                id => id.toString() !== requesterId
            );
        
        requester.sentConnectionRequests =
            requester.sentConnectionRequests.filter(
                id => id.toString() !== currentUserId
            );


        // add connection both sides
        currentUser.connections.push(requesterId);
        requester.connections.push(currentUserId);

        await currentUser.save();
        await requester.save();
        
        //notification
        await createNotification(
            requesterId,
            "connection_accepted",
            currentUserId,
            "accepted your connection request"
        );


        res.json({
            success: true,
            message: "Connection accepted"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// reject connection request
app.post("/connections/reject/:requesterId", auth,  async (req, res) => {
    try {
        const { requesterId } = req.params;
        const currentUserId = req.userId;

        const currentUser = await User.findById(currentUserId);
        const requester = await User.findById(requesterId);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        currentUser.connectionRequests =
            currentUser.connectionRequests.filter(
                id => id.toString() !== requesterId
            );

        requester.sentConnectionRequests =
        requester.sentConnectionRequests.filter(
            id => id.toString() !== currentUserId
        );

        await currentUser.save();
        await requester.save();


        res.json({
            success: true,
            message: "Connection request rejected"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// cancel sent connection request
app.post("/connections/cancel/:targetUserId", auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            return res.status(404).json({ success: false });
        }

        targetUser.connectionRequests =
            targetUser.connectionRequests.filter(
                id => id.toString() !== currentUserId
            );

        currentUser.sentConnectionRequests =
            currentUser.sentConnectionRequests.filter(
                id => id.toString() !== targetUserId
            );

        await targetUser.save();
        await currentUser.save();

        res.json({ success: true, message: "Request cancelled" });
    } catch {
        res.status(500).json({ success: false });
    }
});

// disconnect users
app.post("/connections/disconnect/:targetUserId", auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) {
            return res.status(404).json({ success: false });
        }

        targetUser.connections =
            targetUser.connections.filter(
                id => id.toString() !== currentUserId
            );

        currentUser.connections =
            currentUser.connections.filter(
                id => id.toString() !== targetUserId
            );

        await targetUser.save();
        await currentUser.save();

        res.json({ success: true, message: "Disconnected" });
    } catch {
        res.status(500).json({ success: false });
    }
});


// like profile
app.post("/like/:targetUserId",auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;

        if (currentUserId === targetUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot like your own profile"
            });
        }

        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // prevent duplicate like
        if (targetUser.likes.includes(currentUserId)) {
            return res.status(400).json({
                success: false,
                message: "Already liked"
            });
        }

        targetUser.likes.push(currentUserId);
        await targetUser.save();

        //notification
        await createNotification(
            targetUserId,
            "like",
            currentUserId,
            "liked your profile"
        );


        res.json({
            success: true,
            message: "Profile liked"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// unlike profile
app.post("/unlike/:targetUserId", auth, async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUserId = req.userId;

        const targetUser = await User.findById(targetUserId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        targetUser.likes = targetUser.likes.filter(
            id => id.toString() !== currentUserId
        );

        await targetUser.save();

        res.json({
            success: true,
            message: "Profile unliked"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// get likes count
app.get("/likes/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            likesCount: user.likes.length
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

//Notification system

// get my notifications
app.get("/notifications", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate("notifications.from", "username")
            .select("notifications");

        res.json({
            success: true,
            notifications: user.notifications.reverse() // newest first
        });
    } catch {
        res.status(500).json({ success: false });
    }
});

app.post("/notifications/read", auth, async (req, res) => {
    try {
        await User.updateOne(
            { _id: req.userId },
            { $set: { "notifications.$[].isRead": true } }
        );

        res.json({ success: true });
    } catch {
        res.status(500).json({ success: false });
    }
});

// delete single notification
app.delete("/notifications/:notificationId", auth, async (req, res) => {
    try {
        const { notificationId } = req.params;

        await User.updateOne(
            { _id: req.userId },
            { $pull: { notifications: { _id: notificationId } } }
        );

        res.json({
            success: true,
            message: "Notification deleted"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


async function createNotification(userId, type, fromUserId, message) {
    await User.findByIdAndUpdate(userId, {
        $push: {
            notifications: {
                type,
                from: fromUserId,
                message
            }
        }
    });
}


// get current logged-in user
app.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select("-password") // never send password
            .populate("connections", "username")
            .populate("connectionRequests", "username")
            .populate("likes", "username")
            .populate("sentConnectionRequests", "username");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// delete my account
app.delete("/me", auth, async (req, res) => {
    try {
        const currentUserId = req.userId;

        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // 1️⃣ Remove me from other users' connections
        await User.updateMany(
            { connections: currentUserId },
            { $pull: { connections: currentUserId } }
        );

        // 2️⃣ Remove me from incoming requests
        await User.updateMany(
            { connectionRequests: currentUserId },
            { $pull: { connectionRequests: currentUserId } }
        );

        // 3️⃣ Remove me from sent requests
        await User.updateMany(
            { sentConnectionRequests: currentUserId },
            { $pull: { sentConnectionRequests: currentUserId } }
        );

        // 4️⃣ Remove me from likes
        await User.updateMany(
            { likes: currentUserId },
            { $pull: { likes: currentUserId } }
        );

        // 5️⃣ Finally delete my user document
        await User.findByIdAndDelete(currentUserId);

        res.json({
            success: true,
            message: "Account deleted successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// get public user profile
app.get("/users/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select("-password")
            .populate("connections", "username")
            .populate("likes", "username");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// get all users (public profiles)
app.get("/users", async (req, res) => {
    try {
        const search = req.query.search;

        let query = {};

        if (search) {
            query.username = {
                $regex: search,
                $options: "i" // case-insensitive
            };
        }

        const users = await User.find(query)
            .select("username"); // only public info

        res.json({
            success: true,
            users
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});




app.listen(PORT, () => {
    console.log(`Server running on https://socialportfolio-backend.onrender.com/`);
});