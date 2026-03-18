const API_BASE = 'http://localhost:3000/api';
const DEFAULT_ORG_TOKEN = 'REPLACE_WITH_DEMO_WEBHOOK_TOKEN';

// ──────────── Org credentials ────────────
let selectedOrgToken = localStorage.getItem('demo.orgToken') || DEFAULT_ORG_TOKEN;
let orgName = localStorage.getItem('demo.orgName') || 'Croma';

// ──────────── State ────────────
// selectedProduct = full product object from live catalog (null if nothing selected)
let selectedProduct = null;
let estimateData   = null;
let deliveryPin    = null; // { lat, lon, city, state, postalCode, displayName }
let selectedWarehouse = null;
let mapView        = null;
let mapMarker      = null;

function normalizeDimensions(rawDimensions) {
    if (!rawDimensions) return null;

    const dims = typeof rawDimensions === 'string' ? JSON.parse(rawDimensions) : rawDimensions;
    const length = Number(dims.length ?? dims.l ?? dims.len ?? dims.length_cm);
    const width = Number(dims.width ?? dims.w ?? dims.wid ?? dims.width_cm);
    const height = Number(dims.height ?? dims.h ?? dims.ht ?? dims.depth ?? dims.height_cm ?? dims.depth_cm);

    if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
    }

    return { length, width, height, unit: 'cm' };
}

function bindOrgControls() {
    const orgTokenInput = document.getElementById('orgTokenInput');
    const orgNameInput = document.getElementById('orgNameInput');
    const orgNameDisplay = document.getElementById('orgNameDisplay');
    const connectBtn = document.getElementById('connectOrgBtn');

    orgTokenInput.value = selectedOrgToken;
    orgNameInput.value = orgName;
    orgNameDisplay.textContent = orgName;

    connectBtn.addEventListener('click', async () => {
        const newToken = orgTokenInput.value.trim();
        const newOrgName = orgNameInput.value.trim() || 'Organization';
        if (!newToken) {
            alert('Please enter a webhook token.');
            return;
        }

        selectedOrgToken = newToken;
        orgName = newOrgName;
        localStorage.setItem('demo.orgToken', selectedOrgToken);
        localStorage.setItem('demo.orgName', orgName);
        orgNameDisplay.textContent = orgName;

        await loadCatalog();
    });
}

function setOrgStatus(message, isError = false) {
    const badge = document.getElementById('orgStatusBadge');
    if (!badge) return;
    badge.textContent = message;
    badge.className = `status-badge ${isError ? '' : 'connected'}`;
    badge.style.background = isError ? '#fde2e1' : '';
    badge.style.color = isError ? '#991b1b' : '';
}

