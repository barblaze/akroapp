import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // In-memory storage for the agenda
  // In a real app, this would be a database
  let agenda: any[] = [];

  // API routes
  app.get("/api/agenda", (req, res) => {
    res.json(agenda);
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send initial agenda
    socket.emit("agenda:sync", agenda);

    socket.on("agenda:book", (booking) => {
      // Add booking
      const newBooking = { ...booking, id: Date.now().toString() };
      agenda.push(newBooking);
      // Broadcast to all
      io.emit("agenda:sync", agenda);
      
      // Emit notification for trainers/admins
      io.emit("notification:broadcast", {
        id: Date.now().toString(),
        type: 'new-booking',
        message: `Nueva reserva: ${booking.nombre} ${booking.apellido} en ${booking.type} (${booking.day} ${booking.time})`,
        timestamp: Date.now()
      });
    });

    socket.on("agenda:cancel", (bookingId) => {
      const booking = agenda.find(b => b.id === bookingId);
      if (booking) {
        // Remove booking
        agenda = agenda.filter((b) => b.id !== bookingId);
        // Broadcast to all
        io.emit("agenda:sync", agenda);

        // Emit notification
        io.emit("notification:broadcast", {
          id: Date.now().toString(),
          type: 'cancel-booking',
          message: `Reserva cancelada: ${booking.nombre} ${booking.apellido} (${booking.day} ${booking.time})`,
          timestamp: Date.now()
        });
      }
    });

    socket.on("agenda:add-class", (newClass) => {
      // Add a class (admin/trainer feature)
      agenda.push({ ...newClass, id: Date.now().toString(), type: 'class' });
      io.emit("agenda:sync", agenda);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
