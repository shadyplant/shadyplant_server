# Authentication and Authorization

## Implemented Flow

### 1. Register

`POST /api/v1/auth/register`

Accepted payload aliases:

- `fullName` or `name`
- `phoneNumber` or `phone`
- `email`
- `password`

Behavior:

1. Validate input
2. Hash password with bcrypt
3. Create an unverified local user in PostgreSQL
4. Generate a 6-digit OTP
5. Store OTP in Redis with expiry and attempt tracking
6. Return a verification message

Development builds also return `devOtp` for local testing.

### 2. Verify Signup OTP

`POST /api/v1/auth/register/verify-otp`

Accepted identifier aliases:

- `emailOrPhone`
- `email_or_phone`
- `identifier`
- `email`
- `phoneNumber`
- `phone`

Payload:

```json
{
  "email_or_phone": "user@example.com",
  "otp": "123456"
}
```

Behavior:

1. Resolve the user by email or phone
2. Read OTP from Redis
3. Check expiry and max attempts
4. Mark the PostgreSQL user as verified
5. Delete the OTP record

### 3. Login

`POST /api/v1/auth/login`

Login accepts either email or phone number plus password.
Unverified local accounts are blocked until OTP verification completes.

Successful login returns:

- access token in the response body
- refresh token in an HTTP-only cookie

### 4. Google Login

`POST /api/v1/auth/google`

Behavior:

1. Verify the Firebase ID token
2. Require the token to come from the Firebase Google provider
3. Reject account collisions where the Google UID and email point to different users
4. Upsert or safely link the user in PostgreSQL
5. Issue access and refresh tokens

Accepted payload aliases:

- `idToken`
- `id_token`
- `credential`

### 5. Refresh Session

`POST /api/v1/auth/refresh`

Behavior:

1. Read refresh token from cookie
2. Validate JWT
3. Validate server-side session in PostgreSQL
4. Rotate session and refresh token
5. Return a new access token

### 6. Logout

`POST /api/v1/auth/logout`

Behavior:

1. Revoke the active PostgreSQL session
2. Clear the refresh-token cookie

### 7. Forgot Password

`POST /api/v1/auth/forgot-password/request`

Accepts email or phone using the same identifier aliases as OTP verification.
The reset OTP is stored in Redis.

### 8. Verify Reset OTP

`POST /api/v1/auth/forgot-password/verify-otp`

Checks the OTP before reset submission.

### 9. Reset Password

`POST /api/v1/auth/forgot-password/reset`

Behavior:

1. Validate OTP from Redis
2. Hash the new password
3. Update the password hash in PostgreSQL
4. Delete the OTP record
5. Revoke all PostgreSQL sessions for that user

## Token Strategy

- Access token TTL: controlled by `ACCESS_TOKEN_TTL`
- Refresh token TTL: controlled by `REFRESH_TOKEN_TTL`
- Refresh tokens are rotated and matched against a stored SHA-256 token hash

## Security Notes

- Passwords are never stored in plain text.
- OTP records expire automatically in Redis.
- OTP attempts are limited by `OTP_MAX_ATTEMPTS`.
- Protected routes use bearer-token middleware.
- Password reset invalidates all active sessions.
- Google sign-in only accepts Firebase-issued tokens whose sign-in provider is `google.com`.
- Existing Google links are not silently overwritten when the token email and stored Google UID disagree.
