/**
 * Quick Fix - Interactive Frontend Engine
 * Includes Service Booking Wizard, Instant Search & Filters, Animated Counters, Modals & Toast System.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize AOS if available
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic'
    });
  }

  // --- Sticky Navigation Glass Effect ---
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('shadow-xl', 'bg-navy-900/95', 'backdrop-blur-md');
      header.classList.remove('bg-navy-900');
    } else {
      header.classList.remove('shadow-xl');
    }
  });

  // --- Mobile Hamburger Menu ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // --- Modal Utilities ---
  const bookingModal = document.getElementById('booking-modal');
  const loginModal = document.getElementById('login-modal');
  const signupModal = document.getElementById('signup-modal');

  window.openBookingModal = function (serviceName = '') {
    if (bookingModal) {
      bookingModal.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (serviceName) {
        const serviceSelect = document.getElementById('booking-service-select');
        if (serviceSelect) {
          serviceSelect.value = serviceName;
        }
      }
    }
  };

  window.closeBookingModal = function () {
    if (bookingModal) {
      bookingModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  };

  window.openLoginModal = function () {
    if (loginModal) {
      loginModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeLoginModal = function () {
    if (loginModal) {
      loginModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  };

  window.openSignupModal = function () {
    if (signupModal) {
      signupModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeSignupModal = function () {
    if (signupModal) {
      signupModal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  };

  window.switchAuthModal = function (target) {
    closeLoginModal();
    closeSignupModal();
    if (target === 'signup') openSignupModal();
    if (target === 'login') openLoginModal();
  };

  // Close modals on outside click
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
      }
    });
  });

  // --- Multi-Step Booking Wizard Logic ---
  let currentStep = 1;
  const totalSteps = 3;

  window.nextBookingStep = function () {
    const serviceSelect = document.getElementById('booking-service-select');
    const nameInput = document.getElementById('booking-name');
    const phoneInput = document.getElementById('booking-phone');
    const addressInput = document.getElementById('booking-address');
    const dateInput = document.getElementById('booking-date');

    if (currentStep === 1) {
      if (!serviceSelect || !serviceSelect.value) {
        showToast('Please select an appliance service', 'error');
        return;
      }
    } else if (currentStep === 2) {
      if (!dateInput || !dateInput.value) {
        showToast('Please choose a preferred appointment date', 'error');
        return;
      }
    } else if (currentStep === 3) {
      if (!nameInput.value || !phoneInput.value || !addressInput.value) {
        showToast('Please fill out all contact & address fields', 'error');
        return;
      }

      // Complete Booking Process
      const bookingId = 'QF-' + Math.floor(100000 + Math.random() * 900000);
      document.getElementById('conf-booking-id').innerText = bookingId;
      document.getElementById('conf-service').innerText = serviceSelect.value;
      document.getElementById('conf-date').innerText = dateInput.value;
      document.getElementById('conf-phone').innerText = phoneInput.value;

      document.getElementById('wizard-step-1').classList.add('hidden');
      document.getElementById('wizard-step-2').classList.add('hidden');
      document.getElementById('wizard-step-3').classList.add('hidden');
      document.getElementById('wizard-step-success').classList.remove('hidden');
      document.getElementById('wizard-actions').classList.add('hidden');

      showToast(`Booking Successful! ID: ${bookingId}`, 'success');

      // Setup WhatsApp trigger
      const whatsappBtn = document.getElementById('conf-whatsapp-btn');
      if (whatsappBtn) {
        const msg = encodeURIComponent(
          `Hello Quick Fix! I booked service ID ${bookingId} for ${serviceSelect.value} on ${dateInput.value}. Phone: ${phoneInput.value}`
        );
        whatsappBtn.href = `https://wa.me/919967179963?text=${msg}`;
      }
      return;
    }

    currentStep++;
    updateWizardUI();
  };

  window.prevBookingStep = function () {
    if (currentStep > 1) {
      currentStep--;
      updateWizardUI();
    }
  };

  function updateWizardUI() {
    for (let i = 1; i <= totalSteps; i++) {
      const stepEl = document.getElementById(`wizard-step-${i}`);
      const indicatorEl = document.getElementById(`step-indicator-${i}`);
      if (stepEl) {
        stepEl.classList.toggle('hidden', i !== currentStep);
      }
      if (indicatorEl) {
        if (i === currentStep) {
          indicatorEl.className =
            'w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md';
        } else if (i < currentStep) {
          indicatorEl.className =
            'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm';
        } else {
          indicatorEl.className =
            'w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm';
        }
      }
    }

    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');
    if (prevBtn) prevBtn.classList.toggle('hidden', currentStep === 1);
    if (nextBtn) nextBtn.innerText = currentStep === totalSteps ? 'Confirm & Book' : 'Next Step →';
  }

  // Reset booking wizard on modal reopen
  window.resetBookingWizard = function () {
    currentStep = 1;
    updateWizardUI();
    document.getElementById('wizard-step-success').classList.add('hidden');
    document.getElementById('wizard-actions').classList.remove('hidden');
  };

  // --- Services Filter & Instant Search ---
  const serviceCards = document.querySelectorAll('.service-card-item');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const serviceSearchInput = document.getElementById('service-search-input');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      filterServices(filter, serviceSearchInput ? serviceSearchInput.value : '');
    });
  });

  if (serviceSearchInput) {
    serviceSearchInput.addEventListener('input', (e) => {
      const activeFilterBtn = document.querySelector('.filter-btn.active');
      const category = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
      filterServices(category, e.target.value);
    });
  }

  function filterServices(category, query) {
    const q = query.toLowerCase().trim();

    serviceCards.forEach((card) => {
      const cardCategory = card.getAttribute('data-category');
      const title = card.querySelector('.service-title').innerText.toLowerCase();
      const desc = card.querySelector('.service-desc').innerText.toLowerCase();

      const matchesCategory = category === 'all' || cardCategory === category;
      const matchesSearch = title.includes(q) || desc.includes(q);

      if (matchesCategory && matchesSearch) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  }

  // --- Animated Statistics Counter ---
  const statNumbers = document.querySelectorAll('.counter-val');
  let statsAnimated = false;

  function animateCounters() {
    statNumbers.forEach((counter) => {
      const target = +counter.getAttribute('data-target');
      const prefix = counter.getAttribute('data-prefix') || '';
      const suffix = counter.getAttribute('data-suffix') || '';

      let count = 0;
      const speed = target / 50;

      const updateCount = () => {
        count += speed;
        if (count < target) {
          counter.innerText = prefix + Math.ceil(count) + suffix;
          setTimeout(updateCount, 30);
        } else {
          counter.innerText = prefix + target + suffix;
        }
      };
      updateCount();
    });
  }

  // Trigger counters when scrolled into view
  const statsSection = document.getElementById('stats-section');
  if (statsSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !statsAnimated) {
          statsAnimated = true;
          animateCounters();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(statsSection);
  }

  // --- Forms Submission Handling ---
  const contactForm = document.getElementById('quick-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Thank you! Our repair consultant will call you shortly on your provided number.', 'success');
      contactForm.reset();
    });
  }

  const heroQuickBookForm = document.getElementById('hero-quick-book');
  if (heroQuickBookForm) {
    heroQuickBookForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const appSelect = document.getElementById('hero-appliance-select');
      const serviceVal = appSelect ? appSelect.value : '';
      openBookingModal(serviceVal);
    });
  }

  // --- Toast Notification System ---
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    const iconClass = type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-info text-amber-400';
    toast.innerHTML = `<i class="fa-solid ${iconClass} text-lg"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
  window.showToast = showToast;
});
