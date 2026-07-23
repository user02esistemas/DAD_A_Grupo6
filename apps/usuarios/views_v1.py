from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers_v1 import V1TokenObtainPairSerializer, get_permisos_por_rol
from .services import UsuarioService

class V1LoginView(TokenObtainPairView):
    serializer_class = V1TokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        response = super().post(request, *args, **kwargs)
        if response.status_code >= 400:
            UsuarioService.registrar_login_fallido(username, request=request)
        else:
            UsuarioService.registrar_login_exitoso(username)
        return response

class V1TokenRefreshView(TokenRefreshView):
    pass

class V1LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Sesión cerrada correctamente."})
        except Exception as e:
            return Response({"detail": "Token inválido o expirado."}, status=status.HTTP_400_BAD_REQUEST)

class V1MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            'id': user.id,
            'username': user.username,
            'nombres': user.nombres,
            'apellidos': user.apellidos,
            'correo': user.email,
            'rol': user.rol.nombre,
            'permisos': get_permisos_por_rol(user.rol.nombre)
        }
        return Response(data)
