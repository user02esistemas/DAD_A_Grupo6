from django.urls import path
from . import views

urlpatterns = [
    # Caja API Endpoints (V1)
    path('apertura/', views.api_abrir_turno, name='v1_caja_apertura'),
    path('cierre/', views.api_cerrar_turno, name='v1_caja_cierre'),
    path('turno-activo/', views.api_turno_activo, name='v1_caja_turno_activo'),
    path('historial/', views.api_historial_pagos, name='v1_caja_historial'),
    path('pagar/<int:pk>/', views.api_pagar_comanda, name='v1_caja_pagar'),
    path('registrar-perdida/<int:pk>/', views.api_registrar_perdida, name='v1_caja_perdida'),
]
