#!/bin/bash

echo "=== SECURITY ANALYSIS ==="
echo ""
echo "1. Hardcoded Secrets Check"
grep -r "password\|secret\|api.?key\|token" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "process.env" | grep -v ".test" | grep -v "mock" || echo "✓ No hardcoded secrets found"

echo ""
echo "2. Command Injection Risks"
grep -r "execSync\|exec\|spawn" . --include="*.js" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" | head -20

echo ""
echo "3. SQL/Database Query Safety"
grep -r "\.from\|\.rpc\|\.insert\|\.update\|\.delete" src/lib/actions --include="*.ts" | grep -E "(concat|interpolate|\$\{.*\}.*from)" | head -10 || echo "✓ Using parameterized queries"

echo ""
echo "4. Environment Variable Exposure"
grep -r "process.env\." src/ --include="*.ts" --include="*.tsx" | grep -v "NEXT_PUBLIC" | head -20

echo ""
echo "5. Input Validation & XSS"
grep -r "innerHTML\|dangerouslySetInnerHTML\|eval\|Function(" src/ --include="*.ts" --include="*.tsx" | head -10 || echo "✓ No dangerous HTML/eval patterns"

echo ""
echo "6. Authentication/Authorization Issues"
grep -r "role\|permission\|access" src/lib/actions/__tests__ --include="*.test.ts" | head -10

echo ""
echo "7. File Permissions in github-safe.js"
cat .claude/helpers/github-safe.js | grep -A 5 "execSync\|command"

