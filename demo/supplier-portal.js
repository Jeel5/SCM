let apiBase = localStorage.getItem('demo.supplier.apiBase') || 'http://localhost:3000/api';
let bearerToken = localStorage.getItem('demo.supplier.token') || '';
let statusFilter = '';
let showClosed = true;
let searchText = '';
let orders = [];

const statusEl = document.getElementById('connectionStatus');
const apiBaseInput = document.getElementById('apiBaseInput');
const tokenInput = document.getElementById('tokenInput');
const statusFilterInput = document.getElementById('statusFilter');
const searchInput = document.getElementById('searchInput');
const showClosedInput = document.getElementById('showClosed');
const ordersContainer = document.getElementById('ordersContainer');
const countBadge = document.getElementById('countBadge');

function setConnectionStatus(message, type = 'muted') {
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
    };
}

async function connect() {
    apiBase = apiBaseInput.value.trim();
    bearerToken = tokenInput.value.trim();

    localStorage.setItem('demo.supplier.apiBase', apiBase);
    localStorage.setItem('demo.supplier.token', bearerToken);

    if (!apiBase || !bearerToken) {
        setConnectionStatus('Enter API base and token to continue.', 'err');
        return;
    }

    await loadOrders();
}

async function loadOrders() {
    if (!apiBase || !bearerToken) {
        setConnectionStatus('Not connected', 'muted');
        return;
    }

    setConnectionStatus('Loading reorders...', 'muted');

    const params = new URLSearchParams({
        limit: '100',
        include_closed: String(showClosed),
    });
    if (statusFilter) params.set('status', statusFilter);

    try {
        const response = await fetch(`${apiBase}/inventory/restock-orders?${params.toString()}`, {
            headers: authHeaders(),
        });

        const body = await response.json();
        if (!response.ok || !body.success) {
            throw new Error(body.message || `Failed (${response.status})`);
        }

        orders = Array.isArray(body.data) ? body.data : [];
        renderOrders();
        setConnectionStatus(`Connected. Loaded ${orders.length} reorder(s).`, 'ok');
    } catch (err) {
        console.error(err);
        setConnectionStatus(`Connection failed: ${err.message}`, 'err');
        orders = [];
        renderOrders();
    }
}

function applyClientFilters(list) {
    if (!searchText) return list;
    const q = searchText.toLowerCase();
    return list.filter((order) => {
        const combined = [
            order.restockNumber || '',
            order.supplierName || '',
            order.warehouseName || '',
            order.status || '',
            order.trackingNumber || '',
        ].join(' ').toLowerCase();
        return combined.includes(q);
    });
}

function formatDate(value) {
    if (!value) return 'Not set';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString();
}

function toDateInputValue(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

function statusClass(status) {
    if (!status) return '';
    return String(status).toLowerCase();
}

async function saveOrderChanges(orderId, card) {
    const statusValue = card.querySelector('.js-status').value;
    const trackingValue = card.querySelector('.js-tracking').value.trim();
    const poValue = card.querySelector('.js-po').value.trim();
    const arrivalValue = card.querySelector('.js-arrival').value;
    const saveBtn = card.querySelector('.js-save');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const response = await fetch(`${apiBase}/inventory/restock-orders/${orderId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                status: statusValue,
                tracking_number: trackingValue || null,
                supplier_po_number: poValue || null,
                expected_arrival: arrivalValue ? new Date(arrivalValue).toISOString() : null,
            }),
        });

        const body = await response.json();
        if (!response.ok || !body.success) {
            throw new Error(body.message || `Failed (${response.status})`);
        }

        setConnectionStatus(`Reorder updated: ${body.data.restock_number || orderId}`, 'ok');
        await loadOrders();
    } catch (err) {
        console.error(err);
        setConnectionStatus(`Update failed: ${err.message}`, 'err');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

function renderOrders() {
    const filtered = applyClientFilters(orders);
    countBadge.textContent = `${filtered.length} reorder(s)`;

    if (!filtered.length) {
        ordersContainer.innerHTML = '<div class="empty">No reorders match your filters.</div>';
        return;
    }

    const template = document.getElementById('orderCardTemplate');
    ordersContainer.innerHTML = '';

    filtered.forEach((order) => {
        const fragment = template.content.cloneNode(true);
        const card = fragment.querySelector('.order-card');

        fragment.querySelector('.order-title').textContent = order.restockNumber || order.id.slice(0, 8);
        fragment.querySelector('.order-subtitle').textContent = `${order.supplierName} -> ${order.warehouseName}`;

        const pill = fragment.querySelector('.status-pill');
        pill.textContent = String(order.status || 'unknown').replaceAll('_', ' ');
        pill.classList.add(statusClass(order.status));

        fragment.querySelector('.js-requested').textContent = formatDate(order.requestedAt);
        fragment.querySelector('.js-quantity').textContent = `${order.totalQuantity || 0} units`;
        fragment.querySelector('.js-amount').textContent = `INR ${Number(order.totalAmount || 0).toFixed(2)}`;
        fragment.querySelector('.js-expected').textContent = formatDate(order.expectedArrival);

        fragment.querySelector('.js-status').value = order.status || 'draft';
        fragment.querySelector('.js-tracking').value = order.trackingNumber || '';
        fragment.querySelector('.js-po').value = order.supplierPoNumber || '';
        fragment.querySelector('.js-arrival').value = toDateInputValue(order.expectedArrival);

        fragment.querySelector('.js-save').addEventListener('click', () => saveOrderChanges(order.id, card));

        ordersContainer.appendChild(fragment);
    });
}

function bindEvents() {
    document.getElementById('connectBtn').addEventListener('click', connect);
    document.getElementById('refreshBtn').addEventListener('click', loadOrders);

    statusFilterInput.addEventListener('change', (e) => {
        statusFilter = e.target.value || '';
        loadOrders();
    });

    showClosedInput.addEventListener('change', (e) => {
        showClosed = e.target.value === 'true';
        loadOrders();
    });

    searchInput.addEventListener('input', (e) => {
        searchText = (e.target.value || '').trim().toLowerCase();
        renderOrders();
    });
}

function init() {
    apiBaseInput.value = apiBase;
    tokenInput.value = bearerToken;
    statusFilterInput.value = statusFilter;
    showClosedInput.value = String(showClosed);

    bindEvents();
    if (bearerToken) {
        loadOrders();
    }
}

init();
