// ── Config ────────────────────────────────────────────────────────────────────
const WEBHOOK_URL = 'https://api.kreygo.com';  // webhook-server base URL
let MIN_CENTS = 200;     // loaded from /config on startup
let MAX_TIP_CENTS = 4500;

// ── DOM ───────────────────────────────────────────────────────────────────────
const form        = document.getElementById('request-form');
const nameInput   = document.getElementById('name');
const msgInput    = document.getElementById('message');
const charCount   = document.getElementById('char-count');
const tipSlider   = document.getElementById('tip-slider');
const amountLabel = document.getElementById('amount-label');
const minLabel    = document.getElementById('min-label');
const maxLabel    = document.getElementById('max-label');
const errorMsg    = document.getElementById('error-msg');
const submitBtn   = document.getElementById('submit-btn');
const queueStatus = document.getElementById('queue-status');
const formCard    = document.getElementById('form-card');
const successCard = document.getElementById('success-card');
const successPos  = document.getElementById('success-position');

// ── Load server config (min price, slider max) ────────────────────────────────
async function loadConfig() {
  try {
    const res = await fetch(`${WEBHOOK_URL}/config`);
    const cfg = await res.json();
    MIN_CENTS = cfg.min_cents ?? MIN_CENTS;
    MAX_TIP_CENTS = cfg.max_tip_cents ?? MAX_TIP_CENTS;
  } catch (e) {
    console.warn('Could not load /config, using defaults');
  }
  const maxTotalDollars = (MIN_CENTS + MAX_TIP_CENTS) / 100;
  tipSlider.max = MAX_TIP_CENTS / 100;
  minLabel.textContent = `$${(MIN_CENTS / 100).toFixed(0)} (base)`;
  maxLabel.textContent = `$${maxTotalDollars.toFixed(0)}`;
  updateAmountLabel();
}

// ── Live char count ───────────────────────────────────────────────────────────
msgInput.addEventListener('input', () => {
  charCount.textContent = msgInput.value.length;
});

// ── Tip slider ────────────────────────────────────────────────────────────────
tipSlider.addEventListener('input', updateAmountLabel);

function updateAmountLabel() {
  const tipCents = parseInt(tipSlider.value) * 100;
  const total = MIN_CENTS + tipCents;
  amountLabel.textContent = `$${(total / 100).toFixed(2)}`;
}

// ── Queue polling ─────────────────────────────────────────────────────────────
async function fetchQueue() {
  try {
    const res = await fetch(`${WEBHOOK_URL}/queue`);
    const data = await res.json();

    const count = data.queue?.length ?? 0;
    const online = data.stream_online;
    const paused = data.paused;
    const hasCurrent = data.current;

    let statusText = '';
    if (!online) {
      statusText = '🔴 Stream is currently offline — your request will be processed when it goes live.';
    } else if (paused) {
      statusText = '⏸️ Automation is paused. Queue will resume shortly.';
    } else if (hasCurrent) {
      statusText = `▶️ A topic is being discussed now. ${count > 0 ? `${count} request${count !== 1 ? 's' : ''} ahead of you.` : 'You\'d be next!'}`;
    } else if (count === 0) {
      statusText = '✅ Queue is empty — you\'d go live immediately!';
    } else {
      statusText = `${count} request${count !== 1 ? 's' : ''} in queue ahead of you.`;
    }

    queueStatus.textContent = statusText;
    queueStatus.className = 'mb-5 text-center text-sm ' + (online ? 'text-gray-400' : 'text-yellow-500');
  } catch (e) {
    queueStatus.textContent = 'Unable to load queue status.';
  }
}

loadConfig();
fetchQueue();
setInterval(fetchQueue, 10000);

// ── Check for post-payment success redirect ───────────────────────────────────
const params = new URLSearchParams(window.location.search);
if (params.get('session_id')) {
  showSuccess();
}

function showSuccess() {
  formCard.classList.add('hidden');
  successCard.classList.remove('hidden');
  // Fetch queue to get their position
  fetch(`${WEBHOOK_URL}/queue`).then(r => r.json()).then(data => {
    const count = (data.queue?.length ?? 0) + (data.current ? 1 : 0);
    if (count === 0) {
      successPos.textContent = 'Your topic should be up next!';
    } else {
      successPos.textContent = `There ${count === 1 ? 'is' : 'are'} approximately ${count} topic${count !== 1 ? 's' : ''} ahead of yours.`;
    }
  }).catch(() => {
    successPos.textContent = 'Check the stream to see your position in the queue.';
  });
}

// ── Form submission ───────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const message = msgInput.value.trim();
  if (!message) {
    showError('Please enter a topic or question.');
    return;
  }

  const tipCents = parseInt(tipSlider.value) * 100;
  const viewerName = nameInput.value.trim() || 'Anonymous';

  submitBtn.disabled = true;
  submitBtn.textContent = 'Checking topic...';

  try {
    // Derive success/cancel URLs relative to this page's location so it
    // works whether hosted at api.kreygo.com/viewer or anywhere else.
    const pageDir = window.location.href.replace(/\/[^/]*$/, '');

    const res = await fetch(`${WEBHOOK_URL}/create-topic-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewer_name: viewerName,
        message,
        base_cents: MIN_CENTS,
        tip_cents: tipCents,
        success_url: `${pageDir}/success.html`,
        cancel_url: `${pageDir}/`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.detail || 'Something went wrong. Please try again.');
      return;
    }

    // Redirect to Stripe checkout
    window.location.href = data.checkout_url;

  } catch (err) {
    showError('Network error. Please check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit & Pay';
  }
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}
