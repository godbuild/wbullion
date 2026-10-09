// update-api-calls.js
// Run with: node update-api-calls.js
// Safely updates all frontend fetch() calls to the consolidated API format.

const fs = require('fs');
const path = require('path');

const replacements = [
  // =========================================================================
  // ADMIN — uses /admin/... pattern so it matches BOTH /api/admin/X and ${API}/admin/X
  // Order: most-specific FIRST
  // =========================================================================
  { find: /\/admin\/users\/\$\{([^}]+)\}/g,      replace: '/admin?action=users-single&id=$${$1}' },
  { find: /\/admin\/payments\/\$\{([^}]+)\}/g,   replace: '/admin?action=payments-single&id=$${$1}' },
  { find: /\/admin\/auth\?action=session/g,      replace: '/admin?action=session' },
  { find: /\/admin\/auth\?action=logout/g,       replace: '/admin?action=logout' },
  { find: /\/admin\/auth(?=[`'"\s]|$)/g,         replace: '/admin?action=auth' },
  { find: /\/admin\/reset-all/g,                 replace: '/admin?action=reset-all' },
  { find: /\/admin\/reset(?=[`'"\s]|$)/g,        replace: '/admin?action=reset' },
  { find: /\/admin\/users\?limit=/g,             replace: '/admin?action=users-list&limit=' },
  { find: /\/admin\/users\?q=/g,                 replace: '/admin?action=users-list&q=' },
  { find: /\/admin\/users(?=[`'"\s]|$)/g,        replace: '/admin?action=users-list' },
  { find: /\/admin\/payments\?status=/g,         replace: '/admin?action=payments-list&status=' },
  { find: /\/admin\/payments(?=[`'"\s]|$)/g,     replace: '/admin?action=payments-list' },
  { find: /\/admin\/stats/g,                     replace: '/admin?action=stats' },
  { find: /\/admin\/ban/g,                       replace: '/admin?action=ban' },
  { find: /\/admin\/receipt\?paymentId=/g,       replace: '/admin?action=receipt&paymentId=' },
  { find: /\/admin\/send-email/g,                replace: '/admin?action=send-email' },
  { find: /\/admin\/broadcast/g,                 replace: '/admin?action=broadcast' },
  { find: /\/admin\/badges/g,                    replace: '/admin?action=badges' },
  { find: /\/admin\/statistics/g,                replace: '/admin?action=statistics' },

  // =========================================================================
  // REELS — template literals FIRST
  // =========================================================================
  { find: /\/api\/reels\/\$\{([^}]+)\}\/like/g,        replace: '/api/reels?action=like&id=$${$1}' },
  { find: /\/api\/reels\/\$\{([^}]+)\}\/view/g,        replace: '/api/reels?action=view&id=$${$1}' },
  { find: /\/api\/reels\/\$\{([^}]+)\}\?deviceId=/g,   replace: '/api/reels?action=single&id=$${$1}&deviceId=' },
  { find: /\/api\/reels\/\$\{([^}]+)\}(?=[`'"\s]|$)/g, replace: '/api/reels?action=single&id=$${$1}' },
  { find: /\/api\/reels\/sign-upload/g,                replace: '/api/reels?action=sign-upload' },
  { find: /\/api\/reels\/create/g,                     replace: '/api/reels?action=create' },
  { find: /\/api\/reels\/list\?deviceId=/g,            replace: '/api/reels?action=list&deviceId=' },

  // =========================================================================
  // USERS
  // =========================================================================
  { find: /\/api\/users\/me\?deviceId=/g,                 replace: '/api/users?action=me&deviceId=' },
  { find: /\/api\/users\/logout/g,                        replace: '/api/users?action=logout' },
  { find: /\/api\/users\/check-username\?username=/g,     replace: '/api/users?action=check-username&username=' },
  { find: /\/api\/users\/check-email\?email=/g,           replace: '/api/users?action=check-email&email=' },
  { find: /\/api\/users\/profile\?deviceId=/g,            replace: '/api/users?action=profile&deviceId=' },
  { find: /\/api\/users\/follow-info\?deviceId=/g,        replace: '/api/users?action=follow-info&deviceId=' },
  { find: /\/api\/users\/follow(?![-\w])/g,               replace: '/api/users?action=follow' },
  { find: /\/api\/users\/update-me/g,                     replace: '/api/users?action=update-me' },
  { find: /\/api\/users\/change-password/g,               replace: '/api/users?action=change-password' },
  { find: /\/api\/users\/track-view/g,                    replace: '/api/users?action=track-view' },
  { find: /\/api\/users\/transactions\?deviceId=/g,       replace: '/api/users?action=transactions&deviceId=' },
  { find: /\/api\/users\/visibility/g,                    replace: '/api/users?action=visibility' },
  { find: /\/api\/users\/delete\?deviceId=/g,             replace: '/api/users?action=delete&deviceId=' },
  { find: /\/api\/users\/hoep/g,                          replace: '/api/users?action=hoep' },
  { find: /\/api\/users\/er\?deviceId=/g,                 replace: '/api/users?action=er&deviceId=' },
  { find: /\/api\/users\/referral-info\?deviceId=/g,      replace: '/api/users?action=referral-info&deviceId=' },

  // =========================================================================
  // AUTH
  // =========================================================================
  { find: /\/api\/auth\/device-login/g, replace: '/api/auth?action=device-login' },
  { find: /\/api\/auth\/register/g,     replace: '/api/auth?action=register' },
  { find: /\/api\/auth\/login/g,        replace: '/api/auth?action=login' },

  // =========================================================================
  // BONUS
  // =========================================================================
  { find: /\/api\/bonus\/daily\?deviceId=/g,    replace: '/api/bonus?action=daily&deviceId=' },
  { find: /\/api\/bonus\/telegram\?deviceId=/g, replace: '/api/bonus?action=telegram&deviceId=' },
  { find: /\/api\/bonus\/streak\?deviceId=/g,   replace: '/api/bonus?action=streak&deviceId=' },
  { find: /\/api\/bonus\/claim-day/g,           replace: '/api/bonus?action=claim-day' },

  // =========================================================================
  // NOTIFICATIONS / BADGES
  // =========================================================================
  { find: /\/api\/notifications\/list\?deviceId=/g, replace: '/api/notifications?action=list&deviceId=' },
  { find: /\/api\/notifications\/read/g,            replace: '/api/notifications?action=read' },
  { find: /\/api\/badges\/list\?deviceId=/g,        replace: '/api/notifications?action=badges-list&deviceId=' },
  { find: /\/api\/badges\/claim/g,                  replace: '/api/notifications?action=badges-claim' },

  // =========================================================================
  // SPTF
  // =========================================================================
  { find: /\/api\/sptf\/list\?deviceId=/g, replace: '/api/users?action=sptf&deviceId=' },

  // =========================================================================
  // TASKS
  // =========================================================================
  { find: /\/api\/tasks\/list\?deviceId=/g, replace: '/api/tasks?action=list&deviceId=' },
  { find: /\/api\/tasks\/create/g,          replace: '/api/tasks?action=create' },
  { find: /\/api\/tasks\/complete/g,        replace: '/api/tasks?action=complete' },

  // =========================================================================
  // PAYMENTS
  // =========================================================================
  { find: /\/api\/payments\/submit/g,     replace: '/api/payments?action=submit' },
  { find: /\/api\/payments\/withdrawal/g, replace: '/api/payments?action=withdrawal' },

  // =========================================================================
  // GAMES
  // =========================================================================
  { find: /\/api\/games\/football-config\?deviceId=/g, replace: '/api/games?action=football-config&deviceId=' },
  { find: /\/api\/games\/football-shot/g,              replace: '/api/games?action=football-shot' },
  { find: /\/api\/games\/balance-op/g,                 replace: '/api/games?action=balance-op' },
  { find: /\/api\/games\/leveller-cashout/g,           replace: '/api/games?action=leveller-cashout' },
  { find: /\/api\/games\/bet-ttt/g,                    replace: '/api/games?action=bet-ttt' },
  { find: /\/api\/games\/odds/g,                       replace: '/api/games?action=odds' },
  { find: /\/api\/games\/log/g,                        replace: '/api/games?action=log' },
  { find: /\/api\/games\/objective/g,                  replace: '/api/bonus?action=objective' },
];

function walk(dir) {
  let updated = 0;
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      updated += walk(fullPath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      for (const r of replacements) {
        content = content.replace(r.find, r.replace);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('  ✓', fullPath);
        updated++;
      }
    }
  }
  return updated;
}

console.log('\n🔄 Updating API calls in ./js ...\n');
const total = walk('./js');
console.log(`\n✅ Done. ${total} file(s) updated.\n`);
console.log('Next: git add . && git commit -m "Update API calls" && git push\n');
