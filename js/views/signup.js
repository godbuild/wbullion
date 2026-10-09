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

async function checkUsernameAvailable(username) {
  try {
    const res = await fetch(`/api/users?action=check-username&username=${encodeURIComponent(username)}`);
    const data = await res.json();
    return data.available === true;
  } catch { return false; }
}

async function checkEmailAvailable(email) {
  try {
    const res = await fetch(`/api/users?action=check-email&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.available === true;
  } catch { return false; }
}

export function renderSignup() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = (urlParams.get('ref') || '').toUpperCase();

  let draft = {};
  try { draft = JSON.parse(sessionStorage.getItem('wb_signup_draft') || '{}'); } catch {}

  const termsRead = wasTermsRead();

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
        <input id="suName" type="text" placeholder="Enter your full name" class="wb-input" value="${draft.name || ''}">
      </div>
      <div>
        <label class="wb-label">Set Username</label>
        <div class="at-wrap">
          <span class="at-prefix">@</span>
          <input id="suUsername" type="text" placeholder="username" class="wb-input at-input" maxlength="30" value="${draft.username || ''}" autocomplete="off">
        </div>
        <p id="usernameStatus" style="font-size:12px;margin-top:4px;color:var(--text-secondary);"></p>
      </div>
      <div>
        <label class="wb-label">Email</label>
        <input id="suEmail" type="email" placeholder="Enter your email" class="wb-input" value="${draft.email || ''}" autocomplete="off">
        <p id="emailStatus" style="font-size:12px;margin-top:4px;color:var(--text-secondary);"></p>
      </div>
      <div>
        <label class="wb-label">Set Up Password</label>
        <div class="pw-wrap">
          <input id="suPassword" type="password" placeholder="Create a password" class="wb-input" value="${draft.password || ''}">
          <button type="button" class="pw-eye" data-target="suPassword"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <div>
        <label class="wb-label">Confirm Password</label>
        <div class="pw-wrap">
          <input id="suConfirm" type="password" placeholder="Confirm your password" class="wb-input" value="${draft.confirm || ''}">
          <button type="button" class="pw-eye" data-target="suConfirm"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <div>
        <label class="wb-label">Referral Code (Optional)</label>
        <input id="suReferral" type="text" placeholder="Enter referral code" class="wb-input" value="${draft.referral || refCode}" ${refCode ? 'readonly style="background:#e5e7eb;color:black;"' : ''} maxlength="15" autocomplete="off">
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;">
        <input id="suTerms" type="checkbox" ${termsRead ? 'checked' : ''} disabled style="margin-top:3px;transform:scale(1.2);">
        <label for="suTerms">I have read the <a id="termsLink" style="color:var(--green);font-weight:bold;text-decoration:underline;cursor:pointer;">terms and policies</a></label>
      </div>
      <button type="submit" id="suSubmit" class="wb-btn-primary">Sign Up</button>
    </form>
    <p style="text-align:center;margin-top:20px;font-size:14px;">Already have an account? <a data-route="/login" style="color:var(--green);font-weight:bold;cursor:pointer;text-decoration:underline;">Log In</a></p>
  `;

  // Element references — grabbed once, used everywhere
  const userIn     = document.getElementById('suUsername');
  const userStatus = document.getElementById('usernameStatus');
  const emailIn    = document.getElementById('suEmail');
  const emailStatus= document.getElementById('emailStatus');
  const refIn      = document.getElementById('suReferral');

  // Eye toggles
  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      const ic = btn.querySelector('i');
      if (inp.type === 'password') { inp.type = 'text'; ic.className = 'fas fa-eye-slash'; }
      else { inp.type = 'password'; ic.className = 'fas fa-eye'; }
    });
  });

  // ---- USERNAME live check ----
  let userTimer;
  userIn.addEventListener('input', () => {
    const pos = userIn.selectionStart;
    userIn.value = userIn.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    userIn.setSelectionRange(pos, pos);
    clearTimeout(userTimer);
    _usernameAvailable = false;

    const val = userIn.value.trim();
    if (!val) { userStatus.textContent = ''; return; }

    userStatus.textContent = 'Checking username…';
    userStatus.style.color = 'var(--text-secondary)';

    userTimer = setTimeout(async () => {
      // Guard: if the field has changed since we started, ignore the result
      if (userIn.value.trim() !== val) return;
      const ok = await checkUsernameAvailable(val);
      if (userIn.value.trim() !== val) return; // double check after await
      _usernameAvailable = ok;
      if (ok) {
        userStatus.textContent = `@${val} is available`;
        userStatus.style.color = '#10b981';
      } else {
        userStatus.textContent = `@${val} is taken — try another`;
        userStatus.style.color = '#ef4444';
      }
    }, 350);
  });

  // ---- EMAIL live check ----
  let emailTimer;
  emailIn.addEventListener('input', () => {
    const pos = emailIn.selectionStart;
    emailIn.value = emailIn.value.toLowerCase();
    emailIn.setSelectionRange(pos, pos);
    clearTimeout(emailTimer);
    _emailAvailable = false;

    const val = emailIn.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { emailStatus.textContent = ''; return; }

    emailStatus.textContent = 'Checking email…';
    emailStatus.style.color = 'var(--text-secondary)';

    emailTimer = setTimeout(async () => {
      if (emailIn.value.trim() !== val) return;
      const ok = await checkEmailAvailable(val);
      if (emailIn.value.trim() !== val) return;
      _emailAvailable = ok;
      if (ok) {
        emailStatus.textContent = `${val} is available`;
        emailStatus.style.color = '#10b981';
      } else {
        emailStatus.textContent = `${val} is already registered`;
        emailStatus.style.color = '#ef4444';
      }
    }, 400);
  });

  // ---- REFERRAL ----
  refIn.addEventListener('input', () => {
    const pos = refIn.selectionStart;
    refIn.value = refIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    refIn.setSelectionRange(pos, pos);
  });

  // ---- TERMS ----
  document.getElementById('termsLink').addEventListener('click', () => {
    sessionStorage.setItem('wb_signup_draft', JSON.stringify({
      name:     document.getElementById('suName').value,
      username: userIn.value,
      email:    emailIn.value,
      password: document.getElementById('suPassword').value,
      confirm:  document.getElementById('suConfirm').value,
      referral: refIn.value
    }));
    sessionStorage.setItem('wb_terms_return', '/signup');
    navigate('/terms');
  });

  if (termsRead) sessionStorage.removeItem('wb_terms_read');

  // ---- SUBMIT ----
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name     = document.getElementById('suName').value.trim();
    const username = userIn.value.trim().toLowerCase();
    const email    = emailIn.value.trim().toLowerCase();
    const password = document.getElementById('suPassword').value;
    const confirm  = document.getElementById('suConfirm').value;
    const referral = refIn.value.trim();
    const terms    = document.getElementById('suTerms').checked;

    if (!name) return showAlert('Please enter your full name');
    if (!username) return showAlert('Please enter a username');
    if (!/^[a-z0-9_]{2,30}$/.test(username)) return showAlert('Username: 2–30 lowercase letters, numbers or underscores');
    if (!email) return showAlert('Please enter your email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert('Please enter a valid email');
    if (password.length < 6) return showAlert('Password must be at least 6 characters');
    if (password !== confirm) return showAlert('Passwords do not match');
    if (!terms) return showAlert('Please read and agree to the terms and policies');

    const btn = document.getElementById('suSubmit');
    btn.disabled = true;
    btn.textContent = 'Checking availability…';

    // Re-verify both on submit (fixes race conditions)
    const [userOk, emailOk] = await Promise.all([
      checkUsernameAvailable(username),
      checkEmailAvailable(email)
    ]);

    if (!userOk) {
      userStatus.textContent = `@${username} is taken — try another`;
      userStatus.style.color = '#ef4444';
      btn.disabled = false;
      btn.textContent = 'Sign Up';
      return showAlert(`Username @${username} is already taken. Please choose another.`, 'Not Available');
    }
    if (!emailOk) {
      emailStatus.textContent = `${email} is already registered`;
      emailStatus.style.color = '#ef4444';
      btn.disabled = false;
      btn.textContent = 'Sign Up';
      return showAlert(`Email ${email} is already registered. Please use another.`, 'Not Available');
    }

    btn.textContent = 'Creating account…';

    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          username: '@' + username,
          email,
          password,
          referralCode: referral,
          deviceId: getDeviceId()
        })
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
