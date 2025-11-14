# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of this project seriously. If you discover a security vulnerability, please follow these steps:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Do

1. **Email the maintainer** at security@example.com with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fixes (optional)

2. **Wait for acknowledgment** - We aim to respond within 48 hours

3. **Coordinate disclosure** - We will work with you to understand and address the issue

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Status Updates**: Regular updates on the progress
- **Resolution**: Depends on severity and complexity
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

### For Contributors

- Never commit sensitive data (API keys, passwords, tokens, OAuth credentials)
- Use environment variables for configuration (see `.env.example`)
- Follow secure coding practices
- Keep dependencies up to date
- Run security audits regularly:
  ```bash
  npm audit
  npm audit fix
  ```
- Use TypeScript strict mode for type safety
- Validate and sanitize all inputs

### For Users/Deployers

- Keep the application updated to the latest version
- Use strong, unique passwords for all accounts
- Protect your API keys and credentials
- Review environment variable configurations
- Use HTTPS in production (enforce TLS 1.2+)
- Enable appropriate authentication and authorization
- Implement rate limiting and DDoS protection
- Monitor logs for suspicious activity
- Regular security patches for OS and dependencies

## Known Security Considerations

### YouTube Data API v3

This project integrates with YouTube Data API v3:

**API Key Management:**
- Never share or commit API keys to version control
- Store in `.env` files (listed in `.gitignore`)
- Use separate keys for development and production
- Rotate keys periodically
- Restrict key usage by IP address when possible
- Monitor API quota usage

**OAuth 2.0 Implementation:**
- Client ID is configured in environment variables
- **CRITICAL**: Client secret must NEVER be exposed in frontend code
- Implement refresh token rotation
- Validate redirect URIs strictly
- Use state parameter to prevent CSRF attacks
- Store tokens securely in the backend
- Implement token expiration and refresh logic
- Clear tokens on logout

### MongoDB Security

This project uses MongoDB for data persistence:

**Connection Security:**
- Use MongoDB URI from environment variables (`.env`)
- Enable authentication with strong credentials
- Use separate DB users for different environments
- Implement connection pooling
- Use TLS/SSL for connections (mongodb+srv://)
- Enable IP whitelist/firewall rules

**Data Security:**
- Implement role-based access control (RBAC)
- Encrypt sensitive fields at rest
- Use indexes for performance and security
- Regular backups to secure locations
- Implement data retention policies
- Never store API keys or OAuth tokens in plaintext
- Use MongoDB encryption features where available

**Best Practices:**
- Avoid storing user credentials; use OAuth tokens instead
- Implement query validation to prevent injection attacks
- Use parameterized queries
- Monitor database access logs
- Implement audit trails for sensitive operations

### Frontend Security (React + TypeScript)

**TypeScript Safety:**
- Enforce strict mode: `"strict": true`
- Use proper typing for all props and state
- Avoid `any` type usage
- Validate external data at API boundaries

**XSS Prevention:**
- React escapes content by default
- Avoid using `dangerouslySetInnerHTML`
- Sanitize user input before rendering
- Use Content Security Policy headers

**Authentication:**
- Store OAuth tokens in secure, HTTP-only cookies (if possible)
- Implement proper session management
- Clear tokens on logout
- Prevent token storage in localStorage for sensitive data
- Validate tokens on the backend

**Data Privacy:**
- Don't expose sensitive data in URL parameters
- Use POST for sensitive operations
- Implement proper CORS headers
- Validate referrer headers

### Backend Security (Express.js)

**Request Handling:**
- Validate and sanitize all input
- Implement request size limits
- Use helmet.js for security headers
- Implement CORS with appropriate origin restrictions
- Rate limiting to prevent abuse

**Authentication & Authorization:**
- Implement JWT or session-based authentication
- Validate OAuth tokens on every request
- Use middleware for permission checks
- Implement role-based access control (RBAC)
- Protect API endpoints with authentication

**Database Security:**
- Use parameterized queries/ORM to prevent injection
- Validate input types and formats
- Implement query complexity limits
- Monitor slow queries
- Use database transactions for data consistency

**Error Handling:**
- Don't expose stack traces in production
- Log errors securely
- Use generic error messages to users
- Implement proper error monitoring

**HTTPS & TLS:**
- Enforce HTTPS in production
- Use secure cookies (httpOnly, secure, sameSite flags)
- Implement HSTS headers
- Keep TLS libraries updated

### Environment Variables

Critical security-sensitive variables:

**Frontend (.env files):**
```
VITE_API_BASE_URL=https://api.example.com
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

**Backend (.env files):**
```
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/db
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=secure_random_string
NODE_ENV=production
```

**Important:**
- Never commit `.env` files to git
- Use `.env.example` to document required variables
- Generate strong secrets for JWT_SECRET
- Rotate secrets regularly
- Use different secrets for each environment

### Dependency Security

- Run `npm audit` regularly
- Update dependencies promptly
- Review dependency changelogs before updating
- Use npm CI instead of npm install in CI/CD
- Implement automated dependency scanning (e.g., Snyk, GitHub Dependabot)
- Monitor security advisories

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Users will be notified through:

- GitHub Security Advisories
- Release notes with security badges
- Email notifications (for critical issues)
- Security patches with detailed CVE information

## Responsible Disclosure

We practice responsible disclosure:
- Vulnerabilities are fixed before public disclosure
- We provide credit to security researchers
- We coordinate with affected parties
- We release security advisories when appropriate
- We follow CVE process for severe vulnerabilities

## Contact

For security concerns, please contact:
- Email: security@example.com
- GitHub: @charg
- Do not use public issue tracker for security issues

For general questions, please use GitHub issues instead.

---

Thank you for helping keep this project secure!
