This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentication (Web + React Native)

Protected routes require bearer token authentication for both web and mobile clients.

- Login route is public: `POST /api/organization/login`.
- All protected routes require:

```http
Authorization: Bearer <accessToken>
```

### Login API

`POST /api/organization/login`

Response includes:

- `message`
- `accessToken`

### Web + Mobile flow

1. Call login API with email/password.
2. Read `accessToken` from response JSON.
3. Store it securely:
	- Web: storage strategy as per your app policy.
	- Mobile: Keychain/Keystore.
4. Send it in all protected API calls:

```http
Authorization: Bearer <accessToken>
```

### User Login API (Mobile)

For teachers and parents logging in via the mobile app, use a separate endpoint that checks the `users` collection.

`POST /api/user/login`

- Accepts both `teacher` and `parent` role accounts.
- The returned `accessToken` works with all protected routes — the token is scoped to the user's organization.

Request body:

```json
{
  "email": "teacher@example.com",
  "password": "password123"
}
```

Response includes:

- `message`
- `accessToken`
- `user` — `{ uid, name, email, role, organizationId }`

### cURL examples

Organization login:

```bash
curl -X POST http://localhost:3000/api/organization/login \
	-H "Content-Type: application/json" \
	-d '{"email":"org@mail.com","password":"password123"}'
```

Teacher / parent login (mobile):

```bash
curl -X POST http://localhost:3000/api/user/login \
	-H "Content-Type: application/json" \
	-d '{"email":"teacher@example.com","password":"password123"}'
```

Fetch students by class (Bearer token):

```bash
curl -G "http://localhost:3000/api/organization/students/by-class" \
	-H "Authorization: Bearer YOUR_TOKEN" \
	--data-urlencode "className=5" \
	--data-urlencode "section=A" \
	--data-urlencode "academicYear=2025-2026"
```

Web cookie-based request example:

```bash
curl -X POST http://localhost:3000/api/organization/login \
	-H "Content-Type: application/json" \
	-d '{"email":"org@mail.com","password":"password123"}'

curl "http://localhost:3000/api/organization/profile" \
	-H "Authorization: Bearer YOUR_TOKEN"
```
