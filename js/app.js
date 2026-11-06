// Configuración de Supabase y constantes del Restaurante Sabor Chiquitano
const SUPABASE_URL = "https://nwmpdobfuunorromkhoz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bXBkb2JmdXVub3Jyb21raG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTc3MzQsImV4cCI6MjEwOTMzMzczNH0.06X1AC1_TEsn5zSWwj-MVUBp2LIUKt7xOmLqnH5HQY0";
const TELEFONO_WHATSAPP = "59177852598";
const IMAGE_BUCKET = 'rest-images';
const CART_STORAGE_KEY = 'sabor-chiquitano-cart';

const PAGE_IMAGE_PATHS = {
  'about-room': 'site/about-dish-image',
  'about-gallery': 'site/about-restaurant-image'
};
const PAGE_IMAGE_FALLBACKS = {
  'about-room': 'Imagenes/majadito.jpeg',
  'about-gallery': 'Imagenes/lugar.webp'
};

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let platosData = [];
let testimoniosData = [];
let heroSlides = [];
let currentHeroIndex = 0;
let carouselInterval = null;
let currentFilter = 'todos';
let isAdminLoggedIn = false;
let cartItems = loadCart();

function loadCart() {
  try {
    const storedItems = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(storedItems)) return [];
    return storedItems.filter(item => item && item.id != null && item.name && Number.isFinite(Number(item.price)) && Number(item.price) >= 0)
      .map(item => ({
        id: String(item.id),
        name: String(item.name),
        price: Number(item.price),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
      }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch {
    showToast('No se pudo guardar el carrito en este dispositivo.');
  }
}

function formatPrice(value) {
  return Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// --- MODO OSCURO / CLARO ---
function setupThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
      showToast(`Modo ${newTheme === 'dark' ? 'Oscuro' : 'Claro'} activado`);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.className = 'fa-solid fa-sun';
    icon.style.color = '#f59e0b';
  } else {
    icon.className = 'fa-solid fa-moon';
    icon.style.color = '#c85a32';
  }
}

// --- MENÚ MÓVIL ---
function setupMobileMenu() {
  const toggleBtn = document.getElementById('menuToggleBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener('click', toggleMobileMenu);
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => { mobileMenu.hidden = true; toggleBtn.setAttribute('aria-expanded', 'false'); });
    });
  }
}

function toggleMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  if (!mobileMenu) return;
  mobileMenu.hidden = !mobileMenu.hidden;
  document.getElementById('menuToggleBtn')?.setAttribute('aria-expanded', String(!mobileMenu.hidden));
}

// --- CARRUSEL DINÁMICO HERO ---
async function loadHeroCarousel() {
  try {
    const { data: files, error } = await supabaseClient.storage.from(IMAGE_BUCKET).list('hero-carousel');
    if (error || !files || files.filter(f => f.name && !f.name.startsWith('.')).length === 0) {
      heroSlides = ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop'];
    } else {
      heroSlides = files.filter(f => f.name && !f.name.startsWith('.')).map(file => {
        const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(`hero-carousel/${file.name}`);
        return `${data.publicUrl}?v=${Date.now()}`;
      });
    }
  } catch (e) {
    heroSlides = ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop'];
  }
  currentHeroIndex = Math.min(currentHeroIndex, heroSlides.length - 1);
  renderHeroCarousel();
}

function renderHeroCarousel() {
  const track = document.getElementById('heroCarouselTrack');
  const dots = document.getElementById('heroCarouselDots');
  if (!track || !dots) return;

  track.innerHTML = heroSlides.map((url, i) => `
    <div class="hero-slide ${i === currentHeroIndex ? 'active' : ''}" style="background-image: url('${url}');"></div>
  `).join('');

  dots.innerHTML = heroSlides.map((_, i) => `
    <button class="carousel-dot ${i === currentHeroIndex ? 'active' : ''}" onclick="goToHeroSlide(${i})" aria-label="Ir a foto ${i+1}" type="button"></button>
  `).join('');

  resetCarouselTimer();
}

