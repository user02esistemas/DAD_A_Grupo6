import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class CajaConsumer(AsyncJsonWebsocketConsumer):
    CAJA_GROUP = 'caja_updates'

    async def connect(self):
        user = self.scope.get('user')
        if user and user.is_authenticated and user.rol.nombre in ['CAJERO', 'ADMIN']:
            await self.channel_layer.group_add(
                self.CAJA_GROUP,
                self.channel_name,
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.CAJA_GROUP,
            self.channel_name,
        )

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type', '')
        if msg_type == 'ping':
            await self.send_json({'type': 'pong'})

    async def caja_update(self, event):
        await self.send_json({
            'type': 'caja_update',
            'action': event.get('action', 'refresh'),
            'mesa_id': event.get('mesa_id'),
        })
