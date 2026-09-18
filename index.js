const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// UPDATE YOUR MONGOOSE CONNECTION HERE
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout fast if connection fails
  bufferCommands: false,          // Fail immediately instead of hanging for 10s
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => console.error('MongoDB connection error:', err));

// Register Routes
app.use('/api/listings', require('./routes/listings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));

app.get('/', (req, res) => {
  res.send('Teacher Connect API is running');
});

module.exports = app;
