const sections = document.querySelectorAll('.section-fade');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12,
    rootMargin: '0px 0px -8% 0px',
  }
);

sections.forEach((section) => observer.observe(section));

const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.pc-nav');

menuBtn?.addEventListener('click', () => {
  nav?.classList.toggle('open');

  if (nav?.classList.contains('open')) {
    nav.style.display = 'flex';
    nav.style.position = 'absolute';
    nav.style.top = '82px';
    nav.style.right = '4%';
    nav.style.flexDirection = 'column';
    nav.style.background = '#fff';
    nav.style.padding = '1rem';
    nav.style.border = '1px solid #dbe3f0';
    nav.style.borderRadius = '12px';
  } else {
    nav.removeAttribute('style');
  }
});
