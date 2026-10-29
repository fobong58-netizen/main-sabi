(function () {
    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;

    function setOpen(open) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menu.classList.toggle('open', open);
    }

    toggle.addEventListener('click', function () {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // close when a menu item is tapped
    menu.addEventListener('click', function (e) {
        if (e.target.closest('button, a')) setOpen(false);
    });

    // close with Escape and return focus to the toggle
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('open')) {
            setOpen(false);
            toggle.focus();
        }
    });

    // close when tapping outside the nav
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.nav-bar')) setOpen(false);
    });

    // reset when resizing up to desktop
    window.matchMedia('(min-width: 701px)').addEventListener('change', function (e) {
        if (e.matches) setOpen(false);
    });
})();