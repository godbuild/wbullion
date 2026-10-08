import { navigate } from '../router.js';

export function renderHelp() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Help</h2>
      <button id="closeHelp" class="wb-close"><i class="fas fa-close"></i></button>
    </div>

    <div style="line-height:1.7;font-size:14px;color:var(--text-primary);padding-bottom:60px;">

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Getting Started</h3>
      <p>1. Sign up with a valid email, choose a username (starting with @), and verify the terms.</p>
      <p>2. Activate your account by paying the one-time NGN 500 fee and uploading your SMS alert + bank receipt.</p>
      <p>3. Once the admin confirms, your account unlocks all earning features.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Earning on W Bullion</h3>
      <p><strong>Daily Bonuses:</strong> Claim NGN 150 every day (grows by NGN 50 per day). Day 7 doubles your week's cumulative total.</p>
      <p><strong>Referrals:</strong> Share your referral link. Every new signup earns you NGN 500.</p>
      <p><strong>Games:</strong> Play Football Shootout, Tic-Tac-Toe, Rock-Paper-Scissors, Leveller, and Predict Tic-Tac-Toe. Win real NGN rewards.</p>
      <p><strong>Reels:</strong> Create a reel and earn NGN 500 instantly. Each like your reel gets earns you NGN 200.</p>
      <p><strong>Followers:</strong> Every new follower earns you NGN 1,000.</p>
      <p><strong>Tasks:</strong> Complete tasks posted by HOEP users and earn NGN 150 per completion.</p>
      <p><strong>Telegram Bonus:</strong> Follow us on Telegram for a one-time NGN 200 bonus.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Streaks</h3>
      <p>Visit W Bullion once a day to keep your streak alive. Missing a day resets your streak back to day 1.</p>
      <p>Check your streak history anytime: tap "Hello, [Your Name]" on the home screen.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Help Others Earn Program (HOEP)</h3>
      <p>Turn on HOEP to appear in other users' "Suggested People To Follow" list. When someone follows you through HOEP, you earn a percentage of their NGN 1,000 follow reward — you choose the percentage (5% to 30%).</p>
      <p>HOEP also lets you create tasks for others. You earn NGN 500 for creating a task and set the reward amount you want to give.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Visibility</h3>
      <p>Turn off visibility to make your profile private. No one can search you or see your reels. You also cannot create reels, view other profiles, follow, or like reels.</p>
      <p>You can still refer, watch reels, play games, and earn.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Badges</h3>
      <p>Meet all four criteria and the admin may award you the W Bullion Verified Badge:</p>
      <ul style="padding-left:20px;">
        <li>HOEP turned on</li>
        <li>At least 1 reel posted</li>
        <li>At least 3 successful referrals</li>
        <li>Balance of at least NGN 100,000,000</li>
      </ul>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">W Waiter</h3>
      <p>On mobile, when you tap-to-copy account details or links, W Waiter holds them in a floating circle (like Facebook Messenger Chat Heads). Open it later to paste them anywhere.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Withdrawals</h3>
      <p>Withdrawals open December 1, 2026. Minimum withdrawal is NGN 1,500.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Permissions</h3>
      <p>Manage the site's access to your location, storage, notifications, and background running from the Permissions menu.</p>

      <h3 style="font-size:15px;font-weight:700;margin-top:16px;">Safety & Terms</h3>
      <p>W Bullion can only be accessed in Nigeria. NGN shown on the site is virtual and not real currency. All your actions on the site are recorded.</p>

      <p style="margin-top:30px;text-align:center;color:var(--text-secondary);font-size:12px;">— End of Help —</p>
    </div>
  `;

  document.getElementById('closeHelp').onclick = () => history.back();
}
