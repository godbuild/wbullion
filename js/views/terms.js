import { navigate } from '../router.js';

export function renderTerms() {
  const fromSignup = sessionStorage.getItem('wb_terms_return') === '/signup';
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h2 style="font-size:22px;font-weight:bold;">Terms and Policies</h2>
      <button id="termsClose" class="wb-close"><i class="fas fa-close"></i></button>
    </div>
    <div id="termsScroll" style="height:${fromSignup ? 'calc(100dvh - 220px)' : 'calc(100dvh - 140px)'};overflow-y:auto;padding:20px;background:var(--bg-secondary);border-radius:14px;line-height:1.6;font-size:14px;color:var(--text-primary);">
      <h3>1. Access Restriction</h3>
      <p>W Bullion can only be accessed within Nigeria. Access from outside Nigeria is prohibited and will be blocked.</p>
      <h3>2. Currency Disclaimer</h3>
      <p>All NGN figures displayed on W Bullion are virtual in-app units. They are not real currency and carry no monetary value outside the platform.</p>
      <h3>3. Data Recording</h3>
      <p>All actions performed on W Bullion — including games played, reels created, transactions, referrals, and profile changes — are recorded on our servers and may be reviewed by administrators.</p>
      <h3>4. Account Eligibility</h3>
      <p>You must be at least 18 years old and a Nigerian resident to create an account. One person may operate multiple accounts unless banned.</p>
      <h3>5. Activation</h3>
      <p>A one-time activation fee of NGN 500 is required to access earning features. Activation is confirmed manually by administrators after payment verification.</p>
      <h3>6. Earnings & Withdrawals</h3>
      <p>Earnings are accumulated through games, referrals, reels, tasks, and bonuses. Withdrawals open on December 1, 2026 and are subject to minimum thresholds.</p>
      <h3>7. Content Ownership</h3>
      <p>You retain ownership of reels you upload. By posting, you grant W Bullion a non-exclusive license to display, distribute, and promote your content within the platform.</p>
      <h3>8. Prohibited Conduct</h3>
      <p>The following are prohibited: fraud, impersonation, harassment, uploading illegal content, exploiting bugs, and attempting to manipulate balances or outcomes.</p>
      <h3>9. Account Suspension</h3>
      <p>Accounts that violate these terms may be suspended or permanently banned. Banned users forfeit access to earnings.</p>
      <h3>10. Privacy</h3>
      <p>We collect device identifiers, IP information, and action logs for security and analytics. Your profile visibility is controlled by you in settings.</p>
      <h3>11. Changes to Terms</h3>
      <p>W Bullion may update these terms at any time. Continued use after updates constitutes acceptance.</p>
      <h3>12. Limitation of Liability</h3>
      <p>W Bullion is not liable for losses arising from service interruptions, technical issues, or user errors.</p>
      <p style="margin-top:30px;text-align:center;color:var(--text-secondary);font-style:italic;">— End of Terms —</p>
    </div>
    ${fromSignup ? `
      <button id="jumpEnd" style="position:fixed;right:20px;bottom:140px;background:var(--purple);color:white;padding:10px 16px;border-radius:20px;border:none;cursor:pointer;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:60;">
        <i class="fas fa-arrow-down"></i> Jump to end
      </button>
      <button id="agreeBtn" class="wb-btn-primary" disabled style="margin-top:16px;opacity:0.4;pointer-events:none;">Agree</button>
    ` : ''}
  `;

  const scroller = document.getElementById('termsScroll');

  document.getElementById('termsClose').onclick = () => {
    const back = sessionStorage.getItem('wb_terms_return') || '/settings';
    navigate(back);
  };

  if (fromSignup) {
    const agreeBtn = document.getElementById('agreeBtn');
    function checkScrolled() {
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10;
      if (atBottom) {
        agreeBtn.disabled = false;
        agreeBtn.style.opacity = '1';
        agreeBtn.style.pointerEvents = 'auto';
      }
    }
    scroller.addEventListener('scroll', checkScrolled);

    document.getElementById('jumpEnd').onclick = () => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      setTimeout(checkScrolled, 400);
    };

    agreeBtn.onclick = () => {
      sessionStorage.setItem('wb_terms_read', '1');
      navigate('/signup');
    };
  }
}