function updateHeroActive() {
  document.querySelectorAll('#heroCarouselTrack .hero-slide').forEach((s, i) => s.classList.toggle('active', i === currentHeroIndex));
  document.querySelectorAll('#heroCarouselDots .carousel-dot').forEach((d, i) => d.classList.toggle('active', i === currentHeroIndex));
  resetCarouselTimer();
}

function moveHeroSlide(direction) {
  currentHeroIndex = (currentHeroIndex + direction + heroSlides.length) % heroSlides.length;
  updateHeroActive();
}

function goToHeroSlide(index) {
  currentHeroIndex = index;
  updateHeroActive();
}

function resetCarouselTimer() {
  if (carouselInterval) clearInterval(carouselInterval);
  carouselInterval = setInterval(() => {
    if (heroSlides.length > 1) {
      currentHeroIndex = (currentHeroIndex + 1) % heroSlides.length;
      updateHeroActive();
    }
  }, 5000);
}

function setupHeroCarouselAdmin() {
  document.getElementById('btn-add-hero-slide')?.addEventListener('click', () => {
    if (!isAdminLoggedIn) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (file) {
        showToast('Subiendo foto al carrusel...');
        const path = `hero-carousel/slide_${Date.now()}`;
        const { error } = await supabaseClient.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) {
          showToast(`Error al subir imagen: ${error.message}`);
        } else {
          showToast('Foto añadida al carrusel');
          await loadHeroCarousel();
        }
      }
    });
    input.click();
  });

  document.getElementById('btn-delete-hero-slide')?.addEventListener('click', async () => {
    if (!isAdminLoggedIn || heroSlides.length <= 1) {
      showToast('No se puede eliminar la única foto del carrusel.');
      return;
    }
    const currentUrl = heroSlides[currentHeroIndex];
    const path = currentUrl.split('/hero-carousel/')[1]?.split('?')[0];
    if (path) {
      const { error } = await supabaseClient.storage.from(IMAGE_BUCKET).remove([`hero-carousel/${path}`]);
      if (error) {
        showToast(`Error al eliminar: ${error.message}`);
      } else {
        showToast('Foto eliminada del carrusel');
        currentHeroIndex = 0;
        await loadHeroCarousel();
      }
    }
  });
}

// --- PLATOS Y SUPABASE ---
async function fetchPlatos() {
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    // Apuntando limpiamente a la tabla 'platos'
    const { data, error } = await supabaseClient.from('platos').select('*').order('id', { ascending: true });
    if (error) throw error;
    platosData = data || [];
    if (loadingEl) loadingEl.style.display = 'none';
    renderPlatos();
  } catch (err) {
    console.error("Error al obtener platos de Supabase:", err);
    if (loadingEl) {
      loadingEl.innerHTML = `<p style="color:#ef4444; font-size:13px;">Error al obtener el menú.</p>`;
    }
  }
}

