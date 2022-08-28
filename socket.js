const { Server } = require('socket.io');
const io = new Server()

const _Socket = {
    emit: function (event, data) {
        io.sockets.emit(event, data);
    },
    activeClients: {}
}


exports.Socket = _Socket;
exports.io = io;