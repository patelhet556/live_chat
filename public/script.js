// ========================================
// SOCKET CONNECTION
// ========================================

const socket = io();


// ========================================
// DOM ELEMENTS
// ========================================

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");

const usernameInput = document.getElementById("username");
const joinBtn = document.getElementById("joinBtn");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const messages = document.getElementById("messages");
const usersList = document.getElementById("usersList");

const userCount = document.getElementById("userCount");
const headerUserCount =
    document.getElementById("headerUserCount");

const leaveBtn = document.getElementById("leaveBtn");

const typing = document.getElementById("typing");

const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");


// ========================================
// VARIABLES
// ========================================

let username = "";

let isInChat = false;

let typingTimeout = null;

let isTyping = false;

let isUploading = false;


// ========================================
// NOTIFICATION VARIABLES
// ========================================

const originalTitle = document.title;

let notificationFlashInterval = null;


// ========================================
// REQUEST NOTIFICATION PERMISSION
// ========================================

async function requestNotificationPermission() {

    // Browser Notification supported che?
    if (!("Notification" in window)) {
        console.log(
            "This browser does not support notifications."
        );

        return;
    }


    // Already granted
    if (Notification.permission === "granted") {
        return;
    }


    // Already denied
    if (Notification.permission === "denied") {
        console.log(
            "Notification permission was denied."
        );

        return;
    }


    // Ask permission
    try {

        await Notification.requestPermission();

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


// ========================================
// SHOW BROWSER NOTIFICATION
// ========================================

function showNotification(title, body) {

    // Notification supported che?
    if (!("Notification" in window)) {
        return;
    }


    // Permission nathi
    if (Notification.permission !== "granted") {
        return;
    }


    // IMPORTANT:
    // Notification only when tab is
    // hidden/background/not focused.
    if (!document.hidden && document.hasFocus()) {
        return;
    }


    try {

        const notification =
            new Notification(title, {
                body: body,
                icon: "/favicon.ico",
                tag: "wifi-live-chat"
            });


        // Notification click
        notification.onclick = () => {

            window.focus();

            notification.close();

            stopTitleFlash();

            scrollToBottom();

        };


    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

    }

}


// ========================================
// FLASH TAB TITLE
// ========================================

function startTitleFlash() {

    if (notificationFlashInterval) {
        return;
    }


    let showMessage = true;


    notificationFlashInterval =
        setInterval(() => {

            document.title =
                showMessage
                    ? "🔔 New message"
                    : originalTitle;

            showMessage = !showMessage;

        }, 800);

}


// ========================================
// STOP TITLE FLASH
// ========================================

function stopTitleFlash() {

    if (notificationFlashInterval) {

        clearInterval(
            notificationFlashInterval
        );

        notificationFlashInterval = null;

    }


    document.title = originalTitle;

}


// ========================================
// TAB FOCUS
// ========================================

window.addEventListener(
    "focus",
    () => {

        stopTitleFlash();

    }
);


document.addEventListener(
    "visibilitychange",
    () => {

        if (!document.hidden) {
            stopTitleFlash();
        }

    }
);


// ========================================
// NOTIFY NEW MESSAGE
// ========================================

function notifyNewMessage(
    senderName,
    message
) {

    // Don't notify own message
    if (
        !senderName ||
        senderName === username
    ) {
        return;
    }


    // Only when tab is not active
    if (
        !document.hidden &&
        document.hasFocus()
    ) {
        return;
    }


    startTitleFlash();


    showNotification(
        `💬 ${senderName}`,
        message
    );

}


// ========================================
// NOTIFY NEW FILE
// ========================================

function notifyNewFile(
    senderName,
    fileName
) {

    // Don't notify own file
    if (
        !senderName ||
        senderName === username
    ) {
        return;
    }


    // Only background tab
    if (
        !document.hidden &&
        document.hasFocus()
    ) {
        return;
    }


    startTitleFlash();


    showNotification(
        `📎 ${senderName}`,
        `Sent a file: ${fileName}`
    );

}


// ========================================
// FILE BUTTON
// ========================================

if (fileBtn && fileInput) {

    fileBtn.addEventListener(
        "click",
        () => {

            if (!isInChat) {
                return;
            }

            fileInput.click();

        }
    );

}


// ========================================
// FILE SELECT
// ========================================

if (fileInput) {

    fileInput.addEventListener(
        "change",
        handleFileSelect
    );

}


// ========================================
// FILE UPLOAD
// ========================================

async function handleFileSelect() {

    const file =
        fileInput.files[0];


    if (!file) {
        return;
    }


    // User chat ma che?
    if (!isInChat) {

        fileInput.value = "";

        return;

    }


    // ====================================
    // MAX FILE SIZE = 10 MB
    // ====================================

    const maxSize =
        10 * 1024 * 1024;


    if (file.size > maxSize) {

        alert(
            "Maximum file size is 10 MB."
        );

        fileInput.value = "";

        return;

    }


    // ====================================
    // UPLOAD STATUS
    // ====================================

    if (isUploading) {

        alert(
            "Please wait, another file is uploading."
        );

        fileInput.value = "";

        return;

    }


    isUploading = true;


    // Stop typing
    stopTyping();


    // ====================================
    // FORM DATA
    // ====================================

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );


    try {

        // ==================================
        // UPLOAD
        // ==================================

        const response =
            await fetch(
                "/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        let data;


        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "Invalid server response."
            );

        }


        // ==================================
        // SERVER ERROR
        // ==================================

        if (!response.ok) {

            throw new Error(
                data.error ||
                "File upload failed."
            );

        }


        // ==================================
        // FILE URL CHECK
        // ==================================

        if (!data.fileUrl) {

            throw new Error(
                "File URL not received."
            );

        }


        // ==================================
        // SEND FILE THROUGH SOCKET
        // ==================================

        socket.emit(
            "fileMessage",
            {

                originalName:
                    data.originalName,

                fileName:
                    data.fileName,

                fileSize:
                    data.fileSize,

                fileUrl:
                    data.fileUrl,

                mimeType:
                    data.mimeType

            }
        );


    } catch (error) {

        console.error(
            "File upload error:",
            error
        );

        alert(
            error.message ||
            "File upload failed."
        );

    } finally {

        isUploading = false;

        fileInput.value = "";

    }

}


