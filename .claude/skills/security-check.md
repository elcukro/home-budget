# Security Check Skill

Act as a red-team penetration tester and thoroughly investigate the current feature or recent changes for security vulnerabilities.

## Analysis Scope

1. **Authentication & Authorization**
   - Missing or weak authentication checks
   - Broken access control (IDOR, privilege escalation)
   - Session management issues
   - JWT/token vulnerabilities

2. **Input Validation**
   - SQL injection
   - XSS (Cross-Site Scripting)
   - Command injection
   - Path traversal
   - SSRF (Server-Side Request Forgery)

3. **Data Exposure**
   - Sensitive data in logs
   - Credentials in code/config
   - PII leakage in API responses
   - Excessive data exposure

4. **API Security**
   - Missing rate limiting
   - Mass assignment vulnerabilities
   - Broken function-level authorization
   - Insecure direct object references

5. **Frontend Security**
   - Client-side validation only (no server validation)
   - Sensitive data in localStorage/sessionStorage
   - CORS misconfigurations
   - Clickjacking vulnerabilities

6. **Dependencies**
   - Known vulnerable packages
   - Outdated dependencies with CVEs

## Output Format

For each finding, provide:
- **Severity**: Critical / High / Medium / Low
- **Location**: File path and line number
- **Issue**: Clear description of the vulnerability
- **Attack Scenario**: How it could be exploited
- **Fix**: Specific remediation steps with code examples

Focus on actionable findings with real security impact. Prioritize by severity.
