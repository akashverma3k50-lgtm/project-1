/**
 * Apex Digital Studio - Client-Side Application Script
 * Standards-compliant, lightweight vanilla JavaScript with zero framework overhead
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initContactForm();
  initAnalytics();
  initHeaderScroll();
  initScrollAnimations();
  initNumberCounters();
  initCardSpotlights();
  initHero3DTilt();
  initThemeToggle();
  initBackButton();
  initHeroCanvas();
  initScrollToTop();
});

/**
 * 1. Mobile Navigation Toggle
 */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobileToggle');
  const mainNav = document.getElementById('mainNav');

  if (!toggleBtn || !mainNav) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    mainNav.classList.toggle('is-open');
  });

  // Close nav when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (
      mainNav.classList.contains('is-open') &&
      !mainNav.contains(e.target) &&
      !toggleBtn.contains(e.target)
    ) {
      mainNav.classList.remove('is-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * 2. Asynchronous Contact Form Submission with CSRF & Anti-Spam
 */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.btn-text');
  const btnSpinner = submitBtn?.querySelector('.btn-spinner');
  const alertBox = document.getElementById('formAlert');

  // Input elements
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const subjectInput = document.getElementById('subject');
  const messageInput = document.getElementById('message');
  const honeypotInput = document.getElementById('website_url_hp');
  const timestampInput = document.getElementById('formTimestamp');
  const csrfInput = document.getElementById('csrfToken');

  // Error labels
  const nameError = document.getElementById('nameError');
  const emailError = document.getElementById('emailError');
  const subjectError = document.getElementById('subjectError');
  const messageError = document.getElementById('messageError');

  // Pre-fill subject if passed in URL query (e.g. from Services page)
  const urlParams = new URLSearchParams(window.location.search);
  const serviceParam = urlParams.get('service');
  if (serviceParam && subjectInput) {
    let matched = false;
    if (subjectInput.options) {
      for (let i = 0; i < subjectInput.options.length; i++) {
        if (subjectInput.options[i].value.toLowerCase().includes(serviceParam.toLowerCase())) {
          subjectInput.selectedIndex = i;
          matched = true;
          break;
        }
      }
    }
    if (!matched && subjectInput.tagName === 'SELECT') {
      const opt = document.createElement('option');
      opt.value = `Inquiry regarding ${serviceParam}`;
      opt.textContent = `Inquiry regarding ${serviceParam}`;
      opt.selected = true;
      subjectInput.appendChild(opt);
    } else if (subjectInput.tagName !== 'SELECT') {
      subjectInput.value = `Inquiry regarding ${serviceParam}`;
    }
  }

  // Auto-clear validation error on subject change
  if (subjectInput) {
    subjectInput.addEventListener('change', () => {
      if (subjectInput.value) {
        subjectInput.classList.remove('is-invalid');
        if (subjectError) subjectError.textContent = '';
      }
    });
  }

  function clearErrors() {
    [nameError, emailError, subjectError, messageError].forEach((el) => {
      if (el) el.textContent = '';
    });
    [nameInput, emailInput, subjectInput, messageInput].forEach((el) => {
      if (el) el.classList.remove('is-invalid');
    });
    if (alertBox) {
      alertBox.className = 'alert d-none';
      alertBox.textContent = '';
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    let hasClientErrors = false;

    // Validate Name
    if (!nameInput.value || nameInput.value.trim().length < 2) {
      nameError.textContent = 'Please enter your full name (at least 2 characters).';
      nameInput.classList.add('is-invalid');
      hasClientErrors = true;
    }

    // Validate Email
    if (!emailInput.value || !validateEmail(emailInput.value.trim())) {
      emailError.textContent = 'Please provide a valid email address.';
      emailInput.classList.add('is-invalid');
      hasClientErrors = true;
    }

    // Validate Subject / Interest
    if (!subjectInput.value || subjectInput.value.trim().length < 2) {
      subjectError.textContent = 'Please select a subject / service of interest from the list.';
      subjectInput.classList.add('is-invalid');
      hasClientErrors = true;
    }

    // Validate Message
    if (!messageInput.value || messageInput.value.trim().length < 10) {
      messageError.textContent = 'Message must be at least 10 characters long.';
      messageInput.classList.add('is-invalid');
      hasClientErrors = true;
    }

    if (hasClientErrors) {
      return;
    }

    // Loading State
    if (submitBtn) submitBtn.disabled = true;
    if (btnSpinner) btnSpinner.classList.remove('d-none');
    if (btnText) btnText.textContent = 'Sending Message...';

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      subject: subjectInput.value.trim(),
      message: messageInput.value.trim(),
      website_url_hp: honeypotInput ? honeypotInput.value : '',
      form_timestamp: timestampInput ? parseInt(timestampInput.value, 10) : Date.now(),
      _csrf: csrfInput ? csrfInput.value : '',
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': payload._csrf,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Form reset & success alert
        form.reset();
        if (alertBox) {
          alertBox.className = 'alert alert-success';
          alertBox.textContent = result.message || 'Thank you! Your message has been received.';
        }
      } else {
        // Display validation errors or general error message
        if (result.errors && Array.isArray(result.errors)) {
          result.errors.forEach((err) => {
            if (err.field === 'name' && nameError) nameError.textContent = err.message;
            if (err.field === 'email' && emailError) emailError.textContent = err.message;
            if (err.field === 'subject' && subjectError) subjectError.textContent = err.message;
            if (err.field === 'message' && messageError) messageError.textContent = err.message;
          });
        }
        if (alertBox) {
          alertBox.className = 'alert alert-error';
          alertBox.textContent =
            result.message || 'There was an issue submitting your inquiry. Please try again.';
        }
      }
    } catch (err) {
      console.error('Contact submission error:', err);
      if (alertBox) {
        alertBox.className = 'alert alert-error';
        alertBox.textContent =
          'Network or server connection failed. Please check your connection or contact us directly.';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (btnSpinner) btnSpinner.classList.add('d-none');
      if (btnText) btnText.textContent = 'Send Message';
      if (alertBox) alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

/**
 * 3. Privacy-Friendly On-Page Analytics Tracker
 */
function initAnalytics() {
  try {
    const payload = JSON.stringify({
      event_type: 'pageview',
      path: window.location.pathname,
      referrer: document.referrer || '',
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics', blob);
    } else {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently ignore analytics errors
      });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * 4. Sticky Header Scroll Elevation
 */
function initHeaderScroll() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  function onScroll() {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/**
 * 5. Scroll Reveal Animations (IntersectionObserver)
 */
function initScrollAnimations() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // Auto-annotate primary section cards if not already annotated
  const autoTargets = document.querySelectorAll(
    '.pillar-card, .showcase-card, .service-detail-card, .process-card, .testimonial-card, .stat-card, .cta-box, .contact-info-card, .contact-form-wrapper'
  );

  autoTargets.forEach((el, index) => {
    if (
      !el.classList.contains('reveal') &&
      !el.classList.contains('reveal-left') &&
      !el.classList.contains('reveal-right') &&
      !el.classList.contains('reveal-scale')
    ) {
      el.classList.add('reveal');
      const staggerIndex = (index % 4) + 1;
      el.classList.add(`reveal-delay-${staggerIndex}00`);
    }
  });

  const revealElements = document.querySelectorAll(
    '.reveal, .reveal-left, .reveal-right, .reveal-scale'
  );
  if (!revealElements.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback for browsers without IntersectionObserver
    revealElements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -30px 0px',
    }
  );

  revealElements.forEach((el) => observer.observe(el));
}

/**
 * 6. Smooth Animated Number Counters
 */
function initNumberCounters() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statValues = document.querySelectorAll('.stat-value');
  if (!statValues.length) return;

  if (prefersReduced || !('IntersectionObserver' in window)) {
    return; // Keep existing static values for accessibility / unsupported browsers
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  statValues.forEach((el) => observer.observe(el));

  function animateCounter(el) {
    const rawText = el.textContent.trim();
    // Parse numeric value, prefix (< or similar), and suffix (%, s, +, etc.)
    const match = rawText.match(/^([<>]?)(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return;

    const prefix = match[1] || '';
    const targetNum = parseFloat(match[2]);
    const suffix = match[3] || '';
    const isDecimal = match[2].includes('.');
    const decimalPlaces = isDecimal ? match[2].split('.')[1].length : 0;

    const duration = 1200; // ms
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentVal = targetNum * ease;

      const formattedNum = isDecimal ? currentVal.toFixed(decimalPlaces) : Math.round(currentVal);
      el.textContent = `${prefix}${formattedNum}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = rawText; // restore exact original value
      }
    }

    requestAnimationFrame(step);
  }
}

/**
 * 7. Modern Interactive Card Mouse Spotlight
 */
function initCardSpotlights() {
  const cards = document.querySelectorAll(
    '.card, .showcase-card, .service-detail-card, .process-card, .stat-card, .contact-info-card'
  );

  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

/**
 * 8. Modern 3D Perspective Tilt on Hero Graphic
 */
function initHero3DTilt() {
  const heroVisual = document.querySelector('.hero-visual');
  const heroGraphic = document.querySelector('.hero-graphic-wrapper');
  if (!heroVisual || !heroGraphic) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  heroVisual.addEventListener('mousemove', (e) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = (centerY - y) / 32;
    const tiltY = (x - centerX) / 32;

    heroGraphic.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
  });

  heroVisual.addEventListener('mouseleave', () => {
    heroGraphic.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    heroGraphic.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
  });

  heroVisual.addEventListener('mouseenter', () => {
    heroGraphic.style.transition = 'transform 0.1s ease-out';
  });
}

/**
 * 9. Dark/Light Theme Switcher with Persistence
 */
function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('apex_theme', nextTheme);
  });
}

/**
 * 10. Smart Back Button Navigation
 */
function initBackButton() {
  const backButtons = document.querySelectorAll('.btn-back-header, .page-back-link');
  backButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // If the visitor navigated within the site, use history.back() for preservation
      if (
        window.history.length > 1 &&
        document.referrer &&
        document.referrer.includes(window.location.host)
      ) {
        e.preventDefault();
        window.history.back();
      }
    });
  });
}

/**
 * 11. Interactive Particle Constellation Canvas
 * High-performance, lightweight, hardware-accelerated starfield constellation
 */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  const heroSection = document.querySelector('.hero-section');
  if (!canvas || !heroSection) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let animationFrameId = null;
  let isSectionVisible = true;
  let mouse = { x: null, y: null };

  const PARTICLE_COUNT = 45;
  const CONNECT_DISTANCE = 110;
  const MOUSE_RADIUS = 130;
  const particles = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = heroSection.offsetWidth;
    height = heroSection.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.5 + 1,
        alpha: Math.random() * 0.4 + 0.35,
      });
    }
  }

  heroSection.addEventListener('mousemove', (e) => {
    const rect = heroSection.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  heroSection.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  function render() {
    if (!isSectionVisible) return;

    ctx.clearRect(0, 0, width, height);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const pointColor = isDark ? '56, 189, 248' : '2, 132, 199'; // Sky / Blue

    // Update and draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;

      // Wrap around bounds
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // Mouse gentle interaction
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.x += dx * force * 0.02;
          p.y += dy * force * 0.02;

          // Connect to mouse
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${pointColor}, ${0.35 * force})`;
          ctx.lineWidth = 1;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // Draw particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pointColor}, ${p.alpha})`;
      ctx.fill();

      // Connect with nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECT_DISTANCE) {
          const lineAlpha = (1 - dist / CONNECT_DISTANCE) * 0.22;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${pointColor}, ${lineAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    animationFrameId = requestAnimationFrame(render);
  }

  // IntersectionObserver to pause rendering when hero is off-screen (0 CPU waste)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isSectionVisible = entry.isIntersecting;
        if (isSectionVisible && !animationFrameId) {
          render();
        } else if (!isSectionVisible && animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      });
    }, { threshold: 0.05 });

    observer.observe(heroSection);
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resize();
      initParticles();
    }, 150);
  }, { passive: true });

  resize();
  initParticles();
  render();
}

/**
 * 12. Floating Quick Scroll-to-Top Button
 */
function initScrollToTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  function onScroll() {
    if (window.scrollY > 300) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });
}

