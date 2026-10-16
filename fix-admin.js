// fix-admin.js
// Run with: node fix-admin.js
// Converts admin client fetch paths to the consolidated /api/admin?action=... form.
// ESM-compatible for repositories with "type":"module" in package.json

import fs from 'fs';

const FILE = 'js/admin/main.js';

const replacements = [
  // Most-specific first
  { find: /\/admin\/auth\?action=session/g,        replace: '/api/admin?action=session' },
  { find: /\/admin\/auth\?action=logout/g,         replace: '/api/admin?action=logout' },
  { find: /\/admin\/auth(?=[`'"\s]|$)/g,           replace: '/api/admin?action=auth' },
  // Replace template-literal style /admin/users/${id} -> /api/admin?action=users-single&id=${id}
  { find: /\/admin\/users\/\$\{([^}]+)\}/g,     replaceFn: (m, p1) => '/api/admin?action=users-single&id=${' + p1 + '}' },
  { find: /\/admin\/users\?q=/g,                   replace: '/api/admin?action=users-list&q=' },
  { find: /\/admin\/users\?limit=/g,               replace: '/api/admin?action=users-list&limit=' },
  { find: /\/admin\/users(?=[`'"\s?]|$)/g,         replace: '/api/admin?action=users-list' },
  { find: /\/admin\/payments\/\$\{([^}]+)\}/g,   replaceFn: (m, p1) => '/api/admin?action=payments-single&id=${' + p1 + '}' },
  { find: /\/admin\/payments\?status=/g,           replace: '/api/admin?action=payments-list&status=' },
  { find: /\/admin\/payments(?=[`'"\s?]|$)/g,      replace: '/api/admin?action=payments-list' },
  { find: /\/admin\/stats/g,                       replace: '/api/admin?action=stats' },
  { find: /\/admin\/ban/g,                         replace: '/api/admin?action=ban' },
  { find: /\/admin\/reset-all/g,                   replace: '/api/admin?action=reset-all' },
  { find: /\/admin\/reset(?=[`'"\s?]|$)/g,         replace: '/api/admin?action=reset' },
  { find: /\/admin\/receipt\?paymentId=/g,         replace: '/api/admin?action=receipt&paymentId=' },
  { find: /\/admin\/send-email/g,                  replace: '/api/admin?action=send-email' },
  { find: /\/admin\/broadcast/g,                   replace: '/api/admin?action=broadcast' },
  { find: /\/admin\/badges/g,                      replace: '/api/admin?action=badges' },
  { find: /\/admin\/statistics/g,                  replace: '/api/admin?action=statistics' },
];

if (!fs.existsSync(FILE)) {
  console.error(`❌ File not found: ${FILE}`);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf8');
const original = content;

for (const r of replacements) {
  if (r.replaceFn) {
    content = content.replace(r.find, function() {
      return r.replaceFn.apply(null, arguments);
    });
  } else {
    content = content.replace(r.find, r.replace);
  }
}

if (content === original) {
  console.log(`⚠️  No changes made to ${FILE}.`);
  console.log('The file may already be updated, or the paths differ from what I expect.');
  console.log('\nSearch the file for "admin/auth" or "admin/users" manually to see the current format.');
} else {
  fs.writeFileSync(FILE, content);
  console.log(`✅ Updated ${FILE}`);
  console.log('\nChanged lines (before → after):');
  const before = original.split('\n');
  const after = content.split('\n');
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) {
      console.log(`  Line ${i + 1}:`);
      console.log(`    OLD: ${before[i].trim()}`);
      console.log(`    NEW: ${after[i].trim()}`);
    }
  }
}
