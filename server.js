const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Danh sách phòng: tên phòng -> Set(socketId)
const rooms = new Map();
// Phòng mặc định
const DEFAULT_ROOM = 'Phòng chung';
rooms.set(DEFAULT_ROOM, new Set());

// socketId -> username
const onlineUsers = new Map();
// socketId -> roomName
const userRooms = new Map();

io.on('connection', (socket) => {
    console.log(`🔌 [CONNECTED] Socket ID: ${socket.id}`);

    socket.on('join', ({ username, room }) => {
        if (!username || username.trim().toLowerCase() === 'ẩn danh') {
            return;
        }

        // Nếu không có phòng, dùng phòng mặc định
        if (!room || !rooms.has(room)) {
            room = DEFAULT_ROOM;
        }

        onlineUsers.set(socket.id, username);
        userRooms.set(socket.id, room);
        socket.join(room);

        // Thêm socket vào phòng
        if (!rooms.has(room)) {
            rooms.set(room, new Set());
        }
        rooms.get(room).add(socket.id);

        // Gửi danh sách người dùng trong phòng hiện tại
        io.to(room).emit('room users', {
            room,
            users: Array.from(rooms.get(room)).map(id => onlineUsers.get(id))
        });

        // Thông báo
        io.to(room).emit('system message', `📢 ${username} đã tham gia ${room}.`);

        console.log(`👤 [JOIN] ${username} (${socket.id}) vào phòng ${room}`);

        // Gửi danh sách phòng và danh sách online
        io.emit('rooms list', Array.from(rooms.keys()));
        sendOnlineUsers(); // <-- gửi cho tất cả client
    });

    socket.on('create room', (roomName) => {
        if (!roomName || rooms.has(roomName)) return;

        rooms.set(roomName, new Set());
        io.emit('rooms list', Array.from(rooms.keys()));
        console.log(`🏠 Phòng mới được tạo: ${roomName}`);
    });

    socket.on('chat message', (data) => {
        const sender = onlineUsers.get(socket.id);
        const room = userRooms.get(socket.id) || DEFAULT_ROOM;

        if (!sender || sender.toLowerCase() === 'ẩn danh') {
            console.log(`❌ Tin nhắn bị chặn từ người không có tên: ${socket.id}`);
            return;
        }

        io.to(room).emit('chat message', { ...data, sender, room });
    });

    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        const room = userRooms.get(socket.id);

        if (username) {
            console.log(`❌ [LEAVE] ${username} (${socket.id})`);

            if (room && rooms.has(room)) {
                rooms.get(room).delete(socket.id);

                io.to(room).emit('system message', `📢 ${username} đã rời khỏi ${room}.`);

                io.to(room).emit('room users', {
                    room,
                    users: Array.from(rooms.get(room)).map(id => onlineUsers.get(id))
                });

                userRooms.delete(socket.id);
            }

            onlineUsers.delete(socket.id);
        } else {
            console.log(`❌ [DISCONNECTED] Unknown socket: ${socket.id}`);
        }

        sendOnlineUsers(); // cập nhật lại danh sách online sau khi ai đó rời
    });

    // Hàm gửi danh sách online gồm { username, room } cho toàn bộ client
    function sendOnlineUsers() {
        const list = Array.from(onlineUsers.entries()).map(([id, username]) => ({
            username,
            room: userRooms.get(id) || DEFAULT_ROOM
        }));
        io.emit('online users', list);
    }
});

server.listen(3000, () => {
    console.log('✅ Server chạy tại http://localhost:3000\n');
});
