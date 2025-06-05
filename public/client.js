const socket = io();

let currentRoom = 'Phòng chung';

function sendUsernameAndRoom() {
    const username = document.getElementById('username').value || 'Ẩn danh';
    socket.emit('join', { username, room: currentRoom });
}

function createRoom() {
    const newRoomName = prompt('Nhập tên phòng mới:');
    if (newRoomName) {
        socket.emit('create room', newRoomName);
    }
}

document.getElementById('username').addEventListener('change', () => {
    sendUsernameAndRoom();
});

window.onload = () => {
    sendUsernameAndRoom();
};

socket.on('rooms list', (rooms) => {
    const roomsListEl = document.getElementById('rooms-list');
    roomsListEl.innerHTML = '';
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.textContent = room;
        if (room === currentRoom) li.classList.add('active');
        li.onclick = () => {
            if (room !== currentRoom) {
                currentRoom = room;
                sendUsernameAndRoom();
                document.getElementById('messages').innerHTML = ''; // Xóa tin nhắn cũ khi đổi phòng
                updateActiveRoom(room);
            }
        };
        roomsListEl.appendChild(li);
    });
});

function updateActiveRoom(room) {
    const roomsListEl = document.getElementById('rooms-list');
    [...roomsListEl.children].forEach(li => {
        li.classList.toggle('active', li.textContent === room);
    });
}

// Hiển thị danh sách user trong phòng
socket.on('room users', ({ room, users }) => {
    if (room === currentRoom) {
        const listEl = document.getElementById('online-users');
        listEl.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = user;
            listEl.appendChild(li);
        });
    }
});

socket.on('online users', (list) => {
    const listEl = document.getElementById('online-users');
    listEl.innerHTML = '';

    list.forEach(({ username, room }) => {
        const li = document.createElement('li');
        li.textContent = `${username} (${room})`;

        // In đậm hoặc đổi màu nếu cùng phòng
        if (room === currentRoom) {
            li.style.fontWeight = 'bold';
            li.style.color = '#4CAF50';
        } else {
            li.style.color = '#888';
        }

        listEl.appendChild(li);
    });
});

function sendMessage() {
    const message = document.getElementById('message').value;
    const key = document.getElementById('key').value;
    const username = document.getElementById('username').value.trim();

    if (!key) return alert("Vui lòng nhập khóa AES!");
    if (!message.trim()) return;
    if (!username) return alert("Vui lòng nhập tên trước khi nhắn tin!");

    const encrypted = CryptoJS.AES.encrypt(message, key).toString();

    socket.emit('chat message', {
        encryptedMsg: encrypted,
    });

    appendMessage( message, 'sent');
    document.getElementById('message').value = '';
}


socket.on('system message', (text) => {
    const li = document.createElement('li');
    li.textContent = text;
    li.style.fontStyle = 'italic';
    li.style.color = 'gray';
    document.getElementById('messages').appendChild(li);
});

socket.on('chat message', ({ encryptedMsg, sender, room }) => {
    if (room !== currentRoom) return; // Chỉ hiện tin nhắn phòng hiện tại

    const key = document.getElementById('key').value;
    if (!key) return;

    try {
        const bytes = CryptoJS.AES.decrypt(encryptedMsg, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
            const myName = document.getElementById('username').value || 'Người dùng ẩn danh';
            if (sender !== myName) {
                appendMessage(`${sender}: ${decrypted}`, 'received');
            }
        } else {
            if (sender !== myName) {
                appendMessage(`${sender}: ❌ Không giải mã được (sai khóa?)`, 'received');
            }
        }
    } catch {
        const myName = document.getElementById('username').value || 'Người dùng ẩn danh';
        if (sender !== myName) {
            appendMessage(`${sender}: ❌ Giải mã lỗi`, 'received');
        }
    }
});

function appendMessage(msg, className) {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = msg;
    msgDiv.className = `message ${className}`;
    document.getElementById('messages').appendChild(msgDiv);
    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
}

// Gửi tin nhắn khi nhấn Enter trong ô nhập tin nhắn
document.getElementById('message').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Ngăn không xuống dòng
        sendMessage();
    }
});