function renderPlatos() {
  const grid = document.getElementById('platosGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtrados = platosData.filter(item => {
    const cat = (item.tipo || '').toLowerCase();
    if (currentFilter === 'todos') return true;
    return cat.includes(currentFilter);
  });

  if (filtrados.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; padding:40px 0; text-align:center; color:var(--text-muted);">No se encontraron platos en esta categoría.</div>`;
    return;
  }

  filtrados.forEach(item => {
    const estado = (item.estado || 'disponible').toLowerCase();
    const isAvailable = estado === 'disponible';
    const imagen = (item.imagen_url || '').trim() || 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop';
    
    const card = document.createElement('div');
    card.className = "room-card";
    card.innerHTML = `
      <div>
        <div class="room-media">
          <img loading="lazy" src="${escapeHtml(imagen)}" alt="${escapeHtml(item.nombre)}">
          ${isAdminLoggedIn ? `<button class="image-edit-button room-image-edit" data-image-key="dish:${item.id}" type="button" title="Cambiar foto del plato"><i class="fa-solid fa-camera"></i></button>` : ''}
          <span class="room-badge" style="${isAvailable ? 'background:#10b98122; color:#10b981; border:1px solid #10b98155;' : 'background:#ef444422; color:#ef4444; border:1px solid #ef444455;'}">${isAvailable ? 'Disponible' : 'Agotado'}</span>
        </div>

        <div class="room-body">
          <div class="room-header-row">
            <h4 class="room-title brand-font">${escapeHtml(item.nombre)}</h4>
            <div class="room-price">Bs. ${escapeHtml(item.precio)}</div>
          </div>
          <p class="room-desc">${escapeHtml(item.descripcion || 'Plato típico elaborado con ingredientes frescos y sazón chiquitana.')}</p>

          ${isAdminLoggedIn ? `
            <div class="room-admin-actions">
              <button class="btn btn-secondary" type="button" data-edit-dish="${item.id}"><i class="fa-solid fa-pen"></i> Editar</button>
              <button class="btn btn-danger" type="button" data-delete-dish="${item.id}"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="padding: 0 24px 24px;">
        <button data-add-to-cart="${escapeHtml(item.id)}" class="btn btn-whatsapp" style="width:100%;" ${isAvailable ? '' : 'disabled'} type="button">
          <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> Añadir al carrito
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// --- TESTIMONIOS Y RESEÑAS ---
async function fetchTestimonials() {
  try {
    const { data, error } = await supabaseClient.from('testimonios').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    testimoniosData = data || [];
    renderTestimonials();
    renderPendingTestimonials();
  } catch (error) {
    console.error('Error al cargar testimonios:', error);
  }
}

function renderTestimonials() {
  const grid = document.getElementById('testimonialsGrid');
  if (!grid) return;
  const published = testimoniosData.filter(r => r.publicado);
  grid.innerHTML = published.length
    ? published.map(r => `
      <article class="testimonial-card">
        <div>
          <div class="stars">${'★'.repeat(r.calificacion)}${'☆'.repeat(5-r.calificacion)}</div>
          <p class="testimonial-text">“${escapeHtml(r.comentario)}”</p>
        </div>
        <div class="testimonial-author-row">
          <strong class="author-name">${escapeHtml(r.nombre)}</strong>
          ${r.contexto ? `<span class="author-sub">${escapeHtml(r.contexto)}</span>` : ''}
        </div>
      </article>
    `).join('')
    : '<p class="empty-testimonials">Aún no hay reseñas publicadas.</p>';
}

// --- ACCIONES ADMIN & LOGIN ---
function setupAdminEvents() {
  const modalAdmin = document.getElementById('modal-admin');
  const btnAdminLogin = document.getElementById('btn-admin-login');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  btnAdminLogin?.addEventListener('click', () => {
    modalAdmin.classList.add('active');
    document.getElementById('admin-auth-error').style.display = 'none';
    document.getElementById('admin-email-input').focus();
  });

  document.getElementById('btn-close-modal')?.addEventListener('click', () => modalAdmin.classList.remove('active'));

  document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email-input').value.trim();
    const password = document.getElementById('admin-password-input').value;
    const authError = document.getElementById('admin-auth-error');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Verificar si está en la tabla de admins
      const { data: admin, error: adminError } = await supabaseClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (adminError || !admin) {
        await supabaseClient.auth.signOut();
        throw new Error('Esta cuenta no tiene permisos de administrador.');
      }

      isAdminLoggedIn = true;
      modalAdmin.classList.remove('active');
      document.getElementById('badge-admin-session').style.display = 'inline-flex';
      btnAdminLogin.style.display = 'none';
      setImageEditControls(true);
      renderPlatos();
      renderPendingTestimonials();
      showToast('Sesión de administrador iniciada');
    } catch (err) {
      if (authError) { 
        authError.textContent = err.message || 'Error al iniciar sesión.'; 
        authError.style.display = 'block'; 
      }
    }
  });

  btnAdminLogout?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    isAdminLoggedIn = false;
    document.getElementById('badge-admin-session').style.display = 'none';
    btnAdminLogin.style.display = '';
    setImageEditControls(false);
    renderPlatos();
    renderPendingTestimonials();
    showToast("Sesión cerrada");
  });
}

