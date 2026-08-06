// Login Page Script — Marine BDM CRM
// Handles tab switching, sign-in, and sign-up logic

(function () {
  // Auto-redirect if already authenticated
  if (localStorage.getItem('token')) {
    window.location.href = '/pages/dashboard.html';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const errorMsg = document.getElementById('error-msg');
  const successMsg = document.getElementById('success-msg');

  // Tab Switcher Logic
  function showSignIn() {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
  }

  function showSignUp() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
  }

  tabLogin.addEventListener('click', showSignIn);
  tabRegister.addEventListener('click', showSignUp);

  // Check URL parameters for tab
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'signup' || urlParams.get('tab') === 'register') {
    showSignUp();
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value;
    var password = document.getElementById('login-password').value;
    var submitBtn = document.getElementById('login-submit-btn');

    errorMsg.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      var res = await window.ApiService.login({ email: email, password: password });

      if (res && res.success && res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        if (window.UI && window.UI.showToast) {
          window.UI.showToast('Login successful! Welcome back.', 'success');
        }
        setTimeout(function () {
          window.location.href = '/pages/dashboard.html';
        }, 400);
      } else {
        throw new Error(res.message || 'Invalid email or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMsg.textContent =
        (error && error.message) ||
        (error && error.response && error.response.data && error.response.data.message) ||
        'Login failed. Invalid credentials.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In to Portal';
    }
  });

  // Handle Register Submit
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = document.getElementById('reg-name').value;
    var email = document.getElementById('reg-email').value;
    var password = document.getElementById('reg-password').value;
    var role = document.getElementById('reg-role').value;
    var submitBtn = document.getElementById('register-submit-btn');

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      var res = await window.ApiService.register({ name: name, email: email, password: password, role: role });

      if (res && res.success && res.data && res.data.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        successMsg.textContent = 'Account created! Redirecting to Dashboard...';
        successMsg.style.display = 'block';

        setTimeout(function () {
          window.location.href = '/pages/dashboard.html';
        }, 600);
      } else {
        throw new Error(res.message || 'Registration failed.');
      }
    } catch (error) {
      console.error('Register error:', error);
      errorMsg.textContent =
        (error && error.message) ||
        (error && error.response && error.response.data && error.response.data.message) ||
        'Registration failed. Please check inputs.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account & Sign In';
    }
  });

  // Particle Background Animation
  var canvas = document.getElementById('particles-canvas');
  var ctx = canvas.getContext('2d');
  var width, height, particles = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function Particle() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.radius = Math.random() * 2 + 1;
  }
  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > width) this.vx = -this.vx;
    if (this.y < 0 || this.y > height) this.vy = -this.vy;
  };
  Particle.prototype.draw = function () {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.5)';
    ctx.fill();
  };

  for (var i = 0; i < 70; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(14, 165, 233, ' + (0.18 - dist / 700) + ')';
          ctx.lineWidth = 1;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();
