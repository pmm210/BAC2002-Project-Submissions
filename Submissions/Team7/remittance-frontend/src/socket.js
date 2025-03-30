import { io } from "socket.io-client";

// Connect to the WebSocket server
const socket = io("http://localhost:5000");

export default socket;