async function restoreAdminSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return;

  const { data: admin } = await supabaseClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', data.session.user.id)
    .maybeSingle();

  if (admin) {
    isAdminLoggedIn = true;
    document.getElementById('btn-admin-login').style.display = 'none';
    document.getElementById('badge-admin-session').style.display = 'inline-flex';
    setImageEditControls(true);
    renderPlatos();
    renderPendingTestimonials();
  }
}

function setImageEditControls(visible) {
  document.querySelectorAll('.admin-only-control, .editable-image-frame .image-edit-button').forEach(b => b.hidden = !visible);
  const carouselControls = document.getElementById('carousel-admin-controls');
  if (carouselControls) carouselControls.hidden = !visible;
}

// --- SUBIDA DE IMÁGENES ---
function setupImageUploads() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-image-key]');
    if (!button || !isAdminLoggedIn) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (file) {
        const key = button.dataset.imageKey;
        if (PAGE_IMAGE_PATHS[key]) {
          const { error } = await supabaseClient.storage.from(IMAGE_BUCKET).upload(PAGE_IMAGE_PATHS[key], file, { upsert: true });
          if (error) return showToast(`Error al subir imagen: ${error.message}`);
          loadPageImages();
          showToast('Imagen actualizada');
        } else if (key.startsWith('dish:')) {
          const dishId = key.split(':')[1];
          const path = `dishes/${dishId}/image`;
          await supabaseClient.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: true });
          const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(path);
          const url = `${data.publicUrl}?v=${Date.now()}`;
          await supabaseClient.from('platos').update({ imagen_url: url }).eq('id', dishId);
          await fetchPlatos();
          showToast('Imagen del plato actualizada');
        }
      }
    });
    input.click();
  });
}

// --- FILTROS Y WHATSAPP ---
function setupFiltros() {
  document.getElementById('filtrosContenedor')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPlatos();
  });
}

function localISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openWhatsappModal(dishName = "Reserva de Mesa") {
  const modal = document.getElementById('whatsappModal');
  const roomInput = document.getElementById('modalRoom');
  if (roomInput) roomInput.value = dishName;

  const hoy = localISODate();
  const checkIn = document.getElementById('modalCheckIn');
  if (checkIn && !checkIn.value) { checkIn.value = hoy; checkIn.min = hoy; }

  if (modal) { modal.classList.add('active'); setTimeout(() => document.getElementById('modalName')?.focus(), 50); }
}

function closeWhatsappModal() {
  document.getElementById('whatsappModal')?.classList.remove('active');
}

function addToCart(dish) {
  const existing = cartItems.find(item => item.id === String(dish.id));
  if (existing) {
    existing.quantity += 1;
  } else {
    cartItems.push({ id: String(dish.id), name: dish.nombre, price: Number(dish.precio) || 0, quantity: 1 });
  }
  saveCart();
  renderCart();
  showToast(`${dish.nombre} añadido al carrito`);
}

