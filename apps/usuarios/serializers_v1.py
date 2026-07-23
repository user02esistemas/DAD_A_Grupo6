from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers

def get_permisos_por_rol(rol_nombre):
    permisos = []
    if rol_nombre == 'MOZO':
        permisos = ['VER_MESAS', 'CREAR_COMANDA', 'VER_MENU']
    elif rol_nombre == 'COCINERO':
        permisos = ['VER_KDS', 'ACTUALIZAR_ESTADO_PLATO']
    elif rol_nombre == 'CAJERO':
        permisos = ['VER_CAJA', 'COBRAR_COMANDA', 'CERRAR_TURNO']
    elif rol_nombre == 'ADMIN':
        permisos = ['VER_DASHBOARD', 'GESTIONAR_TRABAJADORES', 'VER_REPORTES', 'VER_INVENTARIO']
    return permisos

class V1TokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['rol'] = user.rol.nombre
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Flatten response or structure it neatly
        data['id'] = self.user.id
        data['username'] = self.user.username
        data['nombres'] = self.user.nombres
        data['apellidos'] = self.user.apellidos
        data['correo'] = self.user.email
        data['rol'] = self.user.rol.nombre
        data['permisos'] = get_permisos_por_rol(self.user.rol.nombre)
        
        return data
