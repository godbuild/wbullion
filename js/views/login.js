import { navigate } from '../router.js';
import { getDeviceId, setCurrentUser } from '../auth.js';
import { showAlert } from '../modal.js';

export function renderLogin() {
  const el = document.getElementById('viewContainer');
  el.innerHTML = `
    <div style="text-align:center;margin-top:40px;margin-bottom:30px;">
      <img src="/images/logo.png" alt="W Bullion" style="width:100px;height:100px;margin:0 auto 16px;border-radius:50%;object-fit:cover;"
           onerror="this.style.display='none'">
      <h1 style="font-size:32px;font-weight:bold;">W Bullion</h1>
      <p style="color:var(--text-secondary);margin-top:8px;">Play games & earn in Bullions</p>
    </div>
    <form id="loginForm" style="display:flex;flex-direction:column;gap:16px;">
      <div>
        <label style="font-size:14px;margin-bottom:8px;display:block;">Email or Username</label>
        <input id="loginIdentifier" type="text" placeholder="email or @username" class="wb-input" autocomplete="username" required>
      </div>
      <div>
        <label style="font-size:14px;margin-bottom:8px;display:block;">Password</label>
        <div class="pw-wrap">
          <input id="loginPassword" type="password" placeholder="Enter your password" class="wb-input" autocomplete="current-password" required>
          <button type="button" class="pw-eye" data-target="loginPassword"><i class="fas fa-eye"></i></button>
        </div>
      </div>
      <button type="submit" class="wb-btn-primary" id="loginSubmit">Log In <i class="fas fa-arrow-right"></i></button>
    </form>
    <p style="text-align:center;margin-top:24px;font-size:14px;">
      Don't have an account? <a data-route="/signup" style="color:var(--green);font-weight:bold;cursor:pointer;text-decoration:underline;">Sign Up</a>
    </p>
  `;

  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector('i');
      if (input.type === 'password') { input.type = 'text'; icon.className = 'fas fa-eye-slash'; }
      else { input.type = 'password'; icon.className = 'fas fa-eye'; }
    });
  });

  // Lowercase enforcement
  const idInput = document.getElementById('loginIdentifier');
  idInput.addEventListener('input', () => {
    const p = idInput.selectionStart;
    idInput.value = idInput.value.toLowerCase();
    idInput.setSelectionRange(p, p);
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmit');
  const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  if (!identifier || !password) return showAlert('Please fill in all fields');

  btn.disabled = true;
  btn.innerHTML = 'Logging in...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, deviceId: getDeviceId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setCurrentUser(data.user);
    navigate(data.user.activated ? '/home' : '/activation');
  } catch (err) {
    await showAlert(err.message, 'Login Failed');
    btn.disabled = false;
    btn.innerHTML = 'Log In <i class="fas fa-arrow-right"></i>';
  }
}
