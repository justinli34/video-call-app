import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Store active users in rooms
const rooms = {}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id)

  socket.on("join-room", (roomId) => {
    console.log(`User ${socket.id} joined room ${roomId}`)

    // Leave previous room if any
    if (socket.roomId) {
      socket.leave(socket.roomId)
      if (rooms[socket.roomId]) {
        rooms[socket.roomId] = rooms[socket.roomId].filter((id) => id !== socket.id)
      }
    }

    // Join new room
    socket.join(roomId)
    socket.roomId = roomId

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = []
    }

    // Add user to room
    rooms[roomId].push(socket.id)

    // Notify other users in the room
    socket.to(roomId).emit("user-connected", socket.id)

    // Send list of existing users to the new user
    const existingUsers = rooms[roomId].filter((id) => id !== socket.id)
    if (existingUsers.length > 0) {
      socket.emit("existing-users", existingUsers)
    }
  })

  // WebRTC signaling
  socket.on("offer", ({ offer, to }) => {
    console.log(`Relaying offer from ${socket.id} to ${to}`)
    io.to(to).emit("offer", { offer, from: socket.id })
  })

  socket.on("answer", ({ answer, to }) => {
    console.log(`Relaying answer from ${socket.id} to ${to}`)
    io.to(to).emit("answer", { answer, from: socket.id })
  })

  socket.on("ice-candidate", ({ candidate, to }) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${to}`)
    io.to(to).emit("ice-candidate", { candidate, from: socket.id })
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    // Remove user from room
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter((id) => id !== socket.id)

      // Notify other users in the room
      socket.to(socket.roomId).emit("user-disconnected", socket.id)

      // Clean up empty rooms
      if (rooms[socket.roomId].length === 0) {
        delete rooms[socket.roomId]
      }
    }
  })
})

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(__dirname, "client/build")))
  app.get("*", (req, res) => {
    res.sendFile(join(__dirname, "client/build", "index.html"))
  })
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Log active rooms every 5 minutes
setInterval(() => {
  console.log("Active rooms:", Object.keys(rooms).length)
  console.log("Active users:", Object.values(rooms).flat().length)
}, 300000)

// For testing the server
console.log("Video call signaling server is running!")
console.log(`Listening on port ${PORT}`)

