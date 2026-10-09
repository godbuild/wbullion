// fix-admin.js
// Run with: node fix-admin.js
// Fixes the admin panel's fetch calls to match the consolidated API.

const fs = require('fs');

const FILE = 'js/admin/main.js';

const replacements = [
  // Most-specific first
  { find: /\/admin\/auth\?action=session/g,        replace: '/admin?action=session' },
  { find: /\/admin\/auth\?action=logout/g,         replace: '/admin?action=logout' },
  { find: /\/admin\/auth(?=[`'"\s]|$)/g,           replace: '/admin?action=auth' },
  { find: /\/admin\/users\/\$\{([^}]+)\}/g,        replace: '/admin?action=users-single&id=$${$1}' },
  { find: /\/admin\/users\?q=/g,                   replace: '/admin?action=users-list&q=' },
  { find: /\/admin\/users\?limit=/g,               replace: '/admin?action=users-list&limit=' },
  { find: /\/admin\/users(?=[`'"\s?]|$)/g,         replace: '/admin?action=users-list' },
  { find: /\/admin\/payments\/\$\{([^}]+)\}/g,     replace: '/admin?action=payments-single&id=$${$1}' },
  { find: /\/admin\/payments\?status=/g,           replace: '/admin?action=payments-list&status=' },
  { find: /\/admin\/payments(?=[`'"\s?]|$)/g,      replace: '/admin?action=payments-list' },
  { find: /\/admin\/stats/g,                       replace: '/admin?action=stats' },
  { find: /\/admin\/ban/g,                         replace: '/admin?action=ban' },
  { find: /\/admin\/reset-all/g,                   replace: '/admin?action=reset-all' },
  { find: /\/admin\/reset(?=[`'"\s?]|$)/g,         replace: '/admin?action=reset' },
  { find: /\/admin\/receipt\?paymentId=/g,         replace: '/admin?action=receipt&paymentId=' },
  { find: /\/admin\/send-email/g,                  replace: '/admin?action=send-email' },
  { find: /\/admin\/broadcast/g,                   replace: '/admin?action=broadcast' },
  { find: /\/admin\/badges/g,                      replace: '/admin?action=badges' },
  { find: /\/admin\/statistics/g,                  replace: '/admin?action=statistics' },
];

if (!fs.existsSync(FILE)) {
  console.error(`❌ File not found: ${FILE}`);
  process.exit(1);
}

let content = fs.readFileSync(FILE, 'utf8');
const original = content;

for (const r of replacements) {
  content = content.replace(r.find, r.replace);
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