function renderCart() {
  const list = document.getElementById('cartItems');
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const countBadge = document.getElementById('cartCount');
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (countBadge) {
    countBadge.textContent = String(count);
    countBadge.hidden = count === 0;
  }
  document.getElementById('cartToggleBtn')?.setAttribute('aria-label', `Abrir carrito, ${count} ${count === 1 ? 'producto' : 'productos'}`);
  document.getElementById('cartSubtotal').textContent = `Bs. ${formatPrice(total)}`;
  document.getElementById('cartCheckoutBtn').disabled = cartItems.length === 0;
  document.getElementById('cartClearBtn').disabled = cartItems.length === 0;

  if (!list) return;
  if (!cartItems.length) {
    list.innerHTML = '<p class="cart-empty">Tu carrito está vacío. Añade platos del menú para empezar.</p>';
    return;
  }

  list.innerHTML = cartItems.map(item => `
    <article class="cart-item">
      <div class="cart-item-info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>Bs. ${formatPrice(item.price)} c/u</span>
        <strong class="cart-item-total">Bs. ${formatPrice(item.price * item.quantity)}</strong>
      </div>
      <div class="cart-item-controls" aria-label="Cantidad de ${escapeHtml(item.name)}">
        <button class="cart-quantity-btn" type="button" data-cart-decrease="${escapeHtml(item.id)}" aria-label="Quitar una unidad de ${escapeHtml(item.name)}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
        <span>${item.quantity}</span>
        <button class="cart-quantity-btn" type="button" data-cart-increase="${escapeHtml(item.id)}" aria-label="Añadir una unidad de ${escapeHtml(item.name)}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
        <button class="cart-remove-btn" type="button" data-cart-remove="${escapeHtml(item.id)}" aria-label="Eliminar ${escapeHtml(item.name)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>
    </article>
  `).join('');
}

function openCart() {
  const modal = document.getElementById('cartModal');
  if (!modal) return;
  renderCart();
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.querySelector('[data-close-modal="cartModal"]')?.focus();
}

function setupCart() {
  renderCart();
  document.getElementById('cartToggleBtn')?.addEventListener('click', openCart);
  document.getElementById('platosGrid')?.addEventListener('click', event => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    const dish = platosData.find(item => String(item.id) === button.dataset.addToCart);
    if (dish) addToCart(dish);
  });
  document.getElementById('cartItems')?.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-increase], [data-cart-decrease], [data-cart-remove]');
    if (!button) return;
    const item = cartItems.find(entry => entry.id === (button.dataset.cartIncrease || button.dataset.cartDecrease || button.dataset.cartRemove));
    if (!item) return;
    if (button.dataset.cartRemove || button.dataset.cartDecrease && item.quantity === 1) {
      cartItems = cartItems.filter(entry => entry !== item);
    } else if (button.dataset.cartIncrease) {
      item.quantity += 1;
    } else {
      item.quantity -= 1;
    }
    saveCart();
    renderCart();
  });
  document.getElementById('cartClearBtn')?.addEventListener('click', () => {
    cartItems = [];
    saveCart();
    renderCart();
  });
  document.getElementById('cartCheckoutForm')?.addEventListener('submit', event => {
    event.preventDefault();
    if (!cartItems.length) return;
    const name = document.getElementById('cartCustomerName').value.trim();
    const note = document.getElementById('cartOrderNote').value.trim();
    let text = '*PEDIDO - SABOR CHIQUITANO*\n\n';
    if (name) text += `*Nombre:* ${name}\n`;
    text += '\n*Productos:*\n';
    cartItems.forEach(item => {
      text += `- ${item.quantity} x ${item.name} — Bs. ${formatPrice(item.price * item.quantity)}\n`;
    });
    text += `\n*Subtotal:* Bs. ${formatPrice(cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}\n`;
    if (note) text += `\n*Nota:* ${note}\n`;
    window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });
}

function sendWhatsappMessage(event) {
  event.preventDefault();
  const name = document.getElementById('reservationName').value.trim();
  const phone = document.getElementById('reservationPhone').value.trim();
  const date = document.getElementById('reservationDate').value;
  const time = document.getElementById('reservationTime').value;
  const msg = document.getElementById('reservationMessage').value.trim();

  let text = `*NUEVA RESERVA DE MESA - SABOR CHIQUITANO*\n\n`;
  text += `👤 *Nombre:* ${name}\n`;
  if (phone) text += `📞 *Teléfono:* ${phone}\n`;
  text += `📅 *Fecha:* ${date}\n`;
  text += `⏰ *Hora:* ${time}\n`;
  if (msg) text += `📝 *Nota:* ${msg}\n`;

  window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
}