// ========================================
// JOIN CHAT
// ========================================

if (joinBtn) {

    joinBtn.addEventListener(
        "click",
        joinChat
    );

}


if (usernameInput) {

    usernameInput.addEventListener(
        "keydown",
        (e) => {

            if (e.key === "Enter") {

                e.preventDefault();

                joinChat();

            }

        }
    );

}


// ========================================
// JOIN FUNCTION
// ========================================

function joinChat() {

    const name =
        usernameInput.value.trim();


    // Empty name
    if (!name) {

        alert(
            "Please enter your name."
        );

        usernameInput.focus();

        return;

    }


    // ====================================
    // USERNAME
    // ====================================

    username =
        name.substring(
            0,
            30
        );


    // ====================================
    // USER INSIDE CHAT
    // ====================================

    isInChat = true;


    // ====================================
    // CLEAR OLD CHAT
    // ====================================

    messages.innerHTML = "";


    // ====================================
    // CLEAR TYPING
    // ====================================

    typing.textContent = "";

    typing.classList.remove(
        "show"
    );

    isTyping = false;

    clearTimeout(
        typingTimeout
    );


    // ====================================
    // REQUEST NOTIFICATION
    // ====================================

    requestNotificationPermission();


    // ====================================
    // JOIN SERVER
    // ====================================

    socket.emit(
        "join",
        username
    );


    // ====================================
    // SHOW CHAT
    // ====================================

    loginScreen.classList.add(
        "hidden"
    );

    chatScreen.classList.remove(
        "hidden"
    );


    // ====================================
    // FOCUS INPUT
    // ====================================

    setTimeout(
        () => {

            messageInput.focus();

            scrollToBottom();

        },
        150
    );

}


// ========================================
// SEND TEXT MESSAGE
// ========================================

messageForm.addEventListener(
    "submit",
    (e) => {

        e.preventDefault();


        // User chat ma nathi
        if (!isInChat) {
            return;
        }


        const message =
            messageInput.value.trim();


        // Empty
        if (!message) {
            return;
        }


        // Stop typing
        stopTyping();


        // ==================================
        // SEND
        // ==================================

        socket.emit(
            "chatMessage",
            message
        );


        // Clear input
        messageInput.value = "";


        // Focus
        messageInput.focus();

    }
);


// ========================================
// RECEIVE TEXT MESSAGE
// ========================================