// ──────────── Load live catalog ────────────
// External platforms MUST fetch the catalog before placing orders.
// Only products with available_quantity > 0 in inventory are returned.
async function loadCatalog() {
    const grid     = document.getElementById('productsGrid');
    const loading  = document.getElementById('catalogLoading');
    const errorDiv = document.getElementById('catalogError');
    const estimateBtn = document.getElementById('getEstimateBtn');

    loading.style.display = 'block';
    grid.style.display    = 'none';
    errorDiv.style.display = 'none';
    estimateBtn.disabled   = true;

    // If token is empty or malformed from localStorage, recover gracefully.
    if (!selectedOrgToken || selectedOrgToken.length < 32) {
        selectedOrgToken = DEFAULT_ORG_TOKEN;
        localStorage.setItem('demo.orgToken', selectedOrgToken);
        document.getElementById('orgTokenInput').value = selectedOrgToken;
    }

    try {
        let res = await fetch(`${API_BASE}/webhooks/${selectedOrgToken}/catalog`);

        // Common local issue: a stale/invalid token saved in browser storage.
        if (res.status === 401 && selectedOrgToken !== DEFAULT_ORG_TOKEN) {
            selectedOrgToken = DEFAULT_ORG_TOKEN;
            localStorage.setItem('demo.orgToken', selectedOrgToken);
            document.getElementById('orgTokenInput').value = selectedOrgToken;
            res = await fetch(`${API_BASE}/webhooks/${selectedOrgToken}/catalog`);
        }

        if (!res.ok) {
            if (res.status === 401) {
                throw new Error('Invalid organization webhook token (HTTP 401). Update token and click Connect.');
            }
            throw new Error(`Catalog API returned HTTP ${res.status}`);
        }

        const { products } = await res.json();
        setOrgStatus(`🟢 Connected (${orgName})`);

        loading.style.display = 'none';

        if (!products || products.length === 0) {
            errorDiv.innerHTML =
                '<strong>No products available.</strong> Add products via the SCM MDM API ' +
                'and assign inventory in a warehouse before orders can be placed.';
            errorDiv.style.display = 'block';
            return;
        }

        grid.innerHTML = '';
        products.forEach((p, idx) => {
            const dims = p.dimensions
                ? (typeof p.dimensions === 'string' ? JSON.parse(p.dimensions) : p.dimensions)
                : null;
            const dimStr = dims
                ? `${dims.length ?? '?'}×${dims.width ?? '?'}×${dims.height ?? '?'} cm`
                : 'N/A';
            const price = p.selling_price
                ? `₹${parseFloat(p.selling_price).toLocaleString('en-IN')}`
                : 'N/A';
            const mrp = p.mrp
                ? `₹${parseFloat(p.mrp).toLocaleString('en-IN')}`
                : null;
            const stockBadge = p.stock.available <= 5
                ? `<span style="color:#c05621;font-weight:600;">⚠️ Only ${p.stock.available} left</span>`
                : `<span style="color:#047857;">✅ In Stock (${p.stock.available})</span>`;

            // Handling flags
            const flags = [];
            if (p.is_fragile)            flags.push('⚠️ Fragile');
            if (p.is_hazmat)             flags.push('☢️ Hazmat');
            if (p.is_perishable)         flags.push('🕒 Perishable');
            if (p.requires_cold_storage) flags.push('❄️ Cold Chain');
            if (p.requires_insurance)    flags.push('🛡️ Insured');

            // Tags
            const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? JSON.parse(p.tags) : []);
            const tagsHtml = tags.length
                ? `<div style="margin-top:6px;">${tags.map(t =>
                    `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:999px;padding:1px 8px;font-size:0.72em;margin:2px 2px 0 0;">${t}</span>`
                  ).join('')}</div>`
                : '';

            // GST badge
            const gstHtml = p.gst_rate != null
                ? `<span style="background:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-size:0.78em;font-weight:600;">GST ${p.gst_rate}%</span>`
                : '';

            // Warranty
            const warrantyHtml = p.warranty_period_days > 0
                ? `<br>Warranty: ${p.warranty_period_days >= 365
                    ? Math.round(p.warranty_period_days / 365) + ' yr'
                    : p.warranty_period_days + ' days'}`
                : '';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.idx = idx;
            card.innerHTML = `
                ${p.brand ? `<div style="font-size:0.78em;color:#6b7280;font-weight:500;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em;">${p.brand}</div>` : ''}
                <div class="product-name">${p.name}</div>
                <div class="product-price">${price} ${gstHtml}</div>
                ${mrp ? `<div style="font-size:0.8em;color:#6b7280;">MRP: ${mrp}</div>` : ''}
                <div class="product-details">
                    Internal: <code style="font-size:0.82em;color:#4f46e5;">${p.internal_barcode}</code>
                    ${p.manufacturer_barcode ? ` &nbsp;|&nbsp; Mfr: <code style="font-size:0.82em;">${p.manufacturer_barcode}</code>` : ''}<br>
                    ${p.country_of_origin ? `Origin: <strong>${p.country_of_origin}</strong> &nbsp;|&nbsp; ` : ''}${p.hsn_code ? `HSN: <code style="font-size:0.82em;">${p.hsn_code}</code><br>` : '<br>'}
                    Weight: ${p.weight ? p.weight + ' kg' : 'N/A'} &nbsp;|&nbsp; Dims: ${dimStr}<br>
                    ${stockBadge}
                    ${warrantyHtml}
                    ${flags.length ? `<br><span style="font-size:0.82em;">${flags.join(' &nbsp; ')}</span>` : ''}
                </div>
                ${tagsHtml}`;
            card.addEventListener('click', () => {
                document.querySelectorAll('.product-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedProduct = p;
                estimateBtn.disabled = !deliveryPin;
            });
            grid.appendChild(card);

            // Auto-select first product (estimate btn stays disabled until map pin is set)
            if (idx === 0) { card.click(); }
        });

        grid.style.display = 'grid';
    } catch (err) {
        setOrgStatus('🔴 Not Connected', true);
        loading.style.display = 'none';
        errorDiv.innerHTML = `<strong>Failed to load catalog:</strong> ${err.message}`;
        errorDiv.style.display = 'block';
    }
}

// ──────────── Delivery Map ────────────
function initMap() {
    mapView = new maplibregl.Map({
        container: 'deliveryMap',
        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: 'OpenStreetMap contributors'
                }
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [78.9629, 20.5937],
        zoom: 4.8,
        attributionControl: true
    });

    mapView.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapView.on('click', async (e) => {
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        if (mapMarker) mapMarker.remove();
        mapMarker = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(mapView);

        const locEl  = document.getElementById('selectedLocation');
        const textEl = document.getElementById('locationText');
        locEl.style.display  = 'block';
        textEl.textContent   = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E — looking up address…`;

        try {
            const r   = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const geo  = await r.json();
            const addr = geo.address || {};
            deliveryPin = {
                lat,
                lon:         lng,
                city:        addr.city || addr.town || addr.village || addr.county || '',
                state:       addr.state || '',
                postalCode:  addr.postcode || '',
                displayName: geo.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            };
        } catch (_) {
            deliveryPin = { lat, lon: lng, city: '', state: '', postalCode: '', displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
        }
        textEl.textContent = deliveryPin.displayName;
        document.getElementById('getEstimateBtn').disabled = !selectedProduct;
    });
}

