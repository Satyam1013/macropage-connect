# Macropage Connect — Auth Service

NestJS backend for WhatsApp / Meta API integration platform.

## Quick Start

```bash
cp .env.example .env   # values bharo
npm run start:dev      # http://localhost:3000/api/v1
```

## API Endpoints  (Base: /api/v1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/signup | ❌ | New user register |
| POST | /auth/login | ❌ | Email + password login |
| POST | /auth/oauth | ❌ | Google / social login |
| POST | /auth/refresh | 🔒 JWT | Access token refresh |
| GET | /auth/me | 🔒 JWT | Current user profile |

## Project Structure

```
src/
├── auth/
│   ├── dto/              # Login, Signup, OAuth DTOs
│   ├── guards/           # JwtAuthGuard
│   ├── strategies/       # JwtStrategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── users/
│   ├── users.service.ts  # ⚠️ In-memory — replace with DB
│   └── users.module.ts
├── common/filters/       # Global HttpExceptionFilter
├── app.module.ts
└── main.ts
```

## Production Todo
- [ ] TypeORM/Prisma DB integration (UsersService)
- [ ] Google OAuth token verify (google-auth-library)
- [ ] Email verification flow
- [ ] Rate limiting (@nestjs/throttler)
- [ ] Refresh token rotation & revocation
- [ ] WhatsApp/Meta API module
