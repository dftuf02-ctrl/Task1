# TaskFlow — Task Management Application

A production-ready full-stack Task Management application featuring an Express.js (MVC) REST API backend, a premium React.js frontend, and Supabase (PostgreSQL) as the database.

---

## 🏗️ Architecture: MVC

This project is built using a clean Model-View-Controller pattern:
- **Model** (`backend/src/models/task.model.js`): Manages data access to Supabase PostgreSQL database and validates payloads using Zod schemas.
- **Controller** (`backend/src/controllers/task.controller.js`): Handles request parsing, triggers validations, calls models, and formats responses.
- **View** (`frontend/src/`): React dashboard providing visual interfaces. Communicates with backend endpoints.

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

Create a `.env` file in the `backend/` directory:

```env
PORT=3001
NODE_ENV=development

# Supabase database config
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# CORS configuration
CORS_ORIGIN=http://localhost:5173

# Security rate limits
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Winston logs
LOG_LEVEL=info
```

---

## 🗄️ Database Setup (Supabase / PostgreSQL)

Run the SQL migration in `supabase/migrations/001_create_tasks.sql` inside your Supabase SQL Editor:

```sql
-- Create task status enum
CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- Create tasks table
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  status      task_status NOT NULL DEFAULT 'PENDING',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize queries with indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Automated trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

To populate your database with dummy data, execute the contents of `supabase/seed.sql`.

---

## 🚀 Running the Project

### Method 1: Docker Compose (Recommended)

1. Ensure Docker Desktop is installed and running.
2. In the root directory, create a `.env` file (or expose them as environment variables) containing:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Run the following command to spin up the entire application stack:
   ```bash
   docker-compose up --build
   ```
4. Access the applications:
   - **Frontend Dashboard**: [http://localhost](http://localhost)
   - **Backend API**: [http://localhost:3001](http://localhost:3001)

#### Useful Docker Commands:
- **Stop containers**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **Inspect health status**: `docker-compose ps`

---

### Method 2: Manual Local Development

#### 1. Start the Backend:
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:3001`.

#### 2. Start the Frontend:
```bash
cd frontend
npm install
npm run dev
```
The React development server will run on `http://localhost:5173`.

---

## 🧪 Running Tests

A comprehensive test suite using Jest and Supertest validates the API endpoints, controller responses, error handling, request parameter formatting, and input validations.

```bash
cd backend

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration/E2E tests only
npm run test:e2e
```

---

## 📡 API Reference

### Response Formats

#### Success Example:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Build production API",
    "status": "PENDING"
  }
}
```

#### Error Example:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

---

### Endpoints & CURL Examples

#### 1. Health Status
`GET /health`
```bash
curl -i http://localhost:3001/health
```

#### 2. Get All Tasks
`GET /api/v1/tasks`
```bash
curl -i http://localhost:3001/api/v1/tasks
```

#### 3. Create Task
`POST /api/v1/tasks`
```bash
curl -i -X POST http://localhost:3001/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement Docker Containerization", "description": "Configure multi-stage Dockerfiles and compose configuration", "status": "IN_PROGRESS"}'
```

#### 4. Get Task By ID
`GET /api/v1/tasks/{id}`
```bash
curl -i http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000
```

#### 5. Update Task
`PUT /api/v1/tasks/{id}`
```bash
curl -i -X PUT http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}'
```

#### 6. Delete Task
`DELETE /api/v1/tasks/{id}`
```bash
curl -i -X DELETE http://localhost:3001/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000
```
