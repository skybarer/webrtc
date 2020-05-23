//require our websocket library
import { Server as WebSocketServer } from 'ws';

//creating a websocket server at port 9090
var wss = new WebSocketServer({ port: 9090 });

//when a user connects to our sever
wss.on('connection', function(connection) {
	console.log('user connected');

	//when server gets a message from a connected user
	connection.on('message', function(message) {
		console.log('Got message from a user:', message);
	});

	connection.send('Hello from server');
});
