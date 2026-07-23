from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from apps.usuarios.models import Usuario

@database_sync_to_async
def get_user_from_jwt(token):
    try:
        access_token = AccessToken(token)
        user_id = access_token['user_id']
        return Usuario.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware:
    """
    Middleware para autenticar conexiones de WebSocket usando un JWT.
    Extrae el token del query string ?token=<jwt>
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        
        token = query_params.get('token', [None])[0]
        
        if token:
            scope['user'] = await get_user_from_jwt(token)
        else:
            # Si no hay token, podemos intentar obtener el usuario de la sesión (si existe)
            if 'user' not in scope:
                scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)

def JWTAuthMiddlewareStack(inner):
    from channels.auth import AuthMiddlewareStack
    # Primero AuthMiddlewareStack (para cookies/sesiones) y luego JWTAuthMiddleware
    return AuthMiddlewareStack(JWTAuthMiddleware(inner))
