document.addEventListener('DOMContentLoaded', function() {
    const btn = document.createElement('div');
    btn.id = 'back-to-top';
    btn.innerText = '↑ Наверх';
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        btn.style.display = window.scrollY > 200 ? 'block' : 'none';
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
