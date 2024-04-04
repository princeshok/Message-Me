// server.js

// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());

// Serve static files
app.use(express.static('Public'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String }, // Path to the profile picture file
  status: { type: String }, // User's status message
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of user's friends
  archivedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }] // Array of archived messages
});


const User = mongoose.model('User', userSchema);

const authenticateUser = (req, res, next) => {
  // Get the token from the request headers
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is missing' });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    try {
      // Find the user associated with the token
      const user = await User.findById(decodedToken.userId);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Attach the user object to the request for further use
      req.user = user;
      next(); // Call the next middleware or route handler
    } catch (error) {
      console.error('Error authenticating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
};

module.exports = authenticateUser;

//Signup logic
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Validate the password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


  // Socket.io connection handling
  io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle new user joining
  socket.on('join', (username) => {
    // Notify other users that someone joined
    socket.broadcast.emit('userJoined', username);
  });

  // Handle incoming messages
  socket.on('sendMessage', (data) => {
    // Broadcast the message to all connected clients
    io.emit('messageReceived', data);
  });

  // Handle audio call
  socket.on('audioCall', (data) => {
    // Get the target user's socket ID and send them an audio call request
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('audioCallRequest', { initiatorSocketId: socket.id });
  });

  // Handle audio call acceptance
  socket.on('acceptAudioCall', (data) => {
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('audioCallAccepted');
  });

  // Handle audio call rejection
  socket.on('rejectAudioCall', (data) => {
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('audioCallRejected');
  });

  // Emit audio call event to the server
  socket.emit('audioCall', { targetSocketId: targetSocketId });

  // Handle incoming audio call request
  socket.on('audioCallRequest', (data) => {
    const initiatorSocketId = data.initiatorSocketId;
    // Prompt the user to accept or reject the incoming call
    // Based on user input, emit acceptAudioCall or rejectAudioCall event
  });

  // Handle audio call acceptance
  socket.on('audioCallAccepted', () => {
    // Start audio call by establishing a WebRTC peer connection
  });

  // Handle audio call rejection
  socket.on('audioCallRejected', () => {
    // Display a message indicating that the call was rejected
  });



  // Handle video call
  socket.on('videoCall', (data) => {
    // Get the target user's socket ID and send them a video call request
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('videoCallRequest', { initiatorSocketId: socket.id });
  });

  // Handle video call acceptance
  socket.on('acceptVideoCall', (data) => {
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('videoCallAccepted');
  });

  // Handle video call rejection
  socket.on('rejectVideoCall', (data) => {
    const targetSocketId = data.targetSocketId;
    io.to(targetSocketId).emit('videoCallRejected');
  });

  // Emit video call event to the server
  socket.emit('videoCall', { targetSocketId: targetSocketId });

  // Handle incoming video call request
  socket.on('videoCallRequest', (data) => {
    const initiatorSocketId = data.initiatorSocketId;
    // Prompt the user to accept or reject the incoming call
    // Based on user input, emit acceptVideoCall or rejectVideoCall event
  });

  // Handle video call acceptance
  socket.on('videoCallAccepted', () => {
    // Start video call by establishing a WebRTC peer connection
  });

  // Handle video call rejection
  socket.on('videoCallRejected', () => {
    // Display a message indicating that the call was rejected
  });



  // Handle disconnect
  socket.on('disconnect', () => {
    // Disconnect logic, e.g., notify other users that someone left
    console.log('A user disconnected');
  });
});


