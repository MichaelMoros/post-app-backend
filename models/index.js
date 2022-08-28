//models/index.js
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const uri = process.env.MONGO_CONNECTION_STRING
const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(uri, connectionOptions);
const conn = mongoose.connection;

conn.on('error', () => console.error.bind(console, 'connection error'));

conn.once('open', () => console.info('Connection to Database is successful'));
module.exports = conn
