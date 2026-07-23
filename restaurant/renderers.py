from rest_framework.renderers import JSONRenderer

class StandardizedJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        request = renderer_context.get('request')
        if request and not request.path.startswith('/api/v1/'):
            return super().render(data, accepted_media_type, renderer_context)

        # Evitar formatear dos veces si ya viene formateado con 'ok'
        if isinstance(data, dict) and 'ok' in data:
            return super().render(data, accepted_media_type, renderer_context)

        response = renderer_context.get('response')
        status_code = response.status_code if response else 200

        # Es un error si el status_code es mayor o igual a 400
        is_error = status_code >= 400
        
        formatted_data = {
            "ok": not is_error,
            "message": "Operación realizada correctamente" if not is_error else "No se pudo completar la operación",
            "data": None if is_error else data,
            "errors": []
        }

        if is_error:
            # Procesar el detalle de errores de DRF
            if isinstance(data, dict):
                for field, detail in data.items():
                    if isinstance(detail, list):
                        for msg in detail:
                            formatted_data["errors"].append({
                                "field": field,
                                "detail": str(msg)
                            })
                    else:
                        formatted_data["errors"].append({
                            "field": field,
                            "detail": str(detail)
                        })
            elif isinstance(data, list):
                formatted_data["errors"].append({
                    "field": "non_field_errors",
                    "detail": str(data[0]) if data else "Error desconocido"
                })
            else:
                formatted_data["errors"].append({
                    "field": "detail",
                    "detail": str(data)
                })
            
            # Si hay un error general en 'detail' o 'error', podemos subirlo al message
            if isinstance(data, dict):
                if 'detail' in data:
                    formatted_data["message"] = str(data['detail'])
                elif 'error' in data:
                    formatted_data["message"] = str(data['error'])

        return super().render(formatted_data, accepted_media_type, renderer_context)
