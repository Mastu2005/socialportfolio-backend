const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    // connections (accepted)
    connections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // incoming connection requests
    connectionRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // outgoing connection requests (sent by me)
    sentConnectionRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],


    // profile likes
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    notifications: [
        {
            type: {
                type: String, // "like" | "connection_request" | "connection_accepted"
                required: true
            },
            from: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            message: String,
            isRead: {
                type: Boolean,
                default: false
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ],


    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);
