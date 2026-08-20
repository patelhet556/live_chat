const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ========================================
// APP SETUP
// ========================================

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Railway PORT
const PORT = process.env.PORT || 3000;

// ========================================
// DIRECTORIES
// ========================================

const publicDir = path.join(__dirname, "public");

const uploadDir = path.join(
    publicDir,
    "uploads"
);

// Create public folder if missing
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, {
        recursive: true
    });
}

// Create uploads folder
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true
    });
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// ========================================
// STATIC FILES
// ========================================

app.use(
    express.static(publicDir)
);

// ========================================
// SOCKET.IO CLIENT FILE
// ========================================

// Socket.IO normally provides this automatically.
// This explicit route makes sure Railway can serve it.

const socketClientPath = path.join(
    __dirname,
    "node_modules",
    "socket.io",
    "client-dist",
    "socket.io.js"
);

app.get(
    "/socket.io/socket.io.js",
    (req, res) => {

        if (!fs.existsSync(socketClientPath)) {

            console.error(
                "Socket.IO client file not found:",
                socketClientPath
            );

            return res.status(404).send(
                "Socket.IO client file not found"
            );
        }

        res.sendFile(socketClientPath);
    }
);

// ========================================
// FAVICON
// ========================================

app.get(
    "/favicon.ico",
    (req, res) => {

        const faviconPath = path.join(
            publicDir,
            "icon.png"
        );

        if (fs.existsSync(faviconPath)) {
            return res.sendFile(faviconPath);
        }

        return res.status(204).end();
    }
);

// ========================================
// HEALTH CHECK
// ========================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({
            status: "ok",
            message: "WiFi Live Chat server is running",
            port: PORT,
            time: new Date().toISOString()
        });

    }
);

// ========================================
// ONLINE USERS
// ========================================

let users = {};

// ========================================
// MULTER STORAGE
// ========================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(
            null,
            uploadDir
        );

    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(
                file.originalname
            );

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(
                Math.random() * 1E9
            ) +
            extension;

        cb(
            null,
            uniqueName
        );

    }

});

// ========================================
// MULTER UPLOAD
// ========================================

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    }

});

// ========================================
// FILE UPLOAD
// ========================================

app.post(
    "/upload",
    upload.single("file"),
    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    error: "No file selected"
                });

            }

            return res.status(200).json({

                originalName:
                    req.file.originalname,

                fileName:
                    req.file.filename,

                fileSize:
                    req.file.size,

                fileUrl:
                    `/uploads/${req.file.filename}`,

                mimeType:
                    req.file.mimetype

            });

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            return res.status(500).json({
                error: "File upload failed"
            });

        }

    }
);

