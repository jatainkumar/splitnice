import json
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # group_id -> list of active connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, group_id: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append(websocket)

    def disconnect(self, websocket: WebSocket, group_id: str):
        if group_id in self.active_connections:
            if websocket in self.active_connections[group_id]:
                self.active_connections[group_id].remove(websocket)
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]

    async def broadcast_to_group(self, group_id: str, message_data: dict):
        if group_id in self.active_connections:
            text_data = json.dumps(message_data)
            # Collect dead sockets to remove later
            dead_sockets = []
            for connection in self.active_connections[group_id]:
                try:
                    await connection.send_text(text_data)
                except Exception:
                    dead_sockets.append(connection)
            
            for dead in dead_sockets:
                self.disconnect(dead, group_id)

manager = ConnectionManager()
