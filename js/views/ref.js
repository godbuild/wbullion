import { navigate } from '../router.js';
import { getCurrentUser } from '../auth.js';

export function handleReferral(code) {
  const user = getCurrentUser();

  // If the user is already logged in on this device, still send to signup.
  // Referrals only apply to new accounts.
  if (user) {
    // Just go to signup fresh — new account creation is allowed
    navigate(`/signup?ref=${encodeURIComponent(code.toUpperCase())}`, { replace: true });
    return;
  }

  navigate(`/signup?ref=${encodeURIComponent(code.toUpperCase())}`, { replace: true });
}
