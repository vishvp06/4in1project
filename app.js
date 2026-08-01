(() => {
  const body = document.body;
  const header = document.querySelector('.site-header');
  const glow = document.querySelector('.cursor-glow');
  const cinematic = document.querySelector('.cinematic');
  const panels = [...document.querySelectorAll('.sequence-panel')];
  const progressFill = document.querySelector('.progress-track i');
  const progressPercent = document.querySelector('.progress-percent');
  const progressIndex = document.querySelector('.progress-index');
  const sceneCanvas = document.getElementById('sceneCanvas');
  const particleCanvas = document.getElementById('particleCanvas');
  const particleContext = particleCanvas.getContext('2d');
  const publicAuthActions = document.getElementById('publicAuthActions');
  const portalSessionKey = 'fourinone_session';
  let cinematicProgress = 0;
  let smoothProgress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let particleWidth = 0;
  let particleHeight = 0;
  let particleRatio = 1;
  let particles = [];

  try {
    if (publicAuthActions && sessionStorage.getItem(portalSessionKey) === 'authenticated') {
      publicAuthActions.classList.add('authenticated-actions');
      publicAuthActions.innerHTML = `
        <a class="public-profile-link" href="dashboard.html" aria-label="Return to authenticated dashboard">
          <span class="public-profile-orb">VP<i></i></span>
          <span><b>Vishvaa P</b><small>Dashboard</small></span>
        </a>`;
    }
  } catch {
    // Browsers with restricted file storage simply retain the default login action.
  }

  const phaseForProgress = (progress) => {
    if (progress < 0.18) return 0;
    if (progress < 0.38) return 1;
    if (progress < 0.57) return 2;
    if (progress < 0.78) return 3;
    return 4;
  };

  const updatePanels = (progress) => {
    const phase = phaseForProgress(progress);
    panels.forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.phase) === phase));
    progressFill.style.height = `${progress * 100}%`;
    progressPercent.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')}%`;
    progressIndex.textContent = `0${phase + 1}`;
  };

  const updateScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 22);
    const distance = cinematic.offsetHeight - window.innerHeight;
    cinematicProgress = Math.max(0, Math.min(1, (window.scrollY - cinematic.offsetTop) / Math.max(distance, 1)));
    updatePanels(cinematicProgress);
  };

  // GPU scene renderer: three generated images become one continuous moving shot.
  const gl = sceneCanvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false });
  let sceneProgram = null;
  let sceneUniforms = null;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  const initWebGL = () => {
    if (!gl) return;
    try {
      const vertexSource = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;
      const fragmentSource = `
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform vec2 uPointer;
        uniform float uProgress;
        uniform float uTime;
        uniform sampler2D uTex0;
        uniform sampler2D uTex1;
        uniform sampler2D uTex2;

        vec2 coverUv(vec2 uv) {
          float screenAspect = uResolution.x / uResolution.y;
          float imageAspect = 1.7777778;
          if (screenAspect > imageAspect) {
            uv.y = (uv.y - 0.5) * (imageAspect / screenAspect) + 0.5;
          } else {
            uv.x = (uv.x - 0.5) * (screenAspect / imageAspect) + 0.5;
          }
          return uv;
        }

        vec4 chroma0(vec2 uv, float amount) {
          vec2 dir = uv - 0.5;
          vec2 cuv = coverUv(uv);
          float r = texture2D(uTex0, coverUv(uv + dir * amount)).r;
          float g = texture2D(uTex0, cuv).g;
          float b = texture2D(uTex0, coverUv(uv - dir * amount)).b;
          return vec4(r, g, b, 1.0);
        }
        vec4 chroma1(vec2 uv, float amount) {
          vec2 dir = uv - 0.5;
          vec2 cuv = coverUv(uv);
          float r = texture2D(uTex1, coverUv(uv + dir * amount)).r;
          float g = texture2D(uTex1, cuv).g;
          float b = texture2D(uTex1, coverUv(uv - dir * amount)).b;
          return vec4(r, g, b, 1.0);
        }
        vec4 chroma2(vec2 uv, float amount) {
          vec2 dir = uv - 0.5;
          vec2 cuv = coverUv(uv);
          float r = texture2D(uTex2, coverUv(uv + dir * amount)).r;
          float g = texture2D(uTex2, cuv).g;
          float b = texture2D(uTex2, coverUv(uv - dir * amount)).b;
          return vec4(r, g, b, 1.0);
        }

        void main() {
          float p = uProgress;
          vec2 center = vUv - 0.5;
          float radius = length(center);
          float angle = atan(center.y, center.x);
          vec2 parallax = uPointer * 0.010;
          float breathing = sin(uTime * 0.00022) * 0.004;

          float firstTransition = smoothstep(0.11, 0.43, p);
          float secondTransition = smoothstep(0.53, 0.88, p);

          float zoom0 = 1.0 + p * 0.34;
          vec2 uv0 = center / zoom0 + 0.5 + parallax + vec2(p * 0.018, -p * 0.012);
          uv0 += normalize(center + 0.0001) * sin(radius * 28.0 - p * 14.0) * p * 0.006;

          float local1 = clamp((p - 0.12) / 0.58, 0.0, 1.0);
          float zoom1 = mix(1.22, 1.02, smoothstep(0.0, 0.42, local1)) + smoothstep(0.62, 1.0, local1) * 0.24;
          vec2 uv1 = center / zoom1 + 0.5 - parallax * 0.65;
          uv1.x += sin(uv1.y * 9.0 + uTime * 0.00018) * 0.009 * (0.3 + local1);
          uv1.y += cos(uv1.x * 11.0 - uTime * 0.00014) * 0.006;

          float local2 = clamp((p - 0.54) / 0.46, 0.0, 1.0);
          float zoom2 = mix(1.34, 1.0, smoothstep(0.0, 0.78, local2));
          vec2 uv2 = center / zoom2 + 0.5 + parallax * 0.42;
          uv2 += center * breathing;

          vec4 color0 = chroma0(uv0, 0.0012 + p * 0.0035);
          vec4 color1 = chroma1(uv1, 0.0015 + abs(0.5 - local1) * 0.004);
          vec4 color2 = chroma2(uv2, 0.0010 + (1.0 - local2) * 0.003);

          float radialField = clamp(radius * 1.58 + 0.06 + sin(angle * 4.0 + p * 8.0) * 0.025, 0.0, 1.0);
          float mask1 = smoothstep(radialField - 0.10, radialField + 0.10, firstTransition);
          float diagonalField = clamp((vUv.x + (1.0 - vUv.y)) * 0.5 + sin((vUv.x + vUv.y) * 13.0) * 0.025, 0.0, 1.0);
          float mask2 = smoothstep(diagonalField - 0.11, diagonalField + 0.11, secondTransition);

          vec4 color = mix(color0, color1, mask1);
          color = mix(color, color2, mask2);

          float edge1 = 1.0 - smoothstep(0.0, 0.065, abs(firstTransition - radialField));
          float edge2 = 1.0 - smoothstep(0.0, 0.060, abs(secondTransition - diagonalField));
          color.rgb += vec3(0.10, 0.55, 0.72) * (edge1 * 0.32 + edge2 * 0.42);
          color.rgb *= 0.76 + (1.0 - smoothstep(0.16, 0.82, radius)) * 0.22;
          color.rgb = pow(color.rgb, vec3(0.94));
          gl_FragColor = vec4(color.rgb, 1.0);
        }
      `;

      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      sceneProgram = gl.createProgram();
      gl.attachShader(sceneProgram, vertexShader);
      gl.attachShader(sceneProgram, fragmentShader);
      gl.linkProgram(sceneProgram);
      if (!gl.getProgramParameter(sceneProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(sceneProgram));
      gl.useProgram(sceneProgram);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(sceneProgram, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      sceneUniforms = {
        resolution: gl.getUniformLocation(sceneProgram, 'uResolution'),
        pointer: gl.getUniformLocation(sceneProgram, 'uPointer'),
        progress: gl.getUniformLocation(sceneProgram, 'uProgress'),
        time: gl.getUniformLocation(sceneProgram, 'uTime')
      };

      const textureUrls = [
        'images/generated/4in1-neural-core.png',
        'images/generated/4in1-biodigital-field.png',
        'images/generated/4in1-convergence.png'
      ];
      textureUrls.forEach((url, index) => {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([2, 8, 23, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.uniform1i(gl.getUniformLocation(sceneProgram, `uTex${index}`), index);
        const image = new Image();
        image.onload = () => {
          gl.activeTexture(gl.TEXTURE0 + index);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        };
        image.src = url;
      });
    } catch (error) {
      console.warn('WebGL scene fallback active', error);
      sceneProgram = null;
    }
  };

  const makeParticle = (index) => ({
    x: Math.random(), y: Math.random(), z: .25 + Math.random() * .75,
    radius: .4 + Math.random() * 1.4, speed: .00008 + Math.random() * .00018,
    drift: (Math.random() - .5) * .00007, green: index % 11 === 0
  });

  const resizeCanvases = () => {
    particleRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    particleWidth = window.innerWidth;
    particleHeight = window.innerHeight;
    [sceneCanvas, particleCanvas].forEach((canvas) => {
      canvas.width = Math.round(particleWidth * particleRatio);
      canvas.height = Math.round(particleHeight * particleRatio);
      canvas.style.width = `${particleWidth}px`;
      canvas.style.height = `${particleHeight}px`;
    });
    if (gl) gl.viewport(0, 0, sceneCanvas.width, sceneCanvas.height);
    particleContext.setTransform(particleRatio, 0, 0, particleRatio, 0, 0);
    particles = Array.from({ length: particleWidth < 720 ? 34 : 68 }, (_, index) => makeParticle(index));
  };

  const renderParticles = () => {
    particleContext.clearRect(0, 0, particleWidth, particleHeight);
    const flow = .35 + smoothProgress * 1.4;
    particles.forEach((particle) => {
      particle.x += particle.speed * flow;
      particle.y += particle.drift;
      if (particle.x > 1.04) particle.x = -.04;
      if (particle.y > 1.04) particle.y = -.04;
      if (particle.y < -.04) particle.y = 1.04;
      const x = particle.x * particleWidth;
      const y = particle.y * particleHeight;
      const alpha = .12 + particle.z * .38;
      particleContext.beginPath();
      particleContext.fillStyle = particle.green ? `rgba(97,255,184,${alpha})` : `rgba(129,225,255,${alpha})`;
      particleContext.shadowBlur = 10 * particle.z;
      particleContext.shadowColor = particle.green ? '#56ffb5' : '#3e9cff';
      particleContext.arc(x, y, particle.radius * particle.z, 0, Math.PI * 2);
      particleContext.fill();
    });
    particleContext.shadowBlur = 0;
  };

  const render = (time) => {
    smoothProgress += (cinematicProgress - smoothProgress) * .075;
    if (gl && sceneProgram) {
      gl.useProgram(sceneProgram);
      gl.uniform2f(sceneUniforms.resolution, sceneCanvas.width, sceneCanvas.height);
      gl.uniform2f(sceneUniforms.pointer, pointerX, pointerY);
      gl.uniform1f(sceneUniforms.progress, smoothProgress);
      gl.uniform1f(sceneUniforms.time, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    renderParticles();
    requestAnimationFrame(render);
  };

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', () => { resizeCanvases(); updateScroll(); });
  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX / window.innerWidth - .5;
    pointerY = .5 - event.clientY / window.innerHeight;
    if (glow) { glow.style.left = `${event.clientX}px`; glow.style.top = `${event.clientY}px`; }
  }, { passive: true });

  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }), { threshold: 0.14 });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  const projectObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.play().catch(() => {}); else entry.target.pause();
  }), { threshold: 0.35 });
  document.querySelectorAll('.project-card video').forEach((video) => projectObserver.observe(video));

  const toast = document.querySelector('.toast');
  let toastTimer;
  document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => {
    toast.querySelector('span').textContent = button.dataset.toast;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }));

  initWebGL();
  resizeCanvases();
  updateScroll();
  requestAnimationFrame(render);
})();
