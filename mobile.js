// Mobile menu button, shared by every page.
(function () {
  var nav = document.getElementById('mainNav');
  if (!nav || !nav.querySelector('.nav-links')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(btn);
  function setOpen(open) {
    nav.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-lock', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  setOpen(false);
  btn.addEventListener('click', function () { setOpen(!nav.classList.contains('menu-open')); });
  nav.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) setOpen(false); });
})();