function sendWhatsappModalMessage(event) {
  event.preventDefault();
  const name = document.getElementById('modalName').value.trim();
  const dish = document.getElementById('modalRoom').value.trim();
  const date = document.getElementById('modalCheckIn').value;
  const time = document.getElementById('modalCheckOut').value;
  const people = document.getElementById('modalHuespedes').value;
  const msg = document.getElementById('modalMessage').value.trim();

  let text = `*CONSULTA / RESERVA DE MESA - SABOR CHIQUITANO*\n\n`;
  text += `👤 *Nombre:* ${name}\n`;
  text += `🍽 *Plato / Consulta:* ${dish}\n`;
  text += `📅 *Fecha:* ${date}\n`;
  text += `⏰ *Hora:* ${time}\n`;
  text += `👥 *Personas:* ${people}\n`;
  if (msg) text += `📝 *Mensaje:* ${msg}\n`;

  window.open(`https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
  closeWhatsappModal();
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = "toast-msg show";
  toast.setAttribute('role', 'status');
  toast.innerHTML = '<i class="fa-solid fa-circle-info" style="color:var(--accent)"></i> <span></span>';
  toast.querySelector('span').textContent = msg;
  toast.classList.remove('show');
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 260); }, 3000);
}

// --- MODALES: cerrar con Escape, fondo o botón ---
function setupModalClosers() {
  document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close-modal]');
    if (closer) {
      const modal = document.getElementById(closer.dataset.closeModal);
      modal?.classList.remove('active');
      modal?.setAttribute('aria-hidden', 'true');
    }
    if (e.target.classList?.contains('modal-overlay')) {
      e.target.classList.remove('active');
      e.target.setAttribute('aria-hidden', 'true');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      m.classList.remove('active');
      m.setAttribute('aria-hidden', 'true');
    });
    const menu = document.getElementById('mobileMenu');
    if (menu && !menu.hidden) toggleMobileMenu();
  });
}

// --- IMÁGENES EDITABLES DE LA SECCIÓN "EL RESTAURANTE" ---
async function loadPageImages() {
  const { data: files, error } = await supabaseClient.storage.from(IMAGE_BUCKET).list('site');
  const availablePaths = new Set(error ? [] : (files || []).map(file => `site/${file.name}`));

  Object.entries(PAGE_IMAGE_PATHS).forEach(([key, path]) => {
    const img = document.getElementById(`image-${key}`);
    if (!img) return;
    img.onload = () => { img.hidden = false; };
    img.onerror = () => {
      img.onerror = null;
      img.src = PAGE_IMAGE_FALLBACKS[key];
    };
    if (!availablePaths.has(path)) {
      img.src = PAGE_IMAGE_FALLBACKS[key];
      return;
    }
    const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    img.src = `${data.publicUrl}?v=${Date.now()}`;
  });
}

// --- CRUD DE PLATOS (admin) ---
function setupDishAdmin() {
  const modal = document.getElementById('dish-modal');
  const form = document.getElementById('dish-form');
  const field = id => document.getElementById(id);
  const openDish = dish => {
    field('dish-modal-title').textContent = dish ? 'Editar plato' : 'Añadir plato';
    field('dish-id').value = dish?.id ?? '';
    field('dish-name').value = dish?.nombre ?? '';
    field('dish-category').value = dish?.tipo ?? 'tipicas';
    field('dish-price').value = dish?.precio ?? '';
    field('dish-status').value = dish?.estado ?? 'disponible';
    field('dish-description').value = dish?.descripcion ?? '';
    modal.classList.add('active');
    field('dish-name').focus();
  };
  document.getElementById('btn-add-dish')?.addEventListener('click', () => openDish(null));
  document.getElementById('platosGrid')?.addEventListener('click', async e => {
    if (!isAdminLoggedIn) return;
    const edit = e.target.closest('[data-edit-dish]');
    const del = e.target.closest('[data-delete-dish]');
    if (edit) openDish(platosData.find(p => String(p.id) === edit.dataset.editDish));
    if (del && confirm('¿Eliminar este plato definitivamente?')) {
      const { error } = await supabaseClient.from('platos').delete().eq('id', del.dataset.deleteDish);
      showToast(error ? `Error al eliminar: ${error.message}` : 'Plato eliminado');
      if (!error) fetchPlatos();
    }
  });
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const id = field('dish-id').value;
    const row = {
      nombre: field('dish-name').value.trim(),
      tipo: field('dish-category').value,
      precio: Number(field('dish-price').value),
      estado: field('dish-status').value,
      descripcion: field('dish-description').value.trim()
    };
    const q = supabaseClient.from('platos');
    const { error } = id ? await q.update(row).eq('id', id) : await q.insert(row);
    if (error) return showToast(`Error al guardar: ${error.message}`);
    modal.classList.remove('active');
    showToast('Plato guardado');
    fetchPlatos();
  });
}

// --- RESEÑAS: envío de invitados y moderación (admin) ---
function setupReviews() {
  const status = document.getElementById('guest-review-status');
  document.getElementById('guest-review-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const { error } = await supabaseClient.from('testimonios').insert({
      nombre: f.nombre.value.trim(), contexto: f.contexto.value.trim(),
      calificacion: Number(f.calificacion.value), comentario: f.comentario.value.trim(), publicado: false
    });
    status.textContent = error ? 'No se pudo enviar. Inténtalo de nuevo.' : '¡Gracias! Tu reseña será publicada tras ser revisada.';
    if (!error) f.reset();
  });

  const tModal = document.getElementById('testimonial-modal');
  document.getElementById('btn-add-testimonial')?.addEventListener('click', () => {
    document.getElementById('testimonial-form').reset();
    document.getElementById('testimonial-id').value = '';
    tModal.classList.add('active');
    document.getElementById('testimonial-name').focus();
  });
  document.getElementById('testimonial-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!isAdminLoggedIn) return;
    const g = id => document.getElementById(id);
    const { error } = await supabaseClient.from('testimonios').insert({
      nombre: g('testimonial-name').value.trim(), contexto: g('testimonial-context').value.trim(),
      calificacion: Number(g('testimonial-rating').value), comentario: g('testimonial-comment').value.trim(),
      publicado: g('testimonial-published').checked
    });
    if (error) return showToast(`Error al guardar: ${error.message}`);
    tModal.classList.remove('active');
    showToast('Reseña guardada');
    fetchTestimonials();
  });

  document.getElementById('pendingTestimonials')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-review-action]');
    if (!btn || !isAdminLoggedIn) return;
    const t = supabaseClient.from('testimonios');
    const { error } = btn.dataset.reviewAction === 'publish'
      ? await t.update({ publicado: true }).eq('id', btn.dataset.id)
      : await t.delete().eq('id', btn.dataset.id);
    if (error) return showToast(`Error: ${error.message}`);
    fetchTestimonials();
  });
}

function renderPendingTestimonials() {
  const box = document.getElementById('pendingTestimonials');
  if (!box) return;
  const pending = isAdminLoggedIn ? testimoniosData.filter(r => !r.publicado) : [];
  box.hidden = pending.length === 0;
  box.innerHTML = pending.map(r => `
    <div class="pending-item">
      <span><strong>${escapeHtml(r.nombre)}</strong> (${'★'.repeat(r.calificacion)}) — ${escapeHtml(r.comentario)}</span>
      <div class="room-admin-actions">
        <button class="btn btn-primary" type="button" data-review-action="publish" data-id="${r.id}">Publicar</button>
        <button class="btn btn-danger" type="button" data-review-action="delete" data-id="${r.id}">Eliminar</button>
      </div>
    </div>`).join('');
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupMobileMenu();
  loadHeroCarousel();
  setupHeroCarouselAdmin();
  fetchPlatos();
  setupFiltros();
  setupAdminEvents();
  setupImageUploads();
  restoreAdminSession();
  fetchTestimonials();
  setupModalClosers();
  setupDishAdmin();
  setupCart();
  setupReviews();
  loadPageImages();
  const today = localISODate();
  document.querySelectorAll('#reservationDate').forEach(i => { i.min = today; });
});