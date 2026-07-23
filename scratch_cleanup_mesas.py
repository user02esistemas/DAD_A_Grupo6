import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "restaurant.settings")
django.setup()

from apps.mesas.models import Mesa, UnionMesas
from apps.comandas.models import Comanda

print("Eliminando todas las uniones de mesas...")
UnionMesas.objects.all().delete()

print("Anulando todas las comandas activas...")
Comanda.objects.filter(estado__in=['ABIERTA', 'EN_PREPARACION', 'LISTA']).update(estado='ANULADA')

print("Liberando todas las mesas...")
Mesa.objects.all().update(estado='LIBRE')

print("¡Limpieza completada!")