// ──────────── Shipping Estimate ────────────

document.getElementById('getEstimateBtn').addEventListener('click', (e) => {
    e.preventDefault();
    getEstimate();
});

async function getEstimate() {
    if (!selectedProduct) { alert('Please select a product first'); return; }
    if (!deliveryPin)     { alert('Please click on the map to set a delivery location'); return; }

    const btn = document.getElementById('getEstimateBtn');
    if (btn.disabled) return;
    btn.disabled = true;

    const step2    = document.getElementById('step2');
    const loading  = document.getElementById('estimateLoading');
    const result   = document.getElementById('estimateResult');
    const errorDiv = document.getElementById('estimateError');

    step2.style.display    = 'block';
    loading.style.display  = 'block';
    result.style.display   = 'none';
    errorDiv.style.display = 'none';

    const product = selectedProduct;
    const quantity = Math.max(1, parseInt(document.getElementById('quantityInput').value || '1', 10));

    // Resolve fulfillment warehouse dynamically for selected SKU/quantity
    let originCoords = { lat: 20.5937, lon: 78.9629 };
    selectedWarehouse = null;
    try {
        const stockRes = await fetch(
            `${API_BASE}/webhooks/${selectedOrgToken}/catalog/check-stock?sku=${encodeURIComponent(product.sku)}&quantity=${quantity}`
        );
        if (stockRes.ok) {
            const stockData = await stockRes.json();
            if (!stockData.in_stock) {
                throw new Error(stockData.message || 'Selected SKU is out of stock for requested quantity.');
            }
            if (stockData.warehouse?.coordinates?.lat != null && stockData.warehouse?.coordinates?.lng != null) {
                originCoords = {
                    lat: Number(stockData.warehouse.coordinates.lat),
                    lon: Number(stockData.warehouse.coordinates.lng),
                };
                selectedWarehouse = stockData.warehouse;
            }
        }
    } catch (err) {
        loading.style.display = 'none';
        errorDiv.textContent = `Error: ${err.message}`;
        errorDiv.style.display = 'block';
        btn.disabled = false;
        return;
    }

    const productWeight = parseFloat(product.weight) || 0.5;
    let productDims = null;
    try {
        productDims = normalizeDimensions(product.dimensions);
    } catch {
        productDims = null;
    }

    const requestData = {
        origin:      { lat: Number(originCoords.lat), lon: Number(originCoords.lon) },
        destination: { lat: Number(deliveryPin.lat),  lon: Number(deliveryPin.lon)  },
        weightKg:    Number(productWeight)
    };

    if (productDims) {
        requestData.dimensions = productDims;
    }

    try {
        const response = await fetch(`${API_BASE}/shipping/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        estimateData = data;

        document.getElementById('requestData').textContent  = JSON.stringify(requestData, null, 2);
        document.getElementById('responseData').textContent = JSON.stringify(data, null, 2);

        const cost            = data.data?.estimatedCost  || data.estimatedCost  || 0;
        const minCost         = data.data?.minCost        || data.minCost        || 0;
        const maxCost         = data.data?.maxCost        || data.maxCost        || 0;
        const distance        = data.data?.distance       || data.distance;
        const estimatedDays   = data.data?.estimatedDays  || data.estimatedDays;
        const routingEngine   = data.data?.routingEngine  || data.routingEngine;
        const routingMethod   = data.data?.routingMethod  || data.routingMethod;
        const volumetricWeight= data.data?.volumetricWeight || data.volumetricWeight;

        document.getElementById('estimatePrice').textContent = `₹${cost}`;

        let rangeText = `Range: ₹${minCost} – ₹${maxCost}`;
        if (distance) rangeText += ` | Distance: ${Math.round(distance)}km`;
        if (estimatedDays) rangeText += ` | ${estimatedDays} days`;
        if (routingEngine && routingMethod) {
            rangeText += ` | via ${routingEngine === 'osrm' ? 'OSRM' : 'Pincode'}`;
            if (routingMethod === 'haversine_fallback') rangeText += ' (fallback)';
        }
        if (volumetricWeight && volumetricWeight > productWeight) {
            rangeText += ` | Volumetric: ${volumetricWeight.toFixed(2)}kg`;
        }
        if (selectedWarehouse?.name) {
            rangeText += ` | Origin: ${selectedWarehouse.name}`;
        }
        document.getElementById('estimateRange').textContent = rangeText;

        loading.style.display = 'none';
        result.style.display  = 'block';
    } catch (err) {
        loading.style.display  = 'none';
        errorDiv.textContent   = `Error: ${err.message}. Make sure backend is running on port 3000.`;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
    }
}

// ──────────── Place Order (Webhook) ────────────
// Uses real SKU from catalog — backend will reject if SKU is not in
// the products table with available inventory (no bypass).

document.getElementById('placeOrderBtn').addEventListener('click', (e) => {
    e.preventDefault();
    placeOrder();
});

async function placeOrder() {
    if (!selectedProduct) { alert('Please select a product first'); return; }

    // Pre-order stock check before payment
    try {
        const quantity = Math.max(1, parseInt(document.getElementById('quantityInput').value || '1', 10));
        const stockRes = await fetch(
            `${API_BASE}/webhooks/${selectedOrgToken}/catalog/check-stock?sku=${encodeURIComponent(selectedProduct.sku)}&quantity=${quantity}`
        );
        const stockData = await stockRes.json();
        if (!stockData.in_stock) {
            alert(`❌ ${stockData.message}\n\nRefreshing catalog…`);
            await loadCatalog();
            return;
        }
    } catch (e) {
        console.warn('Stock pre-check failed (non-fatal):', e.message);
    }

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled    = true;
    btn.textContent = '⏳ Placing order…';

    const product     = selectedProduct;
    const estimateCost = estimateData?.data?.estimatedCost || estimateData?.estimatedCost || 0;
    const quantity    = Math.max(1, parseInt(document.getElementById('quantityInput').value || '1', 10));
    // Catalog returns selling_price — not unit_price
    const unitPrice   = parseFloat(product.selling_price) || 0;
    const subtotal    = unitPrice * quantity;
    const taxAmount   = subtotal * 0.18;
    const totalAmount = subtotal + taxAmount + estimateCost;

    const webhookPayload = {
        event_type: 'order.created',
        source:     'customer-portal',
        timestamp:  new Date().toISOString(),
        data: {
            external_order_id: `ORD-${Date.now()}`,
            platform:          'customer-portal',
            customer_name:     'Test Customer',
            customer_email:    'customer@example.com',
            customer_phone:    '9876543210',
            shipping_address: {
                street:      deliveryPin.displayName,
                city:        deliveryPin.city  || 'Unknown',
                state:       deliveryPin.state || 'Unknown',
                postal_code: deliveryPin.postalCode || '',
                country:     'India'
            },
            total_amount:    totalAmount,
            tax_amount:      taxAmount,
            shipping_amount: estimateCost,
            priority:        'standard',
            notes:           `Order for ${product.name}`,
            items: [{
                // Use the REAL SKU from the SCM catalog (product must exist in DB with inventory)
                sku:             product.sku,
                product_name:    product.name,
                quantity:        quantity,
                unit_price:      unitPrice,
                weight:          parseFloat(product.weight) || null,
                dimensions:      product.dimensions
                                    ? (typeof product.dimensions === 'string'
                                       ? JSON.parse(product.dimensions)
                                       : product.dimensions)
                                    : null,
                is_fragile:      product.is_fragile  || false,
                // mrp is the declared value for insurance; fall back to selling_price
                declared_value:  parseFloat(product.mrp) || unitPrice,
            }]
        }
    };

    try {
        const orderResponse = await fetch(`${API_BASE}/webhooks/${selectedOrgToken}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });

        if (!orderResponse.ok) {
            const errText = await orderResponse.text();
            throw new Error(`Order webhook failed (${orderResponse.status}): ${errText}`);
        }

        const orderResult = await orderResponse.json();
        const jobId = orderResult.job_id;

        localStorage.setItem('currentJobId', jobId);
        localStorage.setItem('webhookPayload',  JSON.stringify(webhookPayload));
        localStorage.setItem('webhookResponse', JSON.stringify(orderResult));

        document.getElementById('orderIdDisplay').textContent     = `Job #${jobId}`;
        document.getElementById('carrierRequestData').textContent = JSON.stringify(webhookPayload.data, null, 2);
        document.getElementById('orderResponseData').textContent  = JSON.stringify(orderResult, null, 2);

        document.getElementById('step3').style.display = 'block';
        document.getElementById('step3').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        alert(`Error placing order: ${error.message}`);
        btn.disabled    = false;
        btn.textContent = '💳 Place Order';
    }
}

// ──────────── Init ────────────
// Load live catalog on page load — no hardcoded products.
window.addEventListener('DOMContentLoaded', () => {
    bindOrgControls();
    loadCatalog();
    initMap();
});
