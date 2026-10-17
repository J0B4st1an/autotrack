import http.server
import socketserver
import json
import os
import sys
import urllib.parse
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 3000
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'tracker_db.json')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

STAGES = [
  { "index": 1, "name": "Vehículo en Proceso de Asignación", "description": "Asignación de VIN, chasis y confirmación de pedido.", "icon": "clipboard-check", "est_pct": 15 },
  { "index": 2, "name": "Vehículo en Transporte", "description": "En tránsito desde planta o puerto hacia el concesionario.", "icon": "truck", "est_pct": 30 },
  { "index": 3, "name": "Vehículo Recibido", "description": "Recepción en patio, inspección física y documental inicial.", "icon": "building-warehouse", "est_pct": 45 },
  { "index": 4, "name": "En Alistamiento", "description": "Mecánica rápida, instalación de accesorios y detallado/lavado.", "icon": "wrench", "est_pct": 65 },
  { "index": 5, "name": "Documentación en Proceso", "description": "Trámite de matrícula, SOAT, expedición de placas y póliza.", "icon": "file-text", "est_pct": 85 },
  { "index": 6, "name": "Listo para Entrega", "description": "Vehículo 100% verificado. Cita de entrega agendada.", "icon": "sparkles", "est_pct": 95 },
  { "index": 7, "name": "Entregado", "description": "Acta de entrega firmada y llaves entregadas al cliente.", "icon": "key", "est_pct": 100 }
]

def read_db():
    if not os.path.exists(DB_PATH):
        return {"vehicles": [], "users": []}
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return {"vehicles": data, "users": []}
            return data
    except Exception as e:
        print("Error leyendo DB:", e)
        return {"vehicles": [], "users": []}

