-- AutoTrack PostgreSQL DDL Schema for Supabase / Neon / Vercel Postgres

CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(50) PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    vin VARCHAR(50) UNIQUE NOT NULL,
    client_doc VARCHAR(50) NOT NULL,
    client_name VARCHAR(150) NOT NULL,
    client_phone VARCHAR(50),
    client_email VARCHAR(150),
    vehicle_type VARCHAR(50) DEFAULT 'Automóvil',
    brand_model VARCHAR(150) NOT NULL,
    color VARCHAR(50) DEFAULT 'Blanco',
    dealership_branch VARCHAR(150) DEFAULT 'Almotores - Sede Principal',
    advisor_name VARCHAR(150) DEFAULT 'Laura Gómez',
    advisor_phone VARCHAR(50) DEFAULT '+57 300 123 4567',
    current_stage_index INT DEFAULT 1,
    current_stage_name VARCHAR(100) DEFAULT 'Vehículo en Proceso de Asignación',
    estimated_delivery_days INT DEFAULT 14,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estimated_delivery_date DATE,
    checklist JSONB DEFAULT '[]'::jsonb,
    status_history JSONB DEFAULT '[]'::jsonb,
    satisfaction_rating INT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    client_doc VARCHAR(50) NOT NULL,
    client_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    vehicle_id VARCHAR(50) REFERENCES vehicles(id) ON DELETE SET NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices para optimización de búsqueda
CREATE INDEX IF NOT EXISTS idx_vehicles_client_doc ON vehicles(client_doc);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_vehicles_order_code ON vehicles(order_code);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Datos Iniciales Pre-sembrados (Seed)
INSERT INTO vehicles (id, order_code, vin, client_doc, client_name, client_phone, client_email, vehicle_type, brand_model, color, current_stage_index, current_stage_name, estimated_delivery_days, estimated_delivery_date)
VALUES 
('VEH-1001', 'PED-2024-8891', '9BWCA111000123456', '1098765432', 'Carlos Eduardo Mendoza', '+57 315 890 1234', 'carlos.mendoza@email.com', 'Automóvil', 'Mazda CX-30 Grand Touring 2024', 'Rojo Cristal Metalizado', 4, 'En Alistamiento', 14, CURRENT_DATE + INTERVAL '6 days'),
('VEH-1002', 'PED-2024-9042', '93YMT07X998877665', '52431980', 'María Fernanda Ríos', '+57 320 456 7890', 'mf.rios@email.com', 'Motocicleta', 'Yamaha MT-07 ABS 2024', 'Cyan Storm', 6, 'Listo para Entrega', 6, CURRENT_DATE + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, username, password, client_doc, client_name, email, vehicle_id, must_change_password, role)
VALUES
('ADM-001', 'admin', 'Admin1234*', '00000001', 'Administrador General', 'admin@autotrack.com', NULL, FALSE, 'admin'),
('ADM-002', 'asesor.laura', 'Asesor1234*', '00000002', 'Laura Gómez (Asesor Comercial)', 'laura.gomez@autotrack.com', NULL, FALSE, 'staff_asesor'),
('ADM-003', 'logistica.taller', 'Taller1234*', '00000003', 'Jefe de Alistamiento & Taller', 'taller@autotrack.com', NULL, FALSE, 'staff_logistica'),
('ADM-004', 'tramites.runt', 'Tramites1234*', '00000004', 'Gestor de Trámites & Placas', 'tramites@autotrack.com', NULL, FALSE, 'staff_tramites'),
('USR-1001', 'carlos.mendoza', 'Temp1234', '1098765432', 'Carlos Eduardo Mendoza', 'carlos.mendoza@email.com', 'VEH-1001', TRUE, 'client'),
('USR-1002', 'mf.rios', 'Clave2024', '52431980', 'María Fernanda Ríos', 'mf.rios@email.com', 'VEH-1002', FALSE, 'client')
ON CONFLICT (id) DO NOTHING;
