const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const shortId = require("short-id");
const { v4 } = require("uuid");
const cookieParser = require("cookie-parser");

const User = require("./models/User");

const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

mongoose.connect("mongodb://localhost:27017/safeChat", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const currentlyConnected = {};

app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/views/index.html`);
});

app.post("/register", (req, res) => {
    const pseudo = req.body.pseudo;
    const uuid = v4();
    const user = new User({ uuid, pseudo });
    user.save();
    res.cookie("uuid", uuid);

    const roomId = req.body.roomId || shortId.generate();
    res.redirect(`/room/${roomId}`);
});

app.get("/user/:uuid", async (req, res) => {
    const user = await User.findOne({ uuid: req.params.uuid });
    if (user) res.json(user);
    else res.status(404).send(null);
});

app.get("/room/:roomId", (req, res) => {
    res.sendFile(`${__dirname}/views/room.html`);
});

io.on("connection", (socket) => {
    const { roomId, pseudo } = socket.handshake.query;

    socket.join(roomId);
    const connectedToRoom = currentlyConnected[roomId] || [];

    connectedToRoom.push(pseudo);
    currentlyConnected[roomId] = connectedToRoom;

    io.to(roomId).emit("users update", connectedToRoom);

    io.to(roomId).emit("chat connected", `${pseudo} joined the room.`);

    socket.on("disconnect", () => {
        socket.leave(roomId);
        currentlyConnected[roomId] = currentlyConnected[roomId].filter(
            (connected) => connected != pseudo
        );
        io.to(roomId).emit("users update", currentlyConnected[roomId]);
        io.to(roomId).emit("chat disconnected", `${pseudo} left the room.`);
    });
    socket.on("chat message", (msg) => {
        io.to(roomId).emit("chat message", msg);
    });
});

http.listen(3002, () => {
    console.log("listening on *:3002");
});
