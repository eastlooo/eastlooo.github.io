if (navigator.language.toLowerCase().startsWith('en')) {
  document.documentElement.lang = 'en';
  document.title = 'Tadak Tadak · 404';
  document.getElementById('title').textContent = 'Page not found';
  document.getElementById('home').textContent = 'Go home';
}
