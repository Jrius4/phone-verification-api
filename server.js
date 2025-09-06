require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const jobsRouter = require('./routes/jobs');
const {Server} = require('socket.io');


const app = express();
const PORT = process.env.PORT || 3000;
const server = require('http').createServer(app);

const io = new Server(server,{
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});


// attach io to req for route handlers that need to emit
app.use((req, _res, next) => { req.io = io; next(); });

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes - make sure this line is correct
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
// api routes
app.use('/api/driver/jobs', jobsRouter);

// socket logging (optional)
io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected', socket.id));
});


// Health check endpoint - CORRECT
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - CORRECT
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const listEndpoints = require('express-list-endpoints');
console.table(listEndpoints(app)); 
