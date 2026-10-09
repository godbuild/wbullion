import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showAlert } from '../modal.js';

let _usernameAvailable = false;
let _emailAvailable = false;

export function wasTermsRead() {
  return sessionStorage.getItem('wb_terms_read') === '1';
}

export function markTermsRead() {
  sessionStorage.setItem('wb_terms_read', '1');
}

export function renderSignup() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = (urlParams.get('ref') || '').toUpperCase();

  // Load saved draft
  let draft = {};
  try { draft = JSON.parse(sessionStorage.getItem('wb_signup_draft') || '{}'); } catch {}

  const termsRead = wasTermsRead();
  _usernameAvailable = !!draft.usernameAvailable;
  _emailAvailable = !!draft.emailAvailable;

  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="text-align:center;margin-bottom:30px;">
      <img src="/images/logo.png" style="width:80px;height:80px;margin:0 auto 12px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
      <h2 style="font-size:28px;font-weight:bold;">Create Account</h2>
    </div>
    ${refCode ? `<div style="background:#e1fedb;padding:12px;border-radius:12px;margin-bottom:20px;color:#110587;font-size:14px;">🎁 Referral code applied: <strong>${refCode}</strong></div>` : ''}
    <form id="signupForm" style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <label class="wb-label">Full Name</label>
        <input id="suName" type="text" placeholder="Enter your full name" class="wb-input" value="${draft.name || ''}" required>
      </div>
      <div>
        <label class="wb-label">Set Username</label>
        <div class="at-wrap">
          <span class="at-prefix">@</span>
          <input id="suUsername" type="text" placeholder="username" class="wb-input at-input" maxlength="30" value="${draft.username || ''}" required>
        </div>
        <p id="usernameStatus" style="font-size:12px;margin-top:4px;color:var(--text-secondary);">${_usernameAvailable ? '<span style="color:#10b981;">Available</span>' : ''}</p>
      </div>
      <div>
        <label class="wb-label">Email</label>
        <input id="suEmail" type="email" placeholder="Enter your email" class="wb-input" value="${draft.email || ''}" required>
        <p id="emailStatus" style="font-size:12px;margin-top:4px;color:var(--text-secondary);">${_emailAvailable ? '<span style="color:#10b981;">Available</span>' : ''}</p>
      </div>
      <div>
        <label class="wb-label">Set Up Password</label>
        <div class="pw-wrap">
          <input id="suPassword" type="password" placeholder="Create a password" class="wb-input" value="${draft.password || ''}" required>
          <button type="button" class="pw-eye" data-target="suPassword"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <div>
        <label class="wb-label">Confirm Password</label>
        <div class="pw-wrap">
          <input id="suConfirm" type="password" placeholder="Confirm your password" class="wb-input" value="${draft.confirm || ''}" required>
          <button type="button" class="pw-eye" data-target="suConfirm"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <div>
        <label class="wb-label">Referral Code (Optional)</label>
        <input id="suReferral" type="text" placeholder="Enter referral code" class="wb-input" value="${draft.referral || refCode}" ${refCode ? 'readonly style="background:#e5e7eb;color:black;"' : ''} maxlength="15">
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;">
        <input id="suTerms" type="checkbox" ${termsRead ? 'checked' : ''} disabled style="margin-top:3px;transform:scale(1.2);">
        <label for="suTerms">I have read the <a id="termsLink" style="color:var(--green);font-weight:bold;text-decoration:underline;cursor:pointer;">terms and policies</a></label>
      </div>
      <button type="submit" id="suSubmit" class="wb-btn-primary" disabled style="opacity:0.5;pointer-events:none;">Sign Up</button>
    </form>
    <p style="text-align:center;margin-top:20px;font-size:14px;">Already have an account? <a data-route="/login" style="color:var(--green);font-weight:bold;cursor:pointer;text-decoration:underline;">Log In</a></p>
  `;

  // Eye toggles
  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      const ic = btn.querySelector('i');
      if (inp.type === 'password') { inp.type = 'text'; ic.className = 'fas fa-eye-slash'; }
      else { inp.type = 'password'; ic.className = 'fas fa-eye'; }
    });
  });

  const userIn = document.getElementById('suUsername');
  const userStatus = document.getElementById('usernameStatus');
  let userTimer;
  userIn.addEventListener('input', () => {
    const p = userIn.selectionStart;
    userIn.value = userIn.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    userIn.setSelectionRange(p, p);
    clearTimeout(userTimer);
    if (!userIn.value) {
      userStatus.textContent = '';
      _usernameAvailable = false;
      refreshSubmit();
      return;
    }
    userStatus.textContent = 'Checking...';
    userStatus.style.color = 'var(--text-secondary)';
    userTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?action=check-username&username=${encodeURIComponent(userIn.value)}`);
        const data = await res.json();
        if (data.available) {
          userStatus.textContent = 'Available';
          userStatus.style.color = '#10b981';
          _usernameAvailable = true;
        } else {
          userStatus.textContent = 'Try another username';
          userStatus.style.color = '#ef4444';
          _usernameAvailable = false;
        }
      } catch {
        userStatus.textContent = '';
        _usernameAvailable = false;
      }
      refreshSubmit();
    }, 350);
  });

  const emailIn = document.getElementById('suEmail');
  const emailStatus = document.getElementById('emailStatus');
  let emailTimer;
  emailIn.addEventListener('input', () => {
    const p = emailIn.selectionStart;
    emailIn.value = emailIn.value.toLowerCase();
    emailIn.setSelectionRange(p, p);
    clearTimeout(emailTimer);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn.value)) {
      emailStatus.textContent = '';
      _emailAvailable = false;
      refreshSubmit();
      return;
    }
    emailStatus.textContent = 'Checking...';
    emailStatus.style.color = 'var(--text-secondary)';
    emailTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?action=check-email&email=${encodeURIComponent(emailIn.value)}`);
        const data = await res.json();
        if (data.available) {
          emailStatus.textContent = 'Available';
          emailStatus.style.color = '#10b981';
          _emailAvailable = true;
        } else {
          emailStatus.textContent = 'Try another email';
          emailStatus.style.color = '#ef4444';
          _emailAvailable = false;
        }
      } catch {
        emailStatus.textContent = '';
        _emailAvailable = false;
      }
      refreshSubmit();
    }, 400);
  });

  const refIn = document.getElementById('suReferral');
  refIn.addEventListener('input', () => {
    const p = refIn.selectionStart;
    refIn.value = refIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    refIn.setSelectionRange(p, p);
  });

  document.getElementById('termsLink').addEventListener('click', () => {
    saveDraft();
    sessionStorage.setItem('wb_terms_return', '/signup');
    navigate('/terms');
  });

  ['suName', 'suPassword', 'suConfirm'].forEach(id => {
    document.getElementById(id).addEventListener('input', refreshSubmit);
  });

  function refreshSubmit() {
    const name = document.getElementById('suName').value.trim();
    const pwd = document.getElementById('suPassword').value;
    const cfm = document.getElementById('suConfirm').value;
    const terms = document.getElementById('suTerms').checked;
    const ok = name && _usernameAvailable && _emailAvailable && pwd.length >= 6 && pwd === cfm && terms;
    const btn = document.getElementById('suSubmit');
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
    btn.style.pointerEvents = ok ? 'auto' : 'none';
  }

  function saveDraft() {
    sessionStorage.setItem('wb_signup_draft', JSON.stringify({
      name: document.getElementById('suName').value,
      username: document.getElementById('suUsername').value,
      email: document.getElementById('suEmail').value,
      password: document.getElementById('suPassword').value,
      confirm: document.getElementById('suConfirm').value,
      referral: document.getElementById('suReferral').value,
      usernameAvailable: _usernameAvailable,
      emailAvailable: _emailAvailable
    }));
  }

  // Clear terms flag now that we've consumed it
  if (termsRead) sessionStorage.removeItem('wb_terms_read');

  refreshSubmit();

  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('suSubmit');
    const payload = {
      fullName: document.getElementById('suName').value.trim(),
      username: '@' + document.getElementById('suUsername').value.trim().toLowerCase(),
      email: document.getElementById('suEmail').value.trim().toLowerCase(),
      password: document.getElementById('suPassword').value,
      referralCode: document.getElementById('suReferral').value.trim(),
      deviceId: getDeviceId()
    };

    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      setCurrentUser(data.user);
      sessionStorage.removeItem('wb_signup_draft');
      sessionStorage.removeItem('wb_terms_read');
      navigate('/activation');
    } catch (err) {
      await showAlert(err.message, 'Signup Failed');
      btn.disabled = false;
      btn.textContent = 'Sign Up';
    }
  });
}
