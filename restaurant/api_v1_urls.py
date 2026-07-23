from django.urls import path, include
from apps.usuarios.views_v1 import V1LoginView, V1TokenRefreshView, V1LogoutView, V1MeView

urlpatterns = [
    # Auth
    path('auth/login/', V1LoginView.as_view(), name='v1_login'),
    path('auth/refresh/', V1TokenRefreshView.as_view(), name='v1_refresh'),
    path('auth/logout/', V1LogoutView.as_view(), name='v1_logout'),
    path('auth/me/', V1MeView.as_view(), name='v1_me'),

    # Reutilizando endpoints existentes que ahora serán formateados por el renderer
    path('usuarios/', include('apps.usuarios.urls')),
    path('mesas/', include('apps.mesas.api_urls')),
    path('menu/', include('apps.menu.api_urls')),
    path('comandas/', include('apps.comandas.api_urls')),
    path('cocina/', include('apps.comandas.api_cocina_urls')),
    path('inventario/', include('apps.inventario.urls')),
    path('caja/', include('apps.caja.api_urls')),
    # path('reportes/', include('apps.reportes.urls')), # si hay api_urls
]
