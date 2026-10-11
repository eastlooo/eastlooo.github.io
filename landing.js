if (navigator.language.toLowerCase().startsWith('en')) {
  document.documentElement.lang = 'en'; document.title = 'Tadak Tadak';
  for (const [id, text] of Object.entries({title:'Tadak Tadak',intro:'Practice Korean typing with everyday writing.',challenge:'Same-sentence challenge',description:'Type the same sentence as a friend and compare your records.',install:'After installing, open Practice modes and tap “Enter a challenge code”.'})) document.getElementById(id).textContent = text;
}
