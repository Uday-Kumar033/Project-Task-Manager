# Tasks. — Task Management Web Application

A full-stack task manager: React (Vite + Tailwind CSS) on the frontend,
FastAPI on the backend, MySQL for storage, and JWT for authentication.

## Features

- Email/password sign up and sign in, with passwords hashed (bcrypt) and
  sessions handled via JWT bearer tokens.
- Create, read, update, and delete tasks — each task has a title,
  optional notes, priority, status, and due date.
- Dashboard views for **Today**, **Upcoming**, **All tasks**, and
  **Completed**, plus an aggregate stats query.
- Responsive, distinct UI styled like a paper planner (ruled-paper task
  list, serif wordmark) rather than a generic dashboard template.

## Tech stack

| Layer    | Tech                                                   |
|----------|---------------------------------------------------------|
| Frontend | React 18, Vite, React Router, Tailwind CSS, Axios       |
| Backend  | Python, FastAPI, SQLAlchemy, python-jose (JWT), passlib |
| Database | MySQL                                                   |

## Project structure

```
task-manager/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, router mounting
│   │   ├── database.py      # SQLAlchemy engine/session
│   │   ├── models.py        # User, Task ORM models
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── auth.py          # Password hashing + JWT helpers
│   │   └── routers/
│   │       ├── auth.py      # /auth/register, /auth/login, /auth/me
│   │       └── tasks.py     # /tasks CRUD + /tasks/stats
│   ├── database.sql         # Optional manual schema (tables/indexes)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js         # Axios instance + JWT interceptor
    │   ├── context/AuthContext.jsx
    │   ├── components/           # Sidebar, TaskRow, TaskFormModal, ProtectedRoute
    │   └── pages/                # LoginPage, RegisterPage, DashboardPage
    ├── tailwind.config.js
    ├── package.json
    └── .env.example
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **MySQL** 8+ (running locally or accessible remotely)

## 1. Set up the database

Create the database. You can let the backend create the tables
automatically on first run (recommended), or run the SQL file yourself:

```bash
mysql -u root -p -e "CREATE DATABASE task_manager CHARACTER SET utf8mb4;"
# Optional — creates tables/indexes by hand instead of via the app:
mysql -u root -p task_manager < backend/database.sql
```

## 2. Run the backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and set DB_USER, DB_PASSWORD, DB_NAME, SECRET_KEY, etc.

uvicorn app.main:app --reload --port 8000
```

The API now runs at `http://localhost:8000`. Interactive docs (Swagger
UI) are available at `http://localhost:8000/docs`. On startup, the app
calls `Base.metadata.create_all`, which creates the `users` and `tasks`
tables if they don't already exist.

## 3. Run the frontend (React)

In a second terminal:

```bash
cd frontend
npm install

cp .env.example .env
# VITE_API_URL should point at your backend, e.g. http://localhost:8000

npm run dev
```

Open `http://localhost:5173` in your browser. Create an account, sign
in, and start adding tasks.

## Building for production

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
npm run preview    # serve the production build locally to test it
```

Serve the contents of `frontend/dist` with any static host (Nginx,
Vercel, Netlify, etc.), and run the backend behind a process manager
such as `gunicorn`/`uvicorn` with a reverse proxy in front of it. Update
`FRONTEND_ORIGIN` in the backend `.env` and `VITE_API_URL` in the
frontend `.env` to match your deployed URLs.

## API overview

| Method | Endpoint            | Description                          | Auth required |
|--------|---------------------|---------------------------------------|:--------------:|
| POST   | `/auth/register`    | Create an account, returns a JWT      | No             |
| POST   | `/auth/login`       | Log in, returns a JWT                 | No             |
| GET    | `/auth/me`          | Get the current user's profile        | Yes            |
| GET    | `/tasks`            | List the current user's tasks         | Yes            |
| GET    | `/tasks/stats`      | Aggregate counts (total/pending/etc.) | Yes            |
| POST   | `/tasks`            | Create a task                         | Yes            |
| GET    | `/tasks/{id}`       | Get a single task                     | Yes            |
| PUT    | `/tasks/{id}`       | Update a task                         | Yes            |
| DELETE | `/tasks/{id}`       | Delete a task                         | Yes            |

Authenticated requests need an `Authorization: Bearer <token>` header;
the frontend attaches this automatically once you're signed in.

## Notes

- Passwords are hashed with bcrypt before storage — plaintext passwords
  are never saved.
- `tasks.user_id` has a foreign key to `users.id` with `ON DELETE
  CASCADE`, so deleting a user cleans up their tasks.
- Indexes on `user_id`, `status`, and `due_date` keep the dashboard's
  filtered queries fast as the table grows.

## Docker deployment

See [`DOCKER_DEPLOYMENT.md`](DOCKER_DEPLOYMENT.md) for a Docker Compose deployment of the frontend, backend, and MySQL on EC2. It uses Python 3.12 in the backend image and does not require a host Python virtual environment.
