document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const loginBtn = document.getElementById('loginBtn');
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('errorMessage');

      // Feedback visual de carregamento
      loginBtn.innerText = 'Autenticando...';
      loginBtn.disabled = true;

      // Autenticação com credenciais fixas (aroldorotas@rotas.com / entregas123)
      setTimeout(() => {
        if (email === 'aroldorotas@rotas.com' && password === 'entregas123') {
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userEmail', email);
          window.location.href = 'organizador-rotas.html';
        } else {
          errorMessage.style.display = 'block';
          errorMessage.textContent = 'E-mail ou senha incorretos.';
          loginBtn.innerText = 'Entrar';
          loginBtn.disabled = false;
        }
      }, 1200);
    });
  }

  // Check if already logged in
  if (localStorage.getItem('isLoggedIn') === 'true') {
    // window.location.href = 'organizador-rotas.html';
  }
});