socket.on(
    "chatMessage",
    (data) => {

        if (!data) {
            return;
        }


        // ==================================
        // NOTIFICATION
        // ==================================

        notifyNewMessage(
            data.username,
            data.message
        );


        // ==================================
        // OUTSIDE CHAT
        // ==================================

        if (!isInChat) {
            return;
        }


        // ==================================
        // CREATE MESSAGE
        // ==================================

        const div =
            document.createElement(
                "div"
            );


        div.className =
            "message";


        div.innerHTML = `

            <div class="message-name">
                ${escapeHTML(
                    data.username
                )}
            </div>

            <div class="message-text">
                ${escapeHTML(
                    data.message
                )}
            </div>

            <div class="message-time">
                ${escapeHTML(
                    data.time
                )}
            </div>

        `;


        messages.appendChild(
            div
        );


        scrollToBottom();

    }
);


// ========================================
// RECEIVE FILE MESSAGE
// ========================================

socket.on(
    "fileMessage",
    (data) => {

        if (!data) {
            return;
        }


        if (!data.fileUrl) {
            return;
        }


        // ==================================
        // NOTIFICATION
        // ==================================

        notifyNewFile(
            data.username,
            data.originalName ||
            "File"
        );


        // ==================================
        // OUTSIDE CHAT
        // ==================================

        if (!isInChat) {
            return;
        }


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "message file-message";


        const mimeType =
            data.mimeType || "";


        const originalName =
            data.originalName ||
            "File";


        // ==================================
        // IMAGE
        // ==================================

        if (
            mimeType.startsWith(
                "image/"
            )
        ) {

            div.innerHTML = `

                <div class="message-name">
                    ${escapeHTML(
                        data.username
                    )}
                </div>

                <a
                    href="${escapeHTML(
                        data.fileUrl
                    )}"
                    target="_blank"
                    rel="noopener"
                >

                    <img
                        src="${escapeHTML(
                            data.fileUrl
                        )}"
                        class="chat-image"
                        alt="${escapeHTML(
                            originalName
                        )}"
                        loading="lazy"
                    >

                </a>

                <div class="file-name">
                    ${escapeHTML(
                        originalName
                    )}
                </div>

                <div class="message-time">
                    ${escapeHTML(
                        data.time
                    )}
                </div>

            `;

        }


        // ==================================
        // PDF
        // ==================================

        else if (
            mimeType ===
            "application/pdf"
        ) {

            div.innerHTML = `

                <div class="message-name">
                    ${escapeHTML(
                        data.username
                    )}
                </div>

                <div class="file-card">

                    <div class="file-icon">
                        📕
                    </div>

                    <div class="file-info">

                        <div class="file-name">
                            ${escapeHTML(
                                originalName
                            )}
                        </div>

                        <div class="file-size">
                            ${formatFileSize(
                                data.fileSize
                            )}
                        </div>

                    </div>


                    <a
                        href="${escapeHTML(
                            data.fileUrl
                        )}"
                        target="_blank"
                        rel="noopener"
                        class="download-btn"
                        title="View"
                        aria-label="View"
                    >
                        ↗
                    </a>


                    <a
                        href="${escapeHTML(
                            data.fileUrl
                        )}"
                        download
                        class="download-btn"
                        title="Download"
                        aria-label="Download"
                    >
                        ↓
                    </a>

                </div>

                <div class="message-time">
                    ${escapeHTML(
                        data.time
                    )}
                </div>

            `;

        }


        // ==================================
        // VIDEO
        // ==================================

        else if (
            mimeType.startsWith(
                "video/"
            )
        ) {

            div.innerHTML = `

                <div class="message-name">
                    ${escapeHTML(
                        data.username
                    )}
                </div>

                <video
                    controls
                    class="chat-video"
                >

                    <source
                        src="${escapeHTML(
                            data.fileUrl
                        )}"
                        type="${escapeHTML(
                            mimeType
                        )}"
                    >

                </video>

                <div class="file-name">
                    ${escapeHTML(
                        originalName
                    )}
                </div>

                <div class="message-time">
                    ${escapeHTML(
                        data.time
                    )}
                </div>

            `;

        }


        // ==================================
        // AUDIO
        // ==================================

        else if (
            mimeType.startsWith(
                "audio/"
            )
        ) {

            div.innerHTML = `

                <div class="message-name">
                    ${escapeHTML(
                        data.username
                    )}
                </div>

                <div class="file-card">

                    <div class="file-icon">
                        🎵
                    </div>

                    <div class="file-info">

                        <div class="file-name">
                            ${escapeHTML(
                                originalName
                            )}
                        </div>

                        <div class="file-size">
                            ${formatFileSize(
                                data.fileSize
                            )}
                        </div>

                    </div>

                </div>

                <audio
                    controls
                    class="chat-audio"
                >

                    <source
                        src="${escapeHTML(
                            data.fileUrl
                        )}"
                        type="${escapeHTML(
                            mimeType
                        )}"
                    >

                </audio>

                <div class="message-time">
                    ${escapeHTML(
                        data.time
                    )}
                </div>

            `;

        }


        // ==================================
        // OTHER FILE
        // ==================================

        else {

            div.innerHTML = `

                <div class="message-name">
                    ${escapeHTML(
                        data.username
                    )}
                </div>

                <div class="file-card">

                    <div class="file-icon">
                        ${getFileIcon(
                            originalName
                        )}
                    </div>

                    <div class="file-info">

                        <div class="file-name">
                            ${escapeHTML(
                                originalName
                            )}
                        </div>

                        <div class="file-size">
                            ${formatFileSize(
                                data.fileSize
                            )}
                        </div>

                    </div>


                    <a
                        href="${escapeHTML(
                            data.fileUrl
                        )}"
                        target="_blank"
                        rel="noopener"
                        class="download-btn"
                        title="View"
                        aria-label="View"
                    >
                        ↗
                    </a>


                    <a
                        href="${escapeHTML(
                            data.fileUrl
                        )}"
                        download
                        class="download-btn"
                        title="Download"
                        aria-label="Download"
                    >
                        ↓
                    </a>

                </div>

                <div class="message-time">
                    ${escapeHTML(
                        data.time
                    )}
                </div>

            `;

        }


        messages.appendChild(
            div
        );


        scrollToBottom();

    }
);


