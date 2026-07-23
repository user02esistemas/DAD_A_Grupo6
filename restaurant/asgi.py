import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'restaurant.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from apps.notificaciones.routing import websocket_urlpatterns as notif_ws
from apps.comandas.consumers import KDSConsumer
from restaurant.middleware import JWTAuthMiddlewareStack

# Combinar WebSocket routes de notificaciones y KDS
all_ws_patterns = notif_ws + [
    re_path(r'^ws/cocina/kds/$', KDSConsumer.as_asgi()),
    re_path(r'^ws/caja/$', __import__('apps.caja.consumers').caja.consumers.CajaConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(
            all_ws_patterns
        )
    ),
})
