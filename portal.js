(() => {
  const SESSION_KEY = 'fourinone_session';
  const REGISTER_NUMBER = '23cb062';
  const PASSWORD = 'Student@123';
  const AUTO_LOGOUT_MS = 10 * 60 * 1000;

  const loginForm = document.getElementById('loginForm');
  const passwordToggle = document.querySelector('.password-toggle');
  const passwordInput = document.getElementById('password');

  const motionCanvas = document.getElementById('loginMotionCanvas');
  if (motionCanvas) {
    const context = motionCanvas.getContext('2d');
    const pointer = { x: 0, y: 0 };
    const stars = Array.from({ length: 72 }, (_, index) => ({
      x: ((index * 83) % 997) / 997,
      y: ((index * 191) % 991) / 991,
      z: .25 + (((index * 47) % 100) / 100) * .75
    }));
    const vertices = [
      [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
      [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]
    ];
    const faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resizeMotion = () => {
      const bounds = motionCanvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      motionCanvas.width = Math.round(width * pixelRatio);
      motionCanvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const rotate = (point, rx, ry, rz) => {
      let [x, y, z] = point;
      let cosine = Math.cos(rx), sine = Math.sin(rx);
      [y, z] = [y * cosine - z * sine, y * sine + z * cosine];
      cosine = Math.cos(ry); sine = Math.sin(ry);
      [x, z] = [x * cosine + z * sine, -x * sine + z * cosine];
      cosine = Math.cos(rz); sine = Math.sin(rz);
      [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
      return [x, y, z];
    };

    const drawCube = (centerX, centerY, size, time, phase, tint) => {
      const rotated = vertices.map((point) => rotate(point, time * .00035 + phase, time * .0005 + phase * .7, time * .00022));
      const projected = rotated.map(([x, y, z]) => {
        const scale = 4.8 / (5.4 - z);
        return { x: centerX + x * size * scale, y: centerY + y * size * scale, z };
      });
      const orderedFaces = faces
        .map((face) => ({ face, depth: face.reduce((sum, index) => sum + projected[index].z, 0) / 4 }))
        .sort((a, b) => a.depth - b.depth);

      orderedFaces.forEach(({ face, depth }, faceIndex) => {
        const gradient = context.createLinearGradient(centerX - size, centerY - size, centerX + size, centerY + size);
        gradient.addColorStop(0, `hsla(${tint + faceIndex * 5}, 92%, 73%, ${.09 + (depth + 1) * .08})`);
        gradient.addColorStop(1, `hsla(${tint + 34}, 88%, 38%, ${.2 + (depth + 1) * .1})`);
        context.beginPath();
        face.forEach((index, pointIndex) => pointIndex
          ? context.lineTo(projected[index].x, projected[index].y)
          : context.moveTo(projected[index].x, projected[index].y));
        context.closePath();
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = `hsla(${tint + 20}, 95%, 78%, ${.2 + (depth + 1) * .15})`;
        context.lineWidth = .7;
        context.stroke();
      });
    };

    const drawMotion = (time) => {
      context.clearRect(0, 0, width, height);
      const background = context.createRadialGradient(width * .54, height * .48, 0, width * .54, height * .48, Math.max(width, height) * .68);
      background.addColorStop(0, '#0b2851');
      background.addColorStop(.42, '#06172f');
      background.addColorStop(1, '#020713');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const drift = time * .000018;
      stars.forEach((star) => {
        const x = ((star.x + drift * star.z) % 1) * width;
        const y = star.y * height + Math.sin(time * .0004 + star.x * 8) * 8 * star.z;
        context.fillStyle = `rgba(151,220,255,${.12 + star.z * .35})`;
        context.fillRect(x, y, star.z * 1.4, star.z * 1.4);
      });

      const mobileMotion = width < 760;
      const centerX = width * ((mobileMotion ? .76 : .55) + pointer.x * .025);
      const centerY = height * ((mobileMotion ? .27 : .47) + pointer.y * .025);
      const orbit = Math.min(width, height) * (mobileMotion ? .16 : .245);
      const cubeSize = Math.max(mobileMotion ? 30 : 42, Math.min(width, height) * (mobileMotion ? .065 : .092));
      const positions = [];
      for (let index = 0; index < 4; index += 1) {
        const angle = time * .00022 + index * Math.PI / 2;
        positions.push({
          x: centerX + Math.cos(angle) * orbit,
          y: centerY + Math.sin(angle) * orbit * .52,
          depth: Math.sin(angle)
        });
      }

      context.beginPath();
      positions.forEach((position, index) => index
        ? context.lineTo(position.x, position.y)
        : context.moveTo(position.x, position.y));
      context.closePath();
      context.strokeStyle = 'rgba(92, 198, 255, .16)';
      context.lineWidth = 1;
      context.stroke();

      positions.sort((a, b) => a.depth - b.depth).forEach((position, index) => {
        const size = cubeSize * (.76 + (position.depth + 1) * .18);
        drawCube(position.x, position.y, size, time, index * .85, index % 2 ? 167 : 205);
      });

      const coreGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, orbit * .9);
      coreGlow.addColorStop(0, 'rgba(85, 244, 255, .17)');
      coreGlow.addColorStop(1, 'rgba(33, 90, 255, 0)');
      context.fillStyle = coreGlow;
      context.fillRect(centerX - orbit, centerY - orbit, orbit * 2, orbit * 2);
      window.requestAnimationFrame(drawMotion);
    };

    window.addEventListener('resize', resizeMotion);
    window.addEventListener('pointermove', (event) => {
      pointer.x = event.clientX / window.innerWidth - .5;
      pointer.y = event.clientY / window.innerHeight - .5;
    }, { passive: true });
    resizeMotion();
    window.requestAnimationFrame(drawMotion);
  }

  const ADMIN_USER = 'admin@4in1';
  const ADMIN_PASS = 'Admin@321';

  if (loginForm) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlReg = urlParams.get('registerNumber');
    const urlPass = urlParams.get('password');
    if (urlReg && urlPass) {
      const reg = urlReg.trim().toLowerCase();
      const pass = urlPass.trim();
      const isAdmin = (reg === 'admin@4in1' || reg === 'admin') && (pass === 'Admin@321' || pass.toLowerCase() === 'admin@321');
      const isStudent = (reg === '23cb062') && (pass === 'Student@123' || pass.toLowerCase() === 'student@123');
      if (isAdmin) {
        sessionStorage.setItem(SESSION_KEY, 'admin_authenticated');
        window.location.replace('admin.html');
        return;
      } else if (isStudent) {
        sessionStorage.setItem(SESSION_KEY, 'authenticated');
        window.location.replace('dashboard.html');
        return;
      }
    }

    passwordToggle?.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      passwordToggle.textContent = showing ? 'SHOW' : 'HIDE';
      passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      passwordToggle.setAttribute('aria-pressed', String(!showing));
    });

    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const registerInput = document.getElementById('registerNumber');
      const formMessage = document.getElementById('formMessage');
      const registerNumber = registerInput.value.trim().toLowerCase();
      const password = passwordInput.value.trim();

      loginForm.classList.remove('invalid');
      formMessage.textContent = '';

      if (!registerNumber || !password) {
        formMessage.textContent = 'Both register number and password are required.';
        loginForm.classList.add('invalid');
        (!registerNumber ? registerInput : passwordInput).focus();
        return;
      }

      const isAdminUser = (registerNumber === 'admin@4in1' || registerNumber === 'admin');
      const isAdminPass = (password === 'Admin@321' || password.toLowerCase() === 'admin@321');
      const isAdmin = isAdminUser && isAdminPass;

      const isStudentUser = (registerNumber === '23cb062');
      const isStudentPass = (password === 'Student@123' || password.toLowerCase() === 'student@123');
      const isStudent = isStudentUser && isStudentPass;

      if (!isAdmin && !isStudent) {
        formMessage.textContent = 'Identity mismatch. Verify the register node and password.';
        loginForm.classList.add('invalid');
        passwordInput.select();
        return;
      }

      const submitButton = loginForm.querySelector('[type="submit"]');
      submitButton.classList.add('is-loading');

      if (isAdmin) {
        submitButton.innerHTML = 'Resolving admin identity <span>···</span>';
        sessionStorage.setItem(SESSION_KEY, 'admin_authenticated');
        window.setTimeout(() => window.location.assign('admin.html'), 650);
      } else {
        submitButton.innerHTML = 'Resolving identity <span>···</span>';
        sessionStorage.setItem(SESSION_KEY, 'authenticated');
        window.setTimeout(() => window.location.assign('dashboard.html'), 650);
      }
    });
  }

  const adminPage = document.querySelector('.admin-page');
  if (adminPage && sessionStorage.getItem(SESSION_KEY) !== 'admin_authenticated') {
    window.location.replace('login.html');
    return;
  }

  const protectedPage = document.querySelector('.dashboard-page:not(.admin-page)');
  if (protectedPage && sessionStorage.getItem(SESSION_KEY) !== 'authenticated' && sessionStorage.getItem(SESSION_KEY) !== 'admin_authenticated') {
    window.location.replace('login.html');
    return;
  }
  if (protectedPage) {
    let autoLogoutTimer = 0;
    const clearPrivateSession = () => {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(`${SESSION_KEY}_23cb062_checkout_v3`);
      window.location.assign('login.html?timeout=1');
    };
    const resetAutoLogout = () => {
      window.clearTimeout(autoLogoutTimer);
      autoLogoutTimer = window.setTimeout(clearPrivateSession, AUTO_LOGOUT_MS);
    };
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, resetAutoLogout, { passive: true });
    });
    resetAutoLogout();
  }

  const dashboard = document.querySelector('.product-profile-page');
  if (dashboard) {

    const PURCHASES_KEY = `${SESSION_KEY}_23cb062_purchases_v3`;
    const CHECKOUT_KEY = `${SESSION_KEY}_23cb062_checkout_v3`;
    const splash = document.getElementById('portalSplash');
    const dialog = document.getElementById('feedbackDialog');
    const dialogTitle = document.getElementById('feedbackTitle');
    const dialogCopy = document.getElementById('feedbackCopy');
    const dialogSelection = document.getElementById('feedbackSelection');
    const dialogConfirm = document.getElementById('feedbackConfirm');
    const purchaseButton = document.getElementById('purchaseButton');
    const selectionCount = document.getElementById('selectionCount');
    const selectionTotal = document.getElementById('selectionTotal');
    const filteredEmpty = document.getElementById('filteredEmpty');
    const toast = document.getElementById('portalToast');
    const rows = [...document.querySelectorAll('.fee-row')];
    const tabs = [...document.querySelectorAll('.fee-tab')];
    let activeFilter = 'unpaid';
    let confirmedAction = null;
    let previousFocus = null;

    let purchasedBundles = [];
    try {
      purchasedBundles = JSON.parse(localStorage.getItem(PURCHASES_KEY) || '[]');
      if (!Array.isArray(purchasedBundles)) purchasedBundles = [];
    } catch {
      purchasedBundles = [];
    }

    const hideSplash = () => {
      if (!splash || splash.classList.contains('is-resolved')) return;
      splash.classList.add('is-resolved');
      window.setTimeout(() => splash.remove(), 850);
    };
    window.addEventListener('load', () => window.setTimeout(hideSplash, 520), { once: true });
    window.setTimeout(hideSplash, 1400);

    const showToast = (message) => {
      if (!toast) return;
      toast.querySelector('span').textContent = message;
      toast.classList.add('show');
      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
    };

    const bundleNameForRow = (row) => row.querySelector('.fee-name').childNodes[row.querySelector('.fee-name').childNodes.length - 1].textContent.trim();

    const updateCounts = () => {
      const paid = rows.filter((row) => row.dataset.state === 'paid').length;
      const unpaid = rows.length - paid;
      document.getElementById('pendingCount').textContent = String(unpaid).padStart(2, '0');
      document.getElementById('paidCount').textContent = String(paid).padStart(2, '0');
      document.getElementById('unpaidTabCount').textContent = String(unpaid);
      document.getElementById('paidTabCount').textContent = String(paid);
    };

    const updateSelection = () => {
      const checked = rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked);
      selectionCount.textContent = String(checked.length);
      selectionTotal.textContent = `₹${(checked.length * 2000).toLocaleString('en-IN')}`;
      purchaseButton.disabled = checked.length === 0;
      document.getElementById('purchaseTray').classList.toggle('has-selection', checked.length > 0);
      rows.forEach((row) => row.classList.toggle('is-selected', row.querySelector('input[type="checkbox"]')?.checked));
    };

    const applyPurchasedState = () => {
      rows.forEach((row) => {
        const isPaid = purchasedBundles.includes(row.dataset.bundleId);
        row.dataset.state = isPaid ? 'paid' : 'unpaid';
        row.classList.toggle('is-paid', isPaid);
        const status = row.querySelector('.fee-status b');
        const checkbox = row.querySelector('input[type="checkbox"]');
        status.textContent = isPaid ? 'Purchased' : 'Pending';
        checkbox.disabled = isPaid;
        if (isPaid) checkbox.checked = false;
      });
      updateCounts();
      updateSelection();
    };

    const applyFilter = (filter) => {
      activeFilter = filter;
      tabs.forEach((tab) => {
        const active = tab.dataset.filter === filter;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      let visibleCount = 0;
      rows.forEach((row, index) => {
        const visible = filter === 'all' || row.dataset.state === filter;
        row.hidden = !visible;
        row.style.setProperty('--row-delay', `${index * 55}ms`);
        if (visible) visibleCount += 1;
      });
      filteredEmpty.hidden = visibleCount !== 0;
      document.getElementById('purchaseTray').hidden = filter === 'paid';
    };

    const closeFeedback = () => {
      if (!dialog || dialog.hidden) return;
      dialog.classList.remove('open');
      document.body.classList.remove('dialog-open');
      confirmedAction = null;
      window.setTimeout(() => {
        dialog.hidden = true;
        previousFocus?.focus?.();
      }, 280);
    };

    const openFeedback = ({ title, copy, confirmLabel = 'Continue', selection = '', onConfirm }) => {
      previousFocus = document.activeElement;
      dialogTitle.textContent = title;
      dialogCopy.textContent = copy;
      dialogConfirm.innerHTML = `${confirmLabel} <span>↗</span>`;
      dialogSelection.hidden = !selection;
      dialogSelection.innerHTML = selection;
      confirmedAction = onConfirm;
      dialog.hidden = false;
      document.body.classList.add('dialog-open');
      requestAnimationFrame(() => dialog.classList.add('open'));
      dialogConfirm.focus();
    };

    const processPurchase = () => {
      const selectedRows = rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked);
      if (!selectedRows.length) return;
      dialog.classList.add('is-processing');
      dialogConfirm.disabled = true;
      dialogConfirm.innerHTML = 'Opening gateway <span>•••</span>';

      window.setTimeout(() => {
        const checkout = {
          registerNumber: '23CB062',
          createdAt: new Date().toISOString(),
          bundles: selectedRows.map((row) => ({
            id: row.dataset.bundleId,
            name: bundleNameForRow(row),
            returnDate: row.querySelector('[data-label="Return Date"] time')?.dateTime || '',
            returnLabel: row.querySelector('[data-label="Return Date"] time')?.textContent.trim() || '',
            price: 2000,
            returnFee: 1800,
            netFee: 200
          }))
        };
        sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(checkout));
        window.location.assign('payment.html');
      }, 780);
    };

    applyPurchasedState();
    applyFilter('unpaid');

    tabs.forEach((tab) => tab.addEventListener('click', () => applyFilter(tab.dataset.filter)));
    rows.forEach((row) => row.querySelector('input[type="checkbox"]')?.addEventListener('change', updateSelection));

    purchaseButton?.addEventListener('click', () => {
      const selectedRows = rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked);
      if (!selectedRows.length) return;
      const names = selectedRows.map((row) => `<span>${bundleNameForRow(row)}</span>`).join('');
      openFeedback({
        title: `Purchase ${selectedRows.length} selected bundle${selectedRows.length > 1 ? 's' : ''}?`,
        copy: `The selected product field will be reserved for 23CB062. Payable now: ₹${(selectedRows.length * 2000).toLocaleString('en-IN')}. Purchase status changes only after payment reference confirmation.`,
        confirmLabel: 'Proceed to payment',
        selection: names,
        onConfirm: processPurchase
      });
    });

    document.querySelectorAll('[data-feedback]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.feedback;
        const configs = {
          back: {
            title: 'Return to the bundle dashboard?',
            copy: 'Your product profile and current selections will remain available.',
            confirmLabel: 'Back to dashboard',
            onConfirm: () => window.location.assign('dashboard.html')
          },
          logout: {
            title: 'Log out of this profile?',
            copy: 'The private dashboard session will close. Purchased bundle records remain attached to 23CB062 on this device.',
            confirmLabel: 'Log out',
            onConfirm: () => {
              sessionStorage.removeItem(SESSION_KEY);
              window.location.assign('login.html');
            }
          },
          exit: {
            title: 'Exit the product portal?',
            copy: 'You will return to the public 4IN1 experience without ending this session.',
            confirmLabel: 'Exit portal',
            onConfirm: () => window.location.assign('index.html')
          }
        };
        openFeedback(configs[action]);
      });
    });

    dialogConfirm?.addEventListener('click', () => confirmedAction?.());
    document.querySelectorAll('[data-feedback-cancel]').forEach((button) => button.addEventListener('click', closeFeedback));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dialog && !dialog.hidden && !dialog.classList.contains('is-processing')) closeFeedback();
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: .14 });
      document.querySelectorAll('.reveal-item').forEach((item) => observer.observe(item));
    } else {
      document.querySelectorAll('.reveal-item').forEach((item) => item.classList.add('is-visible'));
    }
  }

  const paymentPage = document.querySelector('.payment-page');
  if (paymentPage) {
    const PURCHASES_KEY = `${SESSION_KEY}_23cb062_purchases_v3`;
    const CHECKOUT_KEY = `${SESSION_KEY}_23cb062_checkout_v3`;
    const RECEIPTS_KEY = `${SESSION_KEY}_23cb062_receipts_v3`;
    const splash = document.getElementById('paymentSplash');
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutCount = document.getElementById('checkoutCount');
    const checkoutReturn = document.getElementById('checkoutReturn');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const gpayMethod = document.getElementById('gpayMethod');
    const cardMethod = document.getElementById('cardMethod');
    const analyzeButton = document.getElementById('analyzePayment');
    const analysisField = document.getElementById('analysisField');
    const qrField = document.getElementById('qrField');
    const proofForm = document.getElementById('paymentProof');
    const paymentMessage = document.getElementById('paymentMessage');
    const confirmPayment = document.getElementById('confirmPayment');
    const cardStage = document.getElementById('cardStage');
    const cardForm = document.getElementById('cardPaymentForm');
    const cardMessage = document.getElementById('cardPaymentMessage');
    const confirmCardPayment = document.getElementById('confirmCardPayment');
    const success = document.getElementById('paymentSuccess');
    const successCopy = document.getElementById('successCopy');
    const toast = document.getElementById('paymentToast');
    let checkout = null;

    try {
      checkout = JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || 'null');
      if (!checkout || !Array.isArray(checkout.bundles)) checkout = null;
    } catch {
      checkout = null;
    }

    const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
    const showPaymentToast = (message) => {
      if (!toast) return;
      toast.querySelector('span').textContent = message;
      toast.classList.add('show');
      window.clearTimeout(showPaymentToast.timer);
      showPaymentToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3600);
    };

    const customQr = localStorage.getItem('fourinone_custom_qr');
    const paymentQrImg = document.getElementById('paymentQrImg');
    if (paymentQrImg && customQr) {
      paymentQrImg.src = customQr;
    }
    if (window.FourInOneSupabase?.data?.getActiveQr) {
      window.FourInOneSupabase.data.getActiveQr().then((dbQr) => {
        if (dbQr?.public_url && paymentQrImg) {
          paymentQrImg.src = dbQr.public_url;
        }
      }).catch(() => {});
    }

    const resolvePaymentSplash = () => {
      if (!splash || splash.classList.contains('is-resolved')) return;
      splash.classList.add('is-resolved');
      window.setTimeout(() => splash.remove(), 850);
      window.setTimeout(() => document.querySelectorAll('.reveal-item').forEach((item) => item.classList.add('is-visible')), 120);
    };
    window.addEventListener('load', () => window.setTimeout(resolvePaymentSplash, 430), { once: true });
    window.setTimeout(resolvePaymentSplash, 1400);

    if (checkout?.bundles.length) {
      const payable = checkout.bundles.reduce((sum, bundle) => sum + Number(bundle.price || 2000), 0);
      const returns = checkout.bundles.reduce((sum, bundle) => sum + Number(bundle.returnFee || 1800), 0);
      checkoutCount.textContent = String(checkout.bundles.length).padStart(2, '0');
      checkoutReturn.textContent = formatCurrency(returns);
      checkoutTotal.textContent = formatCurrency(payable);
      checkoutItems.innerHTML = checkout.bundles.map((bundle, index) => `<article class="checkout-item"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${bundle.name}</strong><small>Return field ${bundle.returnLabel || bundle.returnDate}</small></div><b>${formatCurrency(bundle.price)}</b></article>`).join('');
    } else {
      checkoutItems.innerHTML = '<div class="checkout-empty"><strong>No active reservation.</strong><p>Return to the product profile and select at least one unpaid bundle.</p><a href="profile.html#fees" class="portal-primary compact">Choose bundles <span>↗</span></a></div>';
      checkoutCount.textContent = '00';
      checkoutReturn.textContent = '₹0';
      checkoutTotal.textContent = '₹0';
      analyzeButton.disabled = true;
    }

    analyzeButton?.addEventListener('click', () => {
      if (!checkout?.bundles.length || analysisField.classList.contains('is-analyzing')) return;
      analysisField.classList.add('is-analyzing');
      analyzeButton.disabled = true;
      analyzeButton.innerHTML = 'Analyzing GPay relay <span>•••</span>';
      window.setTimeout(() => {
        analysisField.hidden = true;
        qrField.hidden = false;
        proofForm.hidden = false;
        requestAnimationFrame(() => {
          qrField.classList.add('is-ready');
          proofForm.classList.add('is-ready');
        });
        showPaymentToast('GPay scanner field initialized. Complete payment, then enter the UTR.');
        qrField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1450);
    });

    document.getElementById('openGpay')?.addEventListener('click', () => {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = 'gpay://scanner';
        window.setTimeout(() => showPaymentToast('If GPay did not open, launch its scanner and scan the displayed QR.'), 900);
      } else {
        showPaymentToast('GPay scanner launch is available on a supported mobile device.');
      }
    });

    const hashReference = (value) => {
      let hash = 2166136261;
      for (const character of value) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };

    proofForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      paymentMessage.textContent = '';
      if (!checkout?.bundles.length) {
        paymentMessage.textContent = 'No reserved bundle is available for payment.';
        return;
      }
      const utrInput = document.getElementById('utrNumber');
      const emailInput = document.getElementById('billEmail');
      const utr = utrInput.value.trim().toUpperCase();
      const email = emailInput.value.trim();
      if (!/^[A-Z0-9]{12,22}$/.test(utr)) {
        paymentMessage.textContent = 'Enter a valid 12–22 character UTR or transaction reference.';
        utrInput.focus();
        return;
      }
      if (!emailInput.checkValidity()) {
        paymentMessage.textContent = 'Enter a valid email address for the E-bill.';
        emailInput.focus();
        return;
      }

      let receipts = [];
      let purchases = [];
      try {
        receipts = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]');
        purchases = JSON.parse(localStorage.getItem(PURCHASES_KEY) || '[]');
        if (!Array.isArray(receipts)) receipts = [];
        if (!Array.isArray(purchases)) purchases = [];
      } catch {
        receipts = [];
        purchases = [];
      }
      const referenceHash = hashReference(utr);
      if (receipts.some((receipt) => receipt.referenceHash === referenceHash)) {
        paymentMessage.textContent = 'This payment reference has already been used.';
        utrInput.focus();
        return;
      }

      confirmPayment.disabled = true;
      confirmPayment.innerHTML = 'Verifying reference <span>•••</span>';
      proofForm.classList.add('is-verifying');
      window.setTimeout(() => {
        checkout.bundles.forEach((bundle) => {
          if (!purchases.includes(bundle.id)) purchases.push(bundle.id);
        });
        const amount = checkout.bundles.reduce((sum, bundle) => sum + Number(bundle.price || 2000), 0);
        receipts.push({
          receiptId: `GDD-${Date.now().toString(36).toUpperCase()}`,
          registerNumber: '23CB062',
          bundleIds: checkout.bundles.map((bundle) => bundle.id),
          amount,
          method: 'Google Pay',
          referenceHash,
          referenceLast4: utr.slice(-4),
          email,
          recordedAt: new Date().toISOString()
        });
        localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
        localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
        sessionStorage.removeItem(CHECKOUT_KEY);
        successCopy.textContent = `${checkout.bundles.length} bundle${checkout.bundles.length > 1 ? 's' : ''} activated for 23CB062. The prototype E-bill is prepared for ${email}.`;
        success.hidden = false;
        requestAnimationFrame(() => success.classList.add('open'));
        window.setTimeout(() => window.location.assign('dashboard.html'), 2500);
      }, 1450);
    });

    document.getElementById('paymentLogout')?.addEventListener('click', () => {
      if (!window.confirm('Log out and leave this reserved checkout?')) return;
      sessionStorage.removeItem(CHECKOUT_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      window.location.assign('login.html');
    });
  }

  const dashboardHome = document.querySelector('.dashboard-home-page');
  if (dashboardHome) {
    const PURCHASES_KEY = `${SESSION_KEY}_23cb062_purchases_v3`;
    const RETURN_CLAIMS_KEY = `${SESSION_KEY}_23cb062_return_claims_v3`;
    const bundleNames = {
      quadrature: { index: '01', name: 'Quadrature Neural Foundation', returnDate: '2026-08-30', returnLabel: '30 Aug 2026' },
      canopy: { index: '02', name: 'Ambient Canopy Systems', returnDate: '2026-09-30', returnLabel: '30 Sep 2026' },
      mycelial: { index: '03', name: 'Mycelial Data Routing', returnDate: '2026-10-30', returnLabel: '30 Oct 2026' },
      quantum: { index: '04', name: 'Post-Quantum Architecture', returnDate: '2026-11-30', returnLabel: '30 Nov 2026' }
    };
    let purchases = [];
    let returnClaims = [];
    try {
      purchases = JSON.parse(localStorage.getItem(PURCHASES_KEY) || '[]');
      if (!Array.isArray(purchases)) purchases = [];
      returnClaims = JSON.parse(localStorage.getItem(RETURN_CLAIMS_KEY) || '[]');
      if (!Array.isArray(returnClaims)) returnClaims = [];
    } catch {
      purchases = [];
      returnClaims = [];
    }

    const count = document.getElementById('dashboardPurchasedCount');
    const empty = document.getElementById('dashboardEmpty');
    const grid = document.getElementById('dashboardPurchasedGrid');
    count.textContent = String(purchases.length).padStart(2, '0');
    if (purchases.length) {
      empty.hidden = true;
      grid.hidden = false;
      grid.innerHTML = purchases.map((id) => {
        const bundle = bundleNames[id];
        if (!bundle) return '';
        const claimed = returnClaims.includes(id);
        return `<a class="purchased-product" href="#payment"><small>${bundle.index} / ${claimed ? 'RETURNED' : 'ACTIVE'}</small><strong>${bundle.name}</strong><span>Paid ₹2,000 · ${claimed ? '₹1,800 claimed' : `₹1,800 claimable ${bundle.returnLabel}`}</span><i>↘</i></a>`;
      }).join('');
    }

    const renderPaymentPortal = () => {
      const today = new Date();
      const claimable = purchases.filter((id) => {
        const bundle = bundleNames[id];
        return bundle && !returnClaims.includes(id) && today >= new Date(`${bundle.returnDate}T00:00:00`);
      });
      const scheduled = purchases.filter((id) => bundleNames[id] && !returnClaims.includes(id));
      document.getElementById('claimableAmount').textContent = `₹${(claimable.length * 1800).toLocaleString('en-IN')}`;
      document.getElementById('scheduledAmount').textContent = `₹${(scheduled.length * 1800).toLocaleString('en-IN')}`;

      const portalEmpty = document.getElementById('returnPortalEmpty');
      const claimsContainer = document.getElementById('returnClaims');
      if (!purchases.length) return;
      portalEmpty.hidden = true;
      claimsContainer.hidden = false;
      claimsContainer.innerHTML = purchases.map((id) => {
        const bundle = bundleNames[id];
        if (!bundle) return '';
        const claimed = returnClaims.includes(id);
        const unlocked = today >= new Date(`${bundle.returnDate}T00:00:00`);
        const state = claimed ? 'claimed' : unlocked ? 'claimable' : 'locked';
        const buttonText = claimed ? 'Return claimed' : unlocked ? 'Claim ₹1,800' : `Locked until ${bundle.returnLabel}`;
        return `<article class="return-claim ${state}">
          <span class="claim-index">${bundle.index}</span>
          <div><small>${state === 'locked' ? 'Scheduled return' : state === 'claimable' ? 'Return available' : 'Return completed'}</small><strong>${bundle.name}</strong><p>Paid now ₹2,000 <i>→</i> Return fee ₹1,800 <i>→</i> Net fee ₹200</p></div>
          <time datetime="${bundle.returnDate}">${bundle.returnLabel}</time>
          <button type="button" data-claim-bundle="${id}" ${unlocked && !claimed ? '' : 'disabled'}>${buttonText}</button>
        </article>`;
      }).join('');

      claimsContainer.querySelectorAll('[data-claim-bundle]:not(:disabled)').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.dataset.claimBundle;
          const bundle = bundleNames[id];
          if (!bundle || !window.confirm(`Claim the ₹1,800 return fee for ${bundle.name}?`)) return;
          if (!returnClaims.includes(id)) returnClaims.push(id);
          localStorage.setItem(RETURN_CLAIMS_KEY, JSON.stringify(returnClaims));
          renderPaymentPortal();
        });
      });
    };
    renderPaymentPortal();

    const splash = document.getElementById('dashboardSplash');
    const resolveSplash = () => {
      if (!splash || splash.classList.contains('is-resolved')) return;
      splash.classList.add('is-resolved');
      window.setTimeout(() => splash.remove(), 850);
    };
    window.addEventListener('load', () => window.setTimeout(resolveSplash, 420), { once: true });
    window.setTimeout(resolveSplash, 1300);

    document.getElementById('dashboardLogout')?.addEventListener('click', () => {
      if (!window.confirm('Log out of the 4IN1 product portal?')) return;
      sessionStorage.removeItem(SESSION_KEY);
      window.location.assign('login.html');
    });

    document.querySelector('.profile-nav-link')?.addEventListener('click', (event) => {
      event.preventDefault();
      dashboardHome.classList.add('profile-transition');
      window.setTimeout(() => window.location.assign('profile.html'), 520);
    });
  }

  if (adminPage) {
    const ADMIN_BUNDLES_KEY = 'fourinone_admin_bundles_23cb062';
    const CUSTOM_QR_KEY = 'fourinone_custom_qr';
    const PURCHASES_KEY = `${SESSION_KEY}_23cb062_purchases_v3`;

    // Admin Logout
    document.getElementById('adminLogout')?.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.assign('login.html');
    });

    // Toast notification helper
    const toast = document.getElementById('adminToast');
    const showAdminToast = (msg) => {
      if (!toast) return;
      toast.querySelector('span').textContent = msg;
      toast.classList.add('show');
      window.clearTimeout(showAdminToast.timer);
      showAdminToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3500);
    };

    // QR Management Logic
    const previewImg = document.getElementById('adminQrPreviewImg');
    const qrTypeLabel = document.getElementById('adminQrType');
    const qrFileInput = document.getElementById('qrFileInput');
    const qrUrlInput = document.getElementById('qrUrlInput');
    const adminQrForm = document.getElementById('adminQrForm');
    const resetQrBtn = document.getElementById('resetQrBtn');

    const updateQrDisplay = () => {
      const stored = localStorage.getItem(CUSTOM_QR_KEY);
      if (stored) {
        if (previewImg) previewImg.src = stored;
        if (qrTypeLabel) qrTypeLabel.textContent = 'Custom QR Configured';
      } else {
        if (previewImg) previewImg.src = 'assets/gpay-qr.png';
        if (qrTypeLabel) qrTypeLabel.textContent = 'Default PhonePe/GPay QR';
      }
    };
    updateQrDisplay();

    adminQrForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('adminQrMsg');
      if (msg) msg.textContent = '';

      if (qrFileInput?.files?.length) {
        const file = qrFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          localStorage.setItem(CUSTOM_QR_KEY, dataUrl);
          updateQrDisplay();
          showAdminToast('Uploaded custom QR code applied successfully!');
          qrFileInput.value = '';
        };
        reader.readAsDataURL(file);

        try {
          if (window.FourInOneSupabase?.data?.uploadActiveQr) {
            await window.FourInOneSupabase.data.uploadActiveQr(file);
          }
        } catch (err) {
          console.log('Supabase upload notice:', err.message);
        }
        return;
      }

      const urlValue = qrUrlInput?.value.trim();
      if (urlValue) {
        localStorage.setItem(CUSTOM_QR_KEY, urlValue);
        updateQrDisplay();
        showAdminToast('Custom QR URL saved and applied!');
        qrUrlInput.value = '';
        return;
      }

      if (msg) msg.textContent = 'Please choose a file or enter an image URL to apply.';
    });

    resetQrBtn?.addEventListener('click', () => {
      localStorage.removeItem(CUSTOM_QR_KEY);
      updateQrDisplay();
      showAdminToast('Reset to default PhonePe / GPay QR code.');
    });

    // Default Bundles data for Student 23CB062
    const defaultBundles = [
      { id: 'quadrature', name: 'Quadrature Neural Foundation', period: 'Jul · 20', payable: '2,000', returnDate: '2026-08-30', returnFee: '1,800', totalFee: '200', status: 'unpaid' },
      { id: 'canopy', name: 'Ambient Canopy Systems', period: 'Jul · 25', payable: '2,000', returnDate: '2026-09-30', returnFee: '1,800', totalFee: '200', status: 'unpaid' },
      { id: 'mycelial', name: 'Mycelial Data Routing', period: 'Jul · 25', payable: '2,000', returnDate: '2026-10-30', returnFee: '1,800', totalFee: '200', status: 'unpaid' },
      { id: 'quantum', name: 'Post-Quantum Architecture', period: 'Jul · 28', payable: '2,000', returnDate: '2026-11-30', returnFee: '1,800', totalFee: '200', status: 'unpaid' }
    ];

    const getBundles = () => {
      try {
        const stored = localStorage.getItem(ADMIN_BUNDLES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length) return parsed;
        }
      } catch {}
      return defaultBundles;
    };

    const tbody = document.getElementById('adminBundleTableBody');
    const renderTable = () => {
      if (!tbody) return;
      const bundles = getBundles();
      tbody.innerHTML = bundles.map((b) => `
        <tr data-bundle-id="${b.id}">
          <td>
            <select class="admin-table-select status-select">
              <option value="unpaid" ${b.status === 'unpaid' ? 'selected' : ''}>Un Paid</option>
              <option value="paid" ${b.status === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="returned" ${b.status === 'returned' ? 'selected' : ''}>Returned</option>
              <option value="locked" ${b.status === 'locked' ? 'selected' : ''}>Locked</option>
            </select>
          </td>
          <td><input class="admin-table-input name-input" type="text" value="${b.name}"></td>
          <td><input class="admin-table-input period-input" type="text" value="${b.period}"></td>
          <td><input class="admin-table-input payable-input" type="text" value="₹${b.payable.toString().replace('₹','')}"></td>
          <td><input class="admin-table-input returndate-input" type="text" value="${b.returnDate}"></td>
          <td><input class="admin-table-input returnfee-input" type="text" value="₹${b.returnFee.toString().replace('₹','')}"></td>
          <td><input class="admin-table-input totalfee-input" type="text" value="₹${b.totalFee.toString().replace('₹','')}"></td>
          <td>
            <button type="button" class="portal-primary compact save-single-btn" data-id="${b.id}">Save ↗</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.save-single-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          saveBundlesFromUI();
          showAdminToast(`Updated bundle '${btn.dataset.id}' for student 23CB062.`);
        });
      });
    };

    const saveBundlesFromUI = () => {
      if (!tbody) return;
      const rows = [...tbody.querySelectorAll('tr')];
      const updated = rows.map((tr) => ({
        id: tr.dataset.bundleId,
        status: tr.querySelector('.status-select').value,
        name: tr.querySelector('.name-input').value,
        period: tr.querySelector('.period-input').value,
        payable: tr.querySelector('.payable-input').value.replace('₹',''),
        returnDate: tr.querySelector('.returndate-input').value,
        returnFee: tr.querySelector('.returnfee-input').value.replace('₹',''),
        totalFee: tr.querySelector('.totalfee-input').value.replace('₹','')
      }));

      localStorage.setItem(ADMIN_BUNDLES_KEY, JSON.stringify(updated));

      // Sync purchased state for student 23CB062
      const paidIds = updated.filter((b) => b.status === 'paid' || b.status === 'returned').map((b) => b.id);
      localStorage.setItem(PURCHASES_KEY, JSON.stringify(paidIds));
    };

    document.getElementById('saveAllBundlesBtn')?.addEventListener('click', () => {
      saveBundlesFromUI();
      showAdminToast('All bundle changes saved for student 23CB062!');
    });

    renderTable();
  }
})();
