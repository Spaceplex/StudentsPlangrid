-- New buildings
CREATE TABLE buildings (
  id SERIAL PRIMARY KEY,
  name VARCHARS(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- New floor for buildings
CREATE TABLE building_floor (
  id SERIAL PRIMARY KEY, 
  building_id INT REFERENCES buildings(id) ON DELETE CASCADE,
  floor_name VARCHARS(255) NOT NULL,
  pdf_file_path VARCHARS(512) NOT NULL,
  width_px INT NOT NULL,
  height_px INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  floor_id INT REFERENCES building_floor(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  x_coord DOUBLE PRECISION NOT NULL,
  y_coord DOUBLE PRECISION NOT NULL,
  pin_color VARCHAR(20) DEFAULT 'FF0000' -- red
  status VARCHAR(50) DEFAULT 'Open'
  assigned_to_user_id INT,
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

CREATE TABLE task_media (
  id SERIAL PRIMARY KEY,
  task_id INT REFERENCES tasks(id) ON DELETE CASCADE,
  file_path VARCHAR(512) NOT NULL,
  media_type VARCHAR(50) CHECK (media_type IN ('image', 'video')),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