// Friend request routes
// Endpoint to send friend requests
app.post('/send-friend-request', authenticateUser, async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    // Logic to send friend request, e.g., update sender's and receiver's profiles
    res.status(200).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to respond to friend requests
app.post('/respond-to-friend-request', authenticateUser, async (req, res) => {
  try {
    const { requestId, response } = req.body;
    // Logic to respond to friend request, e.g., update sender's and receiver's profiles
    res.status(200).json({ message: 'Friend request responded successfully' });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to fetch user's list of friends
app.get('/friends', authenticateUser, async (req, res) => {
  try {
    // Assuming you have a User model with a 'friends' field that stores an array of user IDs representing friends
    const user = req.user; // Assuming the authenticated user object is available in req.user
    const friends = await User.find({ _id: { $in: user.friends } });
    res.status(200).json({ friends });
  } catch (error) {
    console.error('Error fetching user\'s list of friends:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


const multer = require('multer');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile-pictures'); // Destination folder for profile pictures
  },
  filename: function (req, file, cb) {
    // Generate unique filename for uploaded profile picture
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  }
});

// Multer upload instance
const upload = multer({ storage: storage });

// Endpoint to upload profile pictures
app.post('/upload-profile-picture', authenticateUser, upload.single('profilePicture'), async (req, res) => {
  try {
    // Assuming you have a User model with a 'profilePicture' field to store the path or URL of the profile picture
    req.user.profilePicture = req.file.path; // Assuming multer saves the file path in req.file.path
    await req.user.save();
    res.status(200).json({ message: 'Profile picture uploaded successfully' });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to update profile pictures
app.put('/update-profile-picture', authenticateUser, upload.single('profilePicture'), async (req, res) => {
  try {
    // Check if a profile picture file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No profile picture uploaded' });
    }

    // Update the user's profile picture with the new file path
    req.user.profilePicture = req.file.path; // Assuming multer saves the file path in req.file.path
    await req.user.save();

    // Respond with a success message
    res.status(200).json({ message: 'Profile picture updated successfully' });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to delete profile pictures
app.delete('/delete-profile-picture', authenticateUser, async (req, res) => {
  try {
    // Check if the user has a profile picture
    if (!req.user.profilePicture) {
      return res.status(400).json({ message: 'No profile picture found for the user' });
    }

    // Delete the profile picture from storage (assuming it's stored on the filesystem)
    // Replace this logic with your actual storage deletion mechanism
    fs.unlinkSync(req.user.profilePicture);

    // Clear the profile picture field in the user document
    req.user.profilePicture = undefined;
    await req.user.save();

    // Respond with a success message
    res.status(200).json({ message: 'Profile picture deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to post a status
app.post('/post-status', authenticateUser, async (req, res) => {
  try {
    const { status } = req.body;

    // Check if the status is provided
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Save the status to the user's document
    req.user.status = status;
    await req.user.save();

    // Respond with a success message
    res.status(201).json({ message: 'Status posted successfully' });
  } catch (error) {
    console.error('Error posting status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to update a status
app.put('/update-status', authenticateUser, async (req, res) => {
  try {
    const { status } = req.body;

    // Check if the status is provided
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Update the status in the user's document
    req.user.status = status;
    await req.user.save();

    // Respond with a success message
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to delete a status
app.delete('/delete-status', authenticateUser, async (req, res) => {
  try {
    // Check if the user has a status to delete
    if (!req.user.status) {
      return res.status(404).json({ message: 'No status found for the user' });
    }

    // Delete the status from the user's document
    req.user.status = null; // Assuming the status is stored in a field named 'status'
    await req.user.save();

    // Respond with a success message
    res.status(200).json({ message: 'Status deleted successfully' });
  } catch (error) {
    console.error('Error deleting status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint to fetch archived messages
app.get('/archived-messages', authenticateUser, async (req, res) => {
  try {
    // Check if the user has archived messages
    if (!req.user.archivedMessages || req.user.archivedMessages.length === 0) {
      return res.status(404).json({ message: 'No archived messages found for the user' });
    }

    // Fetch the archived messages from the user's document
    const archivedMessages = req.user.archivedMessages;

    // Respond with the fetched archived messages
    res.status(200).json({ archivedMessages });
  } catch (error) {
    console.error('Error fetching archived messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint to send voice message
app.post('/send-voice-message', authenticateUser, async (req, res) => {
  try {
    const { recipientId, voiceMessage } = req.body;
    
    // Validate recipientId and voiceMessage
    if (!recipientId || !voiceMessage) {
      return res.status(400).json({ message: 'RecipientId and voiceMessage are required' });
    }

    // Logic to send voice message to recipient
    // Example: Save the voice message to recipient's document
    // Example: Send notification to recipient

    res.status(200).json({ message: 'Voice message sent successfully' });
  } catch (error) {
    console.error('Error sending voice message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint to send photo or video
app.post('/send-media', authenticateUser, async (req, res) => {
  try {
    const { recipientId, media } = req.body;
    
    // Validate recipientId and media
    if (!recipientId || !media) {
      return res.status(400).json({ message: 'RecipientId and media are required' });
    }

    // Logic to send photo or video to recipient
    // Example: Save the media to recipient's document
    // Example: Send notification to recipient

    res.status(200).json({ message: 'Media sent successfully' });
  } catch (error) {
    console.error('Error sending media:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint for password recovery
app.post('/password-recovery', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Logic to recover password
    // Example: Send password reset link to user's email

    res.status(200).json({ message: 'Password recovery email sent successfully' });
  } catch (error) {
    console.error('Error sending password recovery email:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint to unfriend a user
app.post('/unfriend', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Logic to unfriend the user
    // Example: Remove userId from user's friend list
    // Example: Remove user from userId's friend list

    res.status(200).json({ message: 'User unfriended successfully' });
  } catch (error) {
    console.error('Error unfriending user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
