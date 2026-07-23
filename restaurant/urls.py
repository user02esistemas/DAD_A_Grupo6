from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from django.views.generic import TemplateView
from apps.usuarios.views import DashboardRedirectView, DocumentacionView, LoginWebView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── Raíz → redirigir según Rol ───────────────────────────────────────────
    path('', DashboardRedirectView.as_view(), name='index'),

    # ── PWA ──────────────────────────────────────────────────────────────────
    path('manifest.json', TemplateView.as_view(template_name='manifest.json', content_type='application/json'), name='manifest'),
    path('sw.js', TemplateView.as_view(template_name='sw.js', content_type='application/javascript'), name='sw'),
    path('offline/', TemplateView.as_view(template_name='offline.html'), name='offline'),

    # ── Autenticación ─────────────────────────────────────────────────────────
    path('login/', LoginWebView.as_view(), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='/login/'), name='logout'),

    # ── Vistas de los módulos (HTML) ─────────────────────────────────────────
    path('mesero/', include('apps.mesas.urls')),
    path('mesero/', include('apps.comandas.urls')),
    path('admin-panel/', include('apps.reportes.urls')),
    
    path('cocina/', include('apps.comandas.urls_cocina')),
    path('caja/', include('apps.caja.urls')),

    # ── Documentación ────────────────────────────────────────────────────────
    path('documentacion/', DocumentacionView.as_view(), name='documentacion'),

    # ── API REST v1 ──────────────────────────────────────────────────────────
    path('api/v1/',         include('restaurant.api_v1_urls')),

    # ── API REST (Legacy) ────────────────────────────────────────────────────
    path('api/',            include('apps.usuarios.urls')),
    path('api/mesas/',      include('apps.mesas.api_urls')),
    path('api/menu/',       include('apps.menu.api_urls')),
    path('api/comandas/',   include('apps.comandas.api_urls')),
    path('api/inventario/', include('apps.inventario.urls')),
    
    # ── KDS APIs (Phase 4) ───────────────────────────────────────────────────
    path('api/cocina/',     include('apps.comandas.api_cocina_urls')),
    path('api/lineas/',     include('apps.comandas.api_lineas_urls')),

    # ── Documentación API (Swagger) ──────────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
