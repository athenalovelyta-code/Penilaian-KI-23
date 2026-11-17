// API Client & Utility Functions for KI23 Evaluation System

const API = {
  baseUrl: '',
  activeRequests: 0,

  beginRequestFeedback(method, endpoint) {
    if (typeof document === 'undefined' || !document.body) return () => {};

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const activeElement = document.activeElement;
    const control = isMutation
      ? activeElement?.closest?.('button, input[type="submit"], select')
      : null;
    const wasDisabled = control ? control.disabled : false;
    const originalContent = control instanceof HTMLButtonElement && !wasDisabled
      ? control.innerHTML
      : null;

    if (control && !wasDisabled) {
      control.disabled = true;
      control.setAttribute('aria-busy', 'true');
      if (originalContent !== null) {
        control.innerHTML = `${originalContent} <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>`;
      }
    }

    let indicator = document.getElementById('api-request-status');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'api-request-status';
      indicator.className = 'api-request-status';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      indicator.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span></span>';
      document.body.appendChild(indicator);
    }

    const label = endpoint.startsWith('/api/auth/login')
      ? 'Memverifikasi...'
      : method === 'DELETE'
        ? 'Menghapus...'
        : isMutation
          ? 'Menyimpan perubahan...'
          : 'Memuat data...';
    indicator.querySelector('span').textContent = label;
    indicator.classList.add('is-visible');
    this.activeRequests += 1;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      if (control?.isConnected && !wasDisabled) {
        control.disabled = false;
        control.removeAttribute('aria-busy');
        if (originalContent !== null) control.innerHTML = originalContent;
      }
      if (this.activeRequests === 0) indicator.classList.remove('is-visible');
    };
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {};
    
    // Check if session token in localStorage
    const token = localStorage.getItem('ki23_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const releaseFeedback = this.beginRequestFeedback(method, endpoint);
    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        // Unauthorized
        console.warn('Session expired or unauthorized');
      }
      
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg = data?.detail || `Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
      }
      return data;
    } finally {
      releaseFeedback();
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }
};

// Toast notification helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
