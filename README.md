![Node.js](https://img.shields.io/badge/Node.js-22-green)
![Express](https://img.shields.io/badge/Express.js-5-black)
![Redis](https://img.shields.io/badge/Redis-Cache-red)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![License](https://img.shields.io/badge/License-MIT-green)

# 🏥 Hospital Management System - Backend

A modern and scalable RESTful API for managing hospital operations.  
The system is designed for real-world hospital environments, providing secure authentication, doctor and department management, appointment scheduling, advertisements, image storage, and performance optimization using Redis Cache.

---

# 🚀 Features

- JWT Authentication & Authorization
- Role-Based Access Control (RBAC)
- Hospital Information Management
- Department Management
- Doctor Management
- Doctor Schedule Management
- Doctor & Department Relationship Management
- Advertisement Management
- Image Upload & Storage using Supabase Storage
- Redis Caching for High Performance
- Pagination
- Searching
- Filtering
- Image Processing
- Docker & Docker Compose Support
- Global Error Handling
- Request Validation (Zod)
- RESTful API Architecture

---

# 🛠 Tech Stack

- Node.js
- Express.js
- Supabase (Database & Storage)
- Redis
- Docker
- Docker Compose
- JWT Authentication
- Zod Validation
- Multer
- Sharp

---

# 📂 Project Structure

```
src/
│
├── config/
├── controllers/
├── middlewares/
├── routes/
├── services/
├── utils/
├── validations/
├── cache/
└── server.js
```

---

# ⚡ Performance

The project uses **Redis Cache** to reduce database load and improve API response time.

Cached Resources:

- Hospital Information
- Departments
- Doctors
- Doctor Schedules
- Doctor-Department Relations
- Advertisements

Cache is automatically invalidated after any update to ensure data consistency.

---

# 🔐 Authentication

Authentication is based on **JWT**.

Protected routes require a valid access token.

Role-based authorization is implemented for:

- Admin
- Receptionist
- Doctor (Future)
- Patient (Future)

---

# 📦 Installation

Clone the repository

```bash
git clone https://github.com/your-username/hospital-management-system-backend.git
```

Go to project directory

```bash
cd hospital-management-system-backend
```

Install dependencies

```bash
npm install
```

---

# ⚙ Environment Variables

Create a `.env` file and configure:

```env
PORT=
JWT_SECRET=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

REDIS_HOST=redis
REDIS_PORT=6379
```

---

# 🐳 Run with Docker

Build and start the project

```bash
docker compose up --build
```

Stop containers

```bash
docker compose down
```

---

# 💻 Run without Docker

```bash
npm install
npm run dev
```

---

# 📚 API Features

- Authentication
- Hospital
- Departments
- Doctors
- Doctor Schedules
- Doctor Departments
- Advertisements

All endpoints support proper HTTP status codes and structured JSON responses.

---

# 📈 Performance Optimization

The backend implements:

- Redis Cache
- Automatic Cache Invalidation
- Pagination
- Filtering
- Searching
- Optimized Image Processing

---

# 🔒 Security

- JWT Authentication
- Role-Based Authorization
- Input Validation
- Secure Image Upload
- Global Error Handling

---

# 📄 License

This project is developed for educational purposes and real-world deployment.

---

# 👨‍💻 Author

Developed by **Your Name**