// ========================================
// FILE SIZE
// ========================================

function formatFileSize(bytes) {

    bytes =
        Number(bytes) || 0;


    if (
        bytes <
        1024
    ) {

        return (
            bytes +
            " B"
        );

    }


    if (
        bytes <
        1024 * 1024
    ) {

        return (
            (
                bytes / 1024
            ).toFixed(1) +
            " KB"
        );

    }


    return (
        (
            bytes /
            (
                1024 *
                1024
            )
        ).toFixed(1) +
        " MB"
    );

}


// ========================================
// FILE ICON
// ========================================

function getFileIcon(fileName) {

    const extension =
        fileName
            .split(".")
            .pop()
            .toLowerCase();


    const icons = {

        pdf: "📕",

        doc: "📘",
        docx: "📘",

        txt: "📄",

        xls: "📗",
        xlsx: "📗",

        csv: "📊",

        ppt: "📙",
        pptx: "📙",

        zip: "🗜️",
        rar: "🗜️",
        "7z": "🗜️",

        mp3: "🎵",
        wav: "🎵",

        mp4: "🎬",
        mov: "🎬",
        avi: "🎬",

        js: "📜",
        html: "🌐",
        css: "🎨",

        php: "🐘",

        json: "📋"

    };


    return (
        icons[extension] ||
        "📄"
    );

}


// ========================================
// SYSTEM MESSAGE
// ========================================

socket.on(
    "systemMessage",
    (data) => {

        if (!isInChat) {
            return;
        }


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "system-message";


        div.textContent =
            data.message;


        messages.appendChild(
            div
        );


        scrollToBottom();

    }
);


// ========================================
// ONLINE USERS
// ========================================

socket.on(
    "users",
    (users) => {

        // ==================================
        // COUNT
        // ==================================

        if (userCount) {

            userCount.textContent =
                users.length;

        }


        if (headerUserCount) {

            headerUserCount.textContent =
                users.length;

        }


        // ==================================
        // USER LIST
        // ==================================

        if (!usersList) {
            return;
        }


        usersList.innerHTML =
            "";


        users.forEach(
            (user) => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "user";


                const firstLetter =
                    user
                        .charAt(0)
                        .toUpperCase();


                div.innerHTML = `

                    <div class="user-avatar">
                        ${escapeHTML(
                            firstLetter
                        )}
                    </div>

                    <span>
                        ${escapeHTML(
                            user
                        )}
                    </span>

                    <span
                        class="user-status"
                    ></span>

                `;


                usersList.appendChild(
                    div
                );

            }
        );

    }
);


