const cors = require("cors");
const express = require("express");
const app = express();
const session = require('express-session')
require("dotenv").config();
const cookieParser = require('cookie-parser')
const { errorHandler } = require("./middlewares/errorHandler");
const UserRouter = require("./routers/userRouter");
const CommentRouter = require("./routers/commentRouter");
const PostRouter = require("./routers/postRouter");
const ActivityRouter = require("./routers/activityRouter");
const RefreshTokenRouter = require("./routers/refreshTokenRouter")
const NotificationRouter = require('./routers/notificationRouter')
const SearchRouter = require('./routers/searchRouter')
// const logger = require("./helpers/logger");

app.set("trust proxy", 1);
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'Once upon a time',
        resave: true,
        saveUninitialized: false,
        cookie: {
            sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
            secure: process.env.NODE_ENV === "production"
        }
    })
);

const CLIENT_SIDE_ADDRESS = process.env.CLIENT_SIDE_ADDRESS || 'http://localhost:5173'

app.use(cors({
    credentials: true,
    origin: [CLIENT_SIDE_ADDRESS, 'http://localhost:4173']
}))

app.use(cookieParser())
app.use(express.json());
app.use(function (req, res, next) {
    res.header('Content-Type', 'application/json;charset=UTF-8')
    res.header('Access-Control-Allow-Credentials', true)
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    )
    next()
})

// app.use(logger);
app.use("/users", UserRouter);
app.use("/posts", PostRouter);
app.use("/comments", CommentRouter);
app.use('/activities', ActivityRouter)
app.use('/refresh-token', RefreshTokenRouter)
app.use('/notifications', NotificationRouter)
app.use('/search', SearchRouter)
app.use(errorHandler);


const PORT = process.env.PORT || 5000
const serverInstance = app.listen(process.env.PORT || PORT, () => {
    console.log(`Listening at port ${process.env.PORT || PORT}`)
});

const { io, Socket } = require('./socket')

io.attach(serverInstance, {
    cors: {
        origin: CLIENT_SIDE_ADDRESS
    }
})

io.on('connection', async (socket) => {
    socket.on('map-to-active-clients', (userId, socketId) => {
        Socket.activeClients[userId] = socketId
    })
})