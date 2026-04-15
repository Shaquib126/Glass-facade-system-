import { io } from 'socket.io-client';

const URL = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3000';

export const socket = io(URL, {
  autoConnect: false,
});