// ========================================
// TYPING SEND
// ========================================

messageInput.addEventListener(
    "input",
    () => {

        if (!isInChat) {
            return;
        }


        const message =
            messageInput.value.trim();


        // ==================================
        // TYPING
        // ==================================

        if (
            message.length > 0
        ) {

            if (!isTyping) {

                isTyping = true;

                socket.emit(
                    "typing"
                );

            }


            clearTimeout(
                typingTimeout
            );


            typingTimeout =
                setTimeout(
                    () => {

                        stopTyping();

                    },
                    1200
                );

        }


        // ==================================
        // EMPTY
        // ==================================

        else {

            stopTyping();

        }

    }
);


// ========================================
// STOP TYPING
// ========================================

function stopTyping() {

    clearTimeout(
        typingTimeout
    );


    if (!isTyping) {
        return;
    }


    isTyping = false;


    socket.emit(
        "stopTyping"
    );

}


// ========================================
// RECEIVE TYPING
// ========================================

socket.on(
    "userTyping",
    (data) => {

        if (!isInChat) {
            return;
        }


        if (!typing) {
            return;
        }


        typing.textContent =
            `${data.username} is typing...`;


        typing.classList.add(
            "show"
        );

    }
);


// ========================================
// STOP RECEIVED TYPING
// ========================================

socket.on(
    "userStopTyping",
    () => {

        if (!typing) {
            return;
        }


        typing.textContent =
            "";


        typing.classList.remove(
            "show"
        );

    }
);


// ========================================
// LEAVE CHAT
// ========================================

if (leaveBtn) {

    leaveBtn.addEventListener(
        "click",
        leaveChat
    );

}


// ========================================
// LEAVE FUNCTION
// ========================================

function leaveChat() {

    if (!isInChat) {
        return;
    }


    // ==================================
    // STOP TYPING
    // ==================================

    stopTyping();


    // ==================================
    // SERVER
    // ==================================

    socket.emit(
        "leaveChat"
    );


    // ==================================
    // OUTSIDE CHAT
    // ==================================

    isInChat = false;


    // ==================================
    // CLEAR CHAT
    // ==================================

    messages.innerHTML =
        "";


    // ==================================
    // CLEAR TYPING
    // ==================================

    if (typing) {

        typing.textContent =
            "";

        typing.classList.remove(
            "show"
        );

    }


    // ==================================
    // CLEAR INPUT
    // ==================================

    messageInput.value =
        "";


    // ==================================
    // CLEAR FILE
    // ==================================

    if (fileInput) {

        fileInput.value =
            "";

    }


    // ==================================
    // CLEAR USERNAME
    // ==================================

    usernameInput.value =
        "";

    username =
        "";


    // ==================================
    // SHOW LOGIN
    // ==================================

    chatScreen.classList.add(
        "hidden"
    );

    loginScreen.classList.remove(
        "hidden"
    );


    // ==================================
    // FOCUS USERNAME
    // ==================================

    setTimeout(
        () => {

            usernameInput.focus();

        },
        100
    );

}


// ========================================
// PAGE CLOSE / HIDE
// ========================================

window.addEventListener(
    "pagehide",
    () => {

        if (isInChat) {

            socket.emit(
                "stopTyping"
            );

            socket.emit(
                "leaveChat"
            );

        }

    }
);


// ========================================
// AUTO SCROLL
// ========================================

function scrollToBottom() {

    setTimeout(
        () => {

            if (!messages) {
                return;
            }


            messages.scrollTop =
                messages.scrollHeight;

        },
        50
    );

}


// ========================================
// MOBILE KEYBOARD
// ========================================

messageInput.addEventListener(
    "focus",
    () => {

        setTimeout(
            () => {

                scrollToBottom();

            },
            300
        );

    }
);


// ========================================
// VISUAL VIEWPORT
// ========================================

if (window.visualViewport) {

    window.visualViewport.addEventListener(
        "resize",
        () => {

            if (!isInChat) {
                return;
            }


            setTimeout(
                () => {

                    scrollToBottom();

                },
                100
            );

        }
    );

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            text ?? ""
        );


    return div.innerHTML;

}
