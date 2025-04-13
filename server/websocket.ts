import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { saveChatMessage, getChatHistory } from './storage';
import { createServer } from 'http';
import { fork } from 'child_process';
import path from 'path';

interface IsolatedSession {
  ws: WebSocket;
  server: WebSocketServer;
  ip: string;
  deviceId: string;
}

interface DeviceConnection {
  deviceId: string;
  port: number;
  connectedAt: Date;
  lastActive: Date;
}

interface IsolatedProcess {
  process: any;
  port: number;
  deviceId: string;
}

const activeIsolatedSessions = new Map<string, IsolatedSession>();
const activeConnections = new Map<string, DeviceConnection>();
const activeProcesses = new Map<string, IsolatedProcess>();
const deviceServers = new Map<string, {
  httpServer: any;
  wss: WebSocketServer;
  ws?: WebSocket;
}>();

let portCounter = 3000;

/**
 * Create a WebSocket server for real-time updates
 * @param server - HTTP server instance
 * @returns WebSocket server instance
 */
export function createWebSocketServer(server: Server) {
  // Main server just for connection handoff
  const mainWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const deviceId = request.headers['x-device-id'] as string;
    
    if (!deviceId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    console.log(`WebSocket connection from device ID: ${deviceId}`);
    
    // Create isolated connection for this device
    const wss = new WebSocketServer({ noServer: true });
    
    wss.on('connection', (ws) => {
      const sessionId = `${deviceId}-${Date.now()}`;
      
      activeIsolatedSessions.set(sessionId, {
        ws,
        server: wss,
        ip: request.socket.remoteAddress || 'unknown',
        deviceId
      });

      console.log('WebSocket client connected');

      // Send initialization message with session details
      ws.send(JSON.stringify({
        type: 'session_init',
        sessionId,
        deviceId,
        ipAddress: request.socket.remoteAddress || 'unknown'
      }));

      // Send welcome message with device ID
      ws.send(JSON.stringify({
        type: 'connection',
        deviceId,
        message: 'Connected to Ecosense WebSocket Server'
      }));

      // Send chat history for this device
      getChatHistory(deviceId).then(history => {
        ws.send(JSON.stringify({
          type: 'history',
          messages: history
        }));
      });

      // Handle messages - only this single connection exists
      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          
          // Validate session
          if (!parsed.sessionId || !activeIsolatedSessions.has(parsed.sessionId)) {
            return ws.close(1008, 'Invalid session');
          }
          
          // Handle chat messages
          if (parsed.type === 'chat') {
            // Only echo back to same connection
            ws.send(JSON.stringify({
              ...parsed,
              sessionId,
              timestamp: new Date().toISOString()
            }));

            // Save message to device-specific history
            saveChatMessage(deviceId, parsed.content, parsed.role || 'user');
          } else {
            // Handle different message types
            switch (parsed.type) {
              case 'subscribe':
                handleSubscription(ws, parsed);
                break;
              default:
                console.log('Unknown message type:', parsed.type);
            }
          }
        } catch (error) {
          console.error('Isolated session error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        activeIsolatedSessions.delete(sessionId);
      });
    });

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  return mainWss;
}

/**
 * Handle subscription requests
 * @param ws - WebSocket client
 * @param message - Subscription message
 */
function handleSubscription(ws: WebSocket, message: any) {
  const { channel } = message;
  console.log(`Client subscribed to ${channel}`);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    channel
  }));
}

/**
 * Broadcast a message to all connected clients
 * @param wss - WebSocketServer
 * @param message - Message to broadcast
 */
export function broadcastMessage(wss: WebSocketServer, message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

export function createDeviceIsolatedServer(basePort: number) {
  // Main server just tracks all device servers
  const mainServer = createServer();
  
  // Generate unique ports for each device
  let portCounter = basePort;
  
  return {
    server: mainServer,
    createForDevice: (deviceId: string) => {
      const port = portCounter++;
      const httpServer = createServer();
      
      const wss = new WebSocketServer({ server: httpServer });
      wss.on('connection', (ws) => {
        deviceServers.set(deviceId, { httpServer, wss, ws });
        
        // Completely isolated connection
        ws.on('message', (message) => {
          // Only echo back to same device
          ws.send(message);
        });

        const deviceConnection: DeviceConnection = {
          deviceId,
          port,
          connectedAt: new Date(),
          lastActive: new Date()
        };

        activeConnections.set(deviceId, deviceConnection);

        ws.on('close', () => {
          activeConnections.delete(deviceId);
        });
      });
      
      httpServer.listen(port, () => {
        console.log(`Isolated server for ${deviceId} on port ${port}`);
      });
      
      return {
        port,
        close: () => {
          httpServer.close();
          deviceServers.delete(deviceId);
        }
      };
    }
  };
}

export function createIsolatedProcess(deviceId: string) {
  const port = portCounter++;
  const workerPath = path.join(__dirname, 'worker.js');
  
  const worker = fork(workerPath, [
    '--device-id', deviceId,
    '--port', port.toString()
  ]);
  
  const processInfo: IsolatedProcess = {
    process: worker,
    port,
    deviceId
  };
  
  activeProcesses.set(deviceId, processInfo);
  
  worker.on('exit', () => {
    activeProcesses.delete(deviceId);
  });
  
  return {
    port,
    disconnect: () => worker.kill()
  };
}

function generateDeviceId(req: any): string {
  return [
    req.headers['user-agent'],
    req.headers['sec-websocket-key'],
    req.socket.remoteAddress,
    Date.now()
  ].join('-');
}

function cleanupInactiveDevices() {
  const now = new Date();
  for (const [deviceId, conn] of activeConnections) {
    if (now.getTime() - conn.lastActive.getTime() > 30 * 60 * 1000) {
      deviceServers.get(deviceId)?.close();
      activeConnections.delete(deviceId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveDevices, 5 * 60 * 1000);