# Clinora AI

Phase 1 initializes the approved project foundation only.

## Approved Baseline

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Backend: Spring Boot, Java 21, Maven
- Database: PostgreSQL, Spring Data JPA, Hibernate, Flyway
- Messaging: RabbitMQ with Spring AMQP and STOMP plugin
- Real time: Spring WebSocket with STOMP broker relay through RabbitMQ
- Cache/rate limits: Redis
- OCR: Python 3.12, FastAPI
- AI: Python 3.12, FastAPI, hosted Hugging Face inference placeholders

## Local Startup

1. Copy `.env.example` to `.env` and keep placeholder values for Phase 1.
2. Start infrastructure and services:

```powershell
docker compose up --build
```

3. Frontend:

```powershell
cd frontend
npm install
npm run dev
```

4. Backend:

```powershell
cd backend
mvn spring-boot:run
```

5. OCR service:

```powershell
cd ocr-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

6. AI service:

```powershell
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## Health Checks

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080/actuator/health`
- OCR: `http://localhost:8000/health`
- AI: `http://localhost:8001/health`
- RabbitMQ Management: `http://localhost:15672`

No domain modules, authentication flows, clinical schemas, OCR processing, AI inference, business WebSocket events, or production pages are implemented in Phase 1.