def write_db(data):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class AutoTrackHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query_params = urllib.parse.parse_qs(parsed.query)

        if path == '/api/stages':
            return self._send_json({"success": True, "stages": STAGES})

        if path == '/api/users':
            db_data = read_db()
            return self._send_json({"success": True, "users": db_data.get('users', [])})

        if path == '/api/client/my-vehicle':
            v_id = query_params.get('vehicle_id', [''])[0]
            db_data = read_db()
            vehicles = db_data.get('vehicles', [])
            found = next((v for v in vehicles if v['id'].lower() == v_id.lower()), None)
            
            if not found:
                return self._send_json({"success": False, "message": "Vehículo no encontrado"}, 404)

            stage_info = next((s for s in STAGES if s['index'] == found['current_stage_index']), STAGES[0])
            created_dt = datetime.fromisoformat(found['created_at'].replace('Z', '+00:00'))
            days_elapsed = max(1, (datetime.now() - created_dt.replace(tzinfo=None)).days)

            return self._send_json({
                "success": True,
                "vehicle": found,
                "stages": STAGES,
                "currentStageInfo": stage_info,
                "daysElapsed": days_elapsed
            })

        if path == '/api/vehicles':
            db_data = read_db()
            vehicles = db_data.get('vehicles', [])
            if 'stage' in query_params:
                stg = int(query_params['stage'][0])
                vehicles = [v for v in vehicles if v['current_stage_index'] == stg]
            if 'type' in query_params:
                tp = query_params['type'][0].lower()
                vehicles = [v for v in vehicles if v['vehicle_type'].lower() == tp]
            if 'search' in query_params:
                sq = query_params['search'][0].lower()
                vehicles = [v for v in vehicles if (
                    sq in v['client_name'].lower() or
                    sq in v['client_doc'].lower() or
                    sq in v['vin'].lower() or
                    sq in v['order_code'].lower()
                )]
            return self._send_json({"success": True, "count": len(vehicles), "vehicles": vehicles})

        if path == '/api/metrics':
            db_data = read_db()
            vehicles = db_data.get('vehicles', [])
            total = len(vehicles)
            active = sum(1 for v in vehicles if v['current_stage_index'] < 7)
            delivered = sum(1 for v in vehicles if v['current_stage_index'] == 7)

            stage_dist = []
            for s in STAGES:
                cnt = sum(1 for v in vehicles if v['current_stage_index'] == s['index'])
                stage_dist.append({"stage_index": s['index'], "stage_name": s['name'], "count": cnt})

            delayed = []
            for v in vehicles:
                if v['current_stage_index'] < 7:
                    c_dt = datetime.fromisoformat(v['created_at'].replace('Z', '+00:00')).replace(tzinfo=None)
                    days = (datetime.now() - c_dt).days
                    if days > v.get('estimated_delivery_days', 14):
                        delayed.append(v)

            return self._send_json({
                "success": True,
                "metrics": {
                    "total_vehicles": total,
                    "active_vehicles": active,
                    "delivered_vehicles": delivered,
                    "delayed_vehicles_count": len(delayed),
                    "avg_satisfaction_rating": "4.9",
                    "stage_distribution": stage_dist,
                    "delayed_list": [{"id": x['id'], "client_name": x['client_name'], "brand_model": x['brand_model'], "stage": x['current_stage_name'], "estimated_days": x.get('estimated_delivery_days', 14)} for x in delayed]
                }
            })

        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        parsed = urllib.parse.urlparse(self.path)

        # 1. LOGIN ADMINISTRATIVO & STAFF
        if parsed.path == '/api/auth/admin-login':
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            db_data = read_db()
            users = db_data.get('users', [])

            found_user = next((u for u in users if (u['username'].lower() == username or u['email'].lower() == username) and u['password'] == password and u.get('role') != 'client'), None)
            if not found_user:
                return self._send_json({"success": False, "message": "Credenciales administrativas incorrectas"}, 401)

            return self._send_json({
                "success": True,
                "user": {
                    "id": found_user['id'],
                    "username": found_user['username'],
                    "client_name": found_user['client_name'],
                    "email": found_user['email'],
                    "role": found_user.get('role', 'admin')
                }
            })

        # 2. LOGIN CLIENTE
        if parsed.path == '/api/auth/login':
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            db_data = read_db()
            users = db_data.get('users', [])

            found_user = next((u for u in users if (u['username'].lower() == username or u['email'].lower() == username or u.get('client_doc','').lower() == username) and u['password'] == password), None)
            if not found_user:
                return self._send_json({"success": False, "message": "Usuario o contraseña incorrectos"}, 401)

            vehicles = db_data.get('vehicles', [])
            vehicle = next((v for v in vehicles if v['id'].lower() == (found_user.get('vehicle_id') or '').lower()), None)

            return self._send_json({
                "success": True,
                "user": {
                    "id": found_user['id'],
                    "username": found_user['username'],
                    "client_name": found_user['client_name'],
                    "email": found_user['email'],
                    "vehicle_id": found_user.get('vehicle_id'),
                    "must_change_password": found_user.get('must_change_password', True),
                    "role": found_user.get('role', 'client')
                },
                "vehicle": vehicle
            })

        # 3. CAMBIO DE CONTRASEÑA
        if parsed.path == '/api/auth/change-password':
            user_id = body.get('userId')
            old_pwd = body.get('oldPassword')
            new_pwd = body.get('newPassword')

            db_data = read_db()
            users = db_data.get('users', [])
            usr = next((u for u in users if u['id'] == user_id), None)

            if not usr:
                return self._send_json({"success": False, "message": "Usuario no encontrado"}, 400)
            if usr['password'] != old_pwd:
                return self._send_json({"success": False, "message": "La contraseña actual no es correcta"}, 400)

            usr['password'] = new_pwd
            usr['must_change_password'] = False
            write_db(db_data)
            return self._send_json({"success": True, "user": usr})

        # 4. CREAR NUEVO PEDIDO Y CLIENTE
        if parsed.path == '/api/vehicles':
            db_data = read_db()
            vehicles = db_data.get('vehicles', [])
            users = db_data.get('users', [])

            new_id = f"VEH-{1001 + len(vehicles)}"
            v_type = body.get('vehicle_type', 'Automóvil')
            est_days = 7 if v_type == 'Motocicleta' else 15

            new_v = {
                "id": new_id,
                "order_code": body.get('order_code', f"PED-2024-{1000 + len(vehicles)}"),
                "vin": body.get('vin', f"9BW{new_id}XYZ123"),
                "client_doc": body.get('client_doc'),
                "client_name": body.get('client_name'),
                "client_phone": body.get('client_phone', "+57 300 000 0000"),
                "client_email": body.get('client_email', "cliente@email.com"),
                "vehicle_type": v_type,
                "brand_model": body.get('brand_model'),
                "color": body.get('color', 'Blanco'),
                "dealership_branch": "Almotores - Sede Principal",
                "advisor_name": body.get('advisor_name', 'Laura Gómez'),
                "advisor_phone": "+57 300 123 4567",
                "current_stage_index": 1,
                "current_stage_name": STAGES[0]['name'],
                "estimated_delivery_days": est_days,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "estimated_delivery_date": (datetime.now() + timedelta(days=est_days)).strftime('%Y-%m-%d'),
                "checklist": [
                    {"id": "chk_1", "title": "Inspección inicial física", "completed": True, "category": "Recepción"},
                    {"id": "chk_2", "title": "Alistamiento mecánico", "completed": False, "category": "Alistamiento"}
                ],
                "status_history": [{
                    "stage_index": 1, "stage_name": STAGES[0]['name'], "date": datetime.now().isoformat(),
                    "notes": "Registro de nuevo pedido.", "updated_by": body.get('advisor_name', 'Asesor')
                }],
                "satisfaction_rating": None
            }
            vehicles.append(new_v)

            raw_user = (body.get('client_name') or 'cliente').lower().split(' ')[0] + "." + (body.get('client_name') or 'usuario').lower().split(' ')[-1]
            clean_username = ''.join(c for c in raw_user if c.isalnum() or c == '.')
            temp_pwd = f"Temp{1000 + len(users)}"

            new_u = {
                "id": f"USR-{1001 + len(users)}",
                "username": clean_username,
                "password": temp_pwd,
                "client_doc": body.get('client_doc'),
                "client_name": body.get('client_name'),
                "email": body.get('client_email', f"{clean_username}@email.com"),
                "vehicle_id": new_id,
                "must_change_password": True,
                "role": "client"
            }
            users.append(new_u)

            write_db({"vehicles": vehicles, "users": users})
            return self._send_json({"success": True, "vehicle": new_v, "createdUser": new_u}, 201)

        return self._send_json({"success": False, "message": "Acción no soportada"}, 400)

    def do_PATCH(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        parsed = urllib.parse.urlparse(self.path)

        if '/status' in parsed.path:
            v_id = parsed.path.split('/')[3]
            db_data = read_db()
            vehicles = db_data.get('vehicles', [])
            stg_idx = int(body.get('stage_index', 1))
            stg_obj = next((s for s in STAGES if s['index'] == stg_idx), STAGES[0])

            for v in vehicles:
                if v['id'].lower() == v_id.lower():
                    v['current_stage_index'] = stg_obj['index']
                    v['current_stage_name'] = stg_obj['name']
                    v['updated_at'] = datetime.now().isoformat()
                    v['status_history'].append({
                        "stage_index": stg_obj['index'],
                        "stage_name": stg_obj['name'],
                        "date": datetime.now().isoformat(),
                        "notes": body.get('notes', f"Cambio a {stg_obj['name']}"),
                        "updated_by": body.get('updated_by', 'Personal Operativo')
                    })
                    write_db(db_data)
                    return self._send_json({"success": True, "message": f"Estado actualizado a: {stg_obj['name']}", "vehicle": v})

        return self._send_json({"success": False, "message": "No encontrado"}, 404)

if __name__ == '__main__':
    db_data = read_db()
    if not db_data.get('users'):
        vehicles_seed = [
          {
            "id": "VEH-1001", "order_code": "PED-2024-8891", "vin": "9BWCA111000123456", "client_doc": "1098765432",
            "client_name": "Carlos Eduardo Mendoza", "client_phone": "+57 315 890 1234", "client_email": "carlos.mendoza@email.com",
            "vehicle_type": "Automóvil", "brand_model": "Mazda CX-30 Grand Touring 2024", "color": "Rojo Cristal Metalizado",
            "dealership_branch": "Almotores - Sede Principal Norte", "advisor_name": "Laura Gómez", "advisor_phone": "+57 300 123 4567",
            "current_stage_index": 4, "current_stage_name": "En Alistamiento", "estimated_delivery_days": 14,
            "created_at": (datetime.now() - timedelta(days=8)).isoformat(), "updated_at": (datetime.now() - timedelta(days=1)).isoformat(),
            "estimated_delivery_date": (datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d'),
            "checklist": [
              { "id": "chk_1", "title": "Inspección física inicial", "completed": True, "category": "Recepción" },
              { "id": "chk_2", "title": "Inspección mecánica y fluidos", "completed": True, "category": "Alistamiento" },
              { "id": "chk_3", "title": "Lavado y detallado de entrega", "completed": False, "category": "Alistamiento" }
            ],
            "status_history": [
              { "stage_index": 1, "stage_name": "Vehículo en Proceso de Asignación", "date": (datetime.now() - timedelta(days=8)).isoformat(), "notes": "VIN asignado y pedido confirmado.", "updated_by": "Sistema" },
              { "stage_index": 4, "stage_name": "En Alistamiento", "date": (datetime.now() - timedelta(days=1)).isoformat(), "notes": "Ingreso a taller para polarizado.", "updated_by": "Jefe de Alistamiento" }
            ],
            "satisfaction_rating": None
          },
          {
            "id": "VEH-1002", "order_code": "PED-2024-9042", "vin": "93YMT07X998877665", "client_doc": "52431980",
            "client_name": "María Fernanda Ríos", "client_phone": "+57 320 456 7890", "client_email": "mf.rios@email.com",
            "vehicle_type": "Motocicleta", "brand_model": "Yamaha MT-07 ABS 2024", "color": "Cyan Storm",
            "dealership_branch": "Almotores - Sede Sur Motos", "advisor_name": "Julián Ruiz", "advisor_phone": "+57 312 987 6543",
            "current_stage_index": 6, "current_stage_name": "Listo para Entrega", "estimated_delivery_days": 6,
            "created_at": (datetime.now() - timedelta(days=5)).isoformat(), "updated_at": (datetime.now() - timedelta(days=1)).isoformat(),
            "estimated_delivery_date": (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
            "checklist": [
              { "id": "chk_1", "title": "Ensamble final y torque de ruedas", "completed": True, "category": "Alistamiento" },
              { "id": "chk_2", "title": "Carga y prueba de batería", "completed": True, "category": "Alistamiento" }
            ],
            "status_history": [
              { "stage_index": 6, "stage_name": "Listo para Entrega", "date": (datetime.now() - timedelta(days=1)).isoformat(), "notes": "Cliente citada.", "updated_by": "Julián Ruiz" }
            ],
            "satisfaction_rating": None
          }
        ]
        users_seed = [
          {
            "id": "ADM-001", "username": "admin", "password": "Admin1234*", "client_doc": "00000001",
            "client_name": "Administrador General", "email": "admin@autotrack.com", "vehicle_id": None,
            "must_change_password": False, "role": "admin"
          },
          {
            "id": "ADM-002", "username": "asesor.laura", "password": "Asesor1234*", "client_doc": "00000002",
            "client_name": "Laura Gómez (Asesor Comercial)", "email": "laura.gomez@autotrack.com", "vehicle_id": None,
            "must_change_password": False, "role": "staff_asesor"
          },
          {
            "id": "ADM-003", "username": "logistica.taller", "password": "Taller1234*", "client_doc": "00000003",
            "client_name": "Jefe de Alistamiento & Taller", "email": "taller@autotrack.com", "vehicle_id": None,
            "must_change_password": False, "role": "staff_logistica"
          },
          {
            "id": "ADM-004", "username": "tramites.runt", "password": "Tramites1234*", "client_doc": "00000004",
            "client_name": "Gestor de Trámites & Placas", "email": "tramites@autotrack.com", "vehicle_id": None,
            "must_change_password": False, "role": "staff_tramites"
          },
          {
            "id": "USR-1001", "username": "carlos.mendoza", "password": "Temp1234", "client_doc": "1098765432",
            "client_name": "Carlos Eduardo Mendoza", "email": "carlos.mendoza@email.com", "vehicle_id": "VEH-1001",
            "must_change_password": True, "role": "client"
          },
          {
            "id": "USR-1002", "username": "mf.rios", "password": "Clave2024", "client_doc": "52431980",
            "client_name": "María Fernanda Ríos", "email": "mf.rios@email.com", "vehicle_id": "VEH-1002",
            "must_change_password": False, "role": "client"
          }
        ]
        write_db({"vehicles": vehicles_seed, "users": users_seed})

    socketserver.TCPServer.allow_reuse_address = True
    print("====================================================")
    print("🚀 Servidor AutoTrack iniciado correctamente (Python)")
    print(f"📍 Puerto: {PORT}")
    print(f"🔑 Portal de Login Unificado: http://localhost:{PORT}/login.html")
    print("====================================================")

    try:
        with socketserver.TCPServer(("", PORT), AutoTrackHandler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        if getattr(e, 'errno', None) in (10048, 98) or '10048' in str(e):
            print(f"\n⚠️ El puerto {PORT} ya está en uso. Por favor cierra la terminal previa o espera unos segundos.")
        else:
            raise e