// ========================================
// SOCKET CONNECTION
// ========================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User connected:",
            socket.id
        );

        // ====================================
        // JOIN
        // ====================================

        socket.on(
            "join",
            (username) => {

                username = String(
                    username || "Guest"
                )
                    .trim()
                    .substring(0, 30);

                if (!username) {
                    username = "Guest";
                }

                users[socket.id] =
                    username;

                // Welcome
                socket.emit(
                    "systemMessage",
                    {
                        message:
                            `Welcome ${username}!`
                    }
                );

                // Notify others
                socket.broadcast.emit(
                    "systemMessage",
                    {
                        message:
                            `${username} joined the chat`
                    }
                );

                // Update users
                io.emit(
                    "users",
                    Object.values(users)
                );

                console.log(
                    `${username} joined the chat`
                );

            }
        );

        // ====================================
        // TYPING
        // ====================================

        socket.on(
            "typing",
            () => {

                const username =
                    users[socket.id];

                if (!username) {
                    return;
                }

                socket.broadcast.emit(
                    "userTyping",
                    {
                        username:
                            username
                    }
                );

            }
        );

        // ====================================
        // STOP TYPING
        // ====================================

        socket.on(
            "stopTyping",
            () => {

                socket.broadcast.emit(
                    "userStopTyping"
                );

            }
        );

        // ====================================
        // CHAT MESSAGE
        // ====================================

        socket.on(
            "chatMessage",
            (message) => {

                if (!users[socket.id]) {
                    return;
                }

                const username =
                    users[socket.id];

                message = String(
                    message || ""
                )
                    .trim();

                if (!message) {
                    return;
                }

                message =
                    message.substring(
                        0,
                        500
                    );

                // Stop typing
                socket.broadcast.emit(
                    "userStopTyping"
                );

                // Send message
                io.emit(
                    "chatMessage",
                    {

                        username:
                            username,

                        message:
                            message,

                        time:
                            new Date()
                                .toLocaleTimeString(
                                    [],
                                    {
                                        hour:
                                            "2-digit",

                                        minute:
                                            "2-digit"
                                    }
                                )

                    }
                );

            }
        );

        // ====================================
        // FILE MESSAGE
        // ====================================

        socket.on(
            "fileMessage",
            (data) => {

                const username =
                    users[socket.id];

                if (!username) {
                    return;
                }

                if (!data) {
                    return;
                }

                if (!data.fileUrl) {
                    return;
                }

                io.emit(
                    "fileMessage",
                    {

                        username:
                            username,

                        originalName:
                            String(
                                data.originalName ||
                                "File"
                            ).substring(
                                0,
                                255
                            ),

                        fileName:
                            String(
                                data.fileName ||
                                ""
                            ),

                        fileSize:
                            Number(
                                data.fileSize ||
                                0
                            ),

                        fileUrl:
                            String(
                                data.fileUrl ||
                                ""
                            ),

                        mimeType:
                            String(
                                data.mimeType ||
                                "application/octet-stream"
                            ),

                        time:
                            new Date()
                                .toLocaleTimeString(
                                    [],
                                    {
                                        hour:
                                            "2-digit",

                                        minute:
                                            "2-digit"
                                    }
                                )

                    }
                );

                socket.broadcast.emit(
                    "userStopTyping"
                );

            }
        );

        // ====================================
        // LEAVE CHAT
        // ====================================

        socket.on(
            "leaveChat",
            () => {

                const username =
                    users[socket.id];

                if (!username) {
                    return;
                }

                socket.broadcast.emit(
                    "userStopTyping"
                );

                delete users[
                    socket.id
                ];

                socket.broadcast.emit(
                    "systemMessage",
                    {
                        message:
                            `${username} left the chat`
                    }
                );

                io.emit(
                    "users",
                    Object.values(users)
                );

                console.log(
                    `${username} left the chat`
                );

            }
        );

        // ====================================
        // DISCONNECT
        // ====================================

        socket.on(
            "disconnect",
            () => {

                const username =
                    users[socket.id];

                if (username) {

                    socket.broadcast.emit(
                        "userStopTyping"
                    );

                    delete users[
                        socket.id
                    ];

                    socket.broadcast.emit(
                        "systemMessage",
                        {
                            message:
                                `${username} disconnected`
                        }
                    );

                    io.emit(
                        "users",
                        Object.values(users)
                    );

                    console.log(
                        `${username} disconnected`
                    );

                }

                console.log(
                    "Socket disconnected:",
                    socket.id
                );

            }
        );

    }
);

// ========================================
// LOCAL IP
// ========================================

function getLocalIP() {

    const interfaces =
        os.networkInterfaces();

    for (
        const name of Object.keys(
            interfaces
        )
    ) {

        for (
            const network of
            interfaces[name]
        ) {

            if (
                network.family === "IPv4" &&
                !network.internal
            ) {

                return network.address;

            }

        }

    }

    return "localhost";
}

// ========================================
// START SERVER
// ========================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        const ip =
            getLocalIP();

        console.log("");

        console.log(
            "================================="
        );

        console.log(
            "        WIFI LIVE CHAT"
        );

        console.log(
            "================================="
        );

        console.log(
            `PORT:    ${PORT}`
        );

        console.log(
            `Local:   http://localhost:${PORT}`
        );

        console.log(
            `Network: http://${ip}:${PORT}`
        );

        console.log(
            `Health:  http://localhost:${PORT}/health`
        );

        console.log(
            "================================="
        );

        console.log("");

    }
);

// ========================================
// SERVER ERROR
// ========================================

server.on(
    "error",
    (error) => {

        console.error(
            "SERVER ERROR:",
            error
        );

    }
);

// ========================================
// PROCESS ERROR
// ========================================

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);
