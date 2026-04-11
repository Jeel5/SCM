const API_BASE = 'http://localhost:3000/api';
let currentCarrier = null;
let currentCarrierId = null;
let currentOrganization = null;
let currentWebhookSecret = null;
let shipmentsById = {};
let carrierNames = {};
let assignmentRows = [];
let shipmentRows = [];
let assignmentStatusFilter = 'all';
let assignmentServiceFilter = 'all';
let shipmentStatusFilter = 'all';
let shipmentSearchText = '';
// Maps carrier id/code → { id, code, name, webhook_secret } so the selected
// carrier can load credentials immediately without relying on pending rows.
let carrierDetails = {};
let organizationNames = {};
let organizationCarrierMap = {};

function getCarrierKey(carrier) {
    const codeKey = String(carrier?.code || '').trim().toLowerCase();
    if (codeKey) return `code:${codeKey}`;
    const idKey = String(carrier?.id || '').trim().toLowerCase();
    if (idKey) return `id:${idKey}`;
    const nameKey = String(carrier?.name || '').trim().toLowerCase();
    return `name:${nameKey}`;
}

function dedupeCarriers(carriers) {
    const seen = new Set();
    const unique = [];

    carriers.forEach((carrier) => {
        const key = getCarrierKey(carrier);
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(carrier);
    });

    return unique;
}

// ──────────── Load organizations and carriers from real API ────────────

async function loadCarriers() {
    try {
        const res = await fetch(`${API_BASE}/public/organizations`);
        const result = await res.json();
        const orgSelect = document.getElementById('organizationSelect');
        const carrierSelect = document.getElementById('carrierSelect');
        const secretValue = document.getElementById('webhookSecretValue');
        const orgLoadError = document.getElementById('orgLoadError');

        orgLoadError.style.display = 'none';
        orgLoadError.textContent = '';

        if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
            orgSelect.innerHTML = '<option value="">No active organizations found</option>';
            carrierSelect.innerHTML = '<option value="">Select an organization first</option>';
            carrierSelect.disabled = true;
            return;
        }

        carrierNames = {};
        carrierDetails = {};
        organizationNames = {};
        organizationCarrierMap = {};
        orgSelect.innerHTML = '<option value="">Select an organization</option>';
        carrierSelect.innerHTML = '<option value="">Select an organization first</option>';
        secretValue.value = '';

        result.data.forEach((org) => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            orgSelect.appendChild(option);
        });

        if (result.data.length === 1) {
            orgSelect.value = result.data[0].id;
            await loadCarriersForOrganization(result.data[0].id);
        }
    } catch (err) {
        console.error('Error loading carriers:', err);
        const orgLoadError = document.getElementById('orgLoadError');
        orgLoadError.textContent = 'Failed to load organizations. Check backend and refresh.';
        orgLoadError.style.display = 'block';
    }
}

async function loadCarriersForOrganization(organizationId) {
    const carrierSelect = document.getElementById('carrierSelect');
    const secretValue = document.getElementById('webhookSecretValue');
    const carrierLoadError = document.getElementById('carrierLoadError');

    try {
        carrierLoadError.style.display = 'none';
        carrierSelect.innerHTML = '<option value="">Select a carrier</option>';
        carrierSelect.disabled = !organizationId;
        currentOrganization = organizationId || null;
        currentCarrier = null;
        currentCarrierId = null;
        currentWebhookSecret = null;
        secretValue.value = '';

        if (!organizationId) {
            document.getElementById('currentCarrierName').textContent = '—';
            assignmentRows = [];
            shipmentRows = [];
            renderAssignments();
            renderShipments();
            return;
        }

        const res = await fetch(`${API_BASE}/public/organizations/${organizationId}/carriers`);
        const result = await res.json();

        const carriers = dedupeCarriers(Array.isArray(result.data) ? result.data : []);
        if (carriers.length === 0) {
            carrierSelect.innerHTML = '<option value="">No carriers found for this organization</option>';
            carrierSelect.disabled = true;
            document.getElementById('currentCarrierName').textContent = '—';
            assignmentRows = [];
            shipmentRows = [];
            renderAssignments();
            renderShipments();
            return;
        }

        carrierSelect.disabled = false;
        carriers.forEach((carrier) => {
            carrierNames[carrier.code] = carrier.name;
            carrierNames[carrier.id] = carrier.name;
            const details = {
                id: carrier.id,
                code: carrier.code,
                name: carrier.name,
                webhook_secret: carrier.webhookSecret || carrier.webhook_secret || null,
                organizationId,
            };
            carrierDetails[carrier.id] = details;
            carrierDetails[carrier.code] = details;

            const option = document.createElement('option');
            option.value = carrier.id;
            option.textContent = carrier.name;
            carrierSelect.appendChild(option);
        });

        if (carriers.length === 1) {
            carrierSelect.value = carriers[0].id;
            await selectCarrier(null, carriers[0].id);
        } else {
            document.getElementById('currentCarrierName').textContent = 'Select a carrier';
        }
    } catch (err) {
        console.error('Error loading carriers for organization:', err);
        carrierLoadError.textContent = 'Failed to load carriers for the selected organization.';
        carrierLoadError.style.display = 'block';
    }
}

// ──────────── HMAC Signature Generation ────────────

async function generateHmacSignature(payload, secret, timestamp) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
    const hashHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256=${hashHex}`;
}

async function sendAuthenticatedRequest(url, method, body) {
    if (!currentWebhookSecret) throw new Error('Webhook secret not loaded. Select a carrier first.');
    if (!currentCarrierId) throw new Error('Carrier ID not loaded. Select a carrier first.');

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateHmacSignature(body, currentWebhookSecret, timestamp);

    const fetchOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Carrier-ID': currentCarrierId,
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp.toString()
        }
    };

    // For GET requests, don't include body; for POST/PUT, stringify the body
    if (method.toUpperCase() !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
}

function setupFilters() {
    document.getElementById('assignmentStatusFilter').addEventListener('change', (e) => {
        assignmentStatusFilter = e.target.value;
        loadPendingRequests();
    });
    document.getElementById('assignmentServiceFilter').addEventListener('change', (e) => {
        assignmentServiceFilter = e.target.value;
        renderAssignments();
    });
    document.getElementById('shipmentStatusFilter').addEventListener('change', (e) => {
        shipmentStatusFilter = e.target.value;
        renderShipments();
    });
    document.getElementById('shipmentSearchInput').addEventListener('input', (e) => {
        shipmentSearchText = (e.target.value || '').trim().toLowerCase();
        renderShipments();
    });
    document.getElementById('organizationSelect').addEventListener('change', async (e) => {
        await loadCarriersForOrganization(e.target.value);
    });
    document.getElementById('carrierSelect').addEventListener('change', async (e) => {
        await selectCarrier(null, e.target.value);
    });
    document.getElementById('toggleWebhookSecretBtn').addEventListener('click', () => {
        const secretValue = document.getElementById('webhookSecretValue');
        const toggleBtn = document.getElementById('toggleWebhookSecretBtn');
        if (secretValue.type === 'password') {
            secretValue.type = 'text';
            toggleBtn.textContent = 'Hide';
        } else {
            secretValue.type = 'password';
            toggleBtn.textContent = 'Show';
        }
    });
    document.getElementById('copyWebhookSecretBtn').addEventListener('click', async () => {
        const secretValue = document.getElementById('webhookSecretValue');
        if (!secretValue.value) return;
        try {
            await navigator.clipboard.writeText(secretValue.value);
        } catch {
            secretValue.select();
            document.execCommand('copy');
        }
    });
    document.getElementById('refreshAssignmentsBtn').addEventListener('click', () => loadPendingRequests());
    document.getElementById('refreshShipmentsBtn').addEventListener('click', () => loadMyShipments());
}

function renderAssignmentStats(rows) {
    const el = document.getElementById('assignmentStatsStrip');
    const pending = rows.filter(r => r.status === 'pending').length;
    const assigned = rows.filter(r => r.status === 'assigned').length;
    el.innerHTML = `
        <div class="stat-chip"><div class="k">Total</div><div class="v">${rows.length}</div></div>
        <div class="stat-chip"><div class="k">Pending</div><div class="v">${pending}</div></div>
        <div class="stat-chip"><div class="k">Assigned</div><div class="v">${assigned}</div></div>
        <div class="stat-chip"><div class="k">Carrier</div><div class="v">${carrierNames[currentCarrier] || '—'}</div></div>`;
}

function renderShipmentStats(rows) {
    const el = document.getElementById('shipmentStatsStrip');
    const pending = rows.filter(r => r.status === 'pending').length;
    const transit = rows.filter(r => r.status === 'in_transit').length;
    const delivered = rows.filter(r => r.status === 'delivered').length;
    el.innerHTML = `
        <div class="stat-chip"><div class="k">Total</div><div class="v">${rows.length}</div></div>
        <div class="stat-chip"><div class="k">Pending</div><div class="v">${pending}</div></div>
        <div class="stat-chip"><div class="k">In Transit</div><div class="v">${transit}</div></div>
        <div class="stat-chip"><div class="k">Delivered</div><div class="v">${delivered}</div></div>`;
}

// ──────────── Carrier selection ────────────

async function selectCarrier(evt, carrier) {
    const selected = carrierDetails[carrier] || null;
    if (!selected) {
        currentCarrier = null;
        currentCarrierId = null;
        currentWebhookSecret = null;
        document.getElementById('currentCarrierName').textContent = '—';
        document.getElementById('webhookSecretValue').value = '';
        assignmentRows = [];
        shipmentRows = [];
        renderAssignments();
        renderShipments();
        return;
    }

    currentCarrier = selected.code;
    currentCarrierId = selected.id;
    currentWebhookSecret = selected.webhook_secret || null;

    document.getElementById('carrierSelect').value = selected.id;
    document.getElementById('currentCarrierName').textContent = selected.name || selected.code;
    document.getElementById('webhookSecretValue').value = currentWebhookSecret || '';

    await loadPendingRequests();
    await loadMyShipments();
}

// ──────────── Pending assignments ────────────

async function loadPendingRequests() {
    try {
        if (!currentCarrierId || !currentOrganization) {
            assignmentRows = [];
            renderAssignments();
            return;
        }

        const params = new URLSearchParams({ carrierId: currentCarrierId, orgId: currentOrganization });
        if (assignmentStatusFilter !== 'all') params.set('status', assignmentStatusFilter);
        
        // Use authenticated request with HMAC signature for GET
        const url = `${API_BASE}/carriers/assignments/pending?${params.toString()}`;
        let result;
        try {
            result = await sendAuthenticatedRequest(url, 'GET', '');
            if (!result.success || !Array.isArray(result.data)) {
                assignmentRows = [];
                document.getElementById('requestsContainer').innerHTML = `
                    <div class="empty-state">
                        <h3>Could not load assignments</h3>
                        <p>Server returned an unexpected response.</p>
                    </div>`;
                return;
            }
        } catch (authError) {
            console.error('Authenticated request failed:', authError);
            assignmentRows = [];
            document.getElementById('requestsContainer').innerHTML = `
                <div class="empty-state">
                    <h3>Assignment fetch failed</h3>
                    <p>${authError.message || 'Authentication failed for selected carrier.'}</p>
                </div>`;
            return;
        }

        assignmentRows = result.data;

        renderAssignments();
    } catch (error) {
        console.error('Error loading requests:', error);
        assignmentRows = [];
        renderAssignments();
    }
}

async function fetchWebhookSecret(carrierId) {
    const details = carrierDetails[carrierId];
    currentWebhookSecret = details?.webhook_secret || null;
    const secretValue = document.getElementById('webhookSecretValue');
    if (secretValue) {
        secretValue.value = currentWebhookSecret || '';
    }
}

function showEmptyState() {
    document.getElementById('requestsContainer').innerHTML = `
        <div class="empty-state">
            <h3>No Pending Requests</h3>
            <p>Waiting for customers to place orders…</p>
            <p style="margin-top: 15px; font-size: 0.9em;">
                <strong>Tip:</strong> Go to the Customer Portal and place an order to see requests here.
            </p>
        </div>`;
}

function renderAssignments() {
    const rows = assignmentRows.filter((r) => {
        if (assignmentServiceFilter !== 'all' && (r.serviceType || '').toLowerCase() !== assignmentServiceFilter) {
            return false;
        }
        return true;
    });
    renderAssignmentStats(rows);
    if (rows.length === 0) {
        showEmptyState();
        return;
    }
    displayAssignments(rows);
}

function displayAssignments(assignments) {
    const container = document.getElementById('requestsContainer');
    container.innerHTML = assignments.map((assignment) => {
        const orderData = assignment.orderData || {};
        const items = orderData.items || [];
        const firstItem = items[0] || {};
        const shippingAddr = assignment.shippingAddress || {};
        return `
        <div class="quote-request">
            <div class="request-header">
                <h3>Order ${assignment.orderNumber}</h3>
                <div class="request-time">
                    <span class="badge badge-pending">PENDING</span>
                    <small style="display:block; margin-top:5px;">Expires: ${new Date(assignment.expiresAt).toLocaleString()}</small>
                </div>
            </div>

            <div class="shipment-details">
                <h4 style="margin-bottom:15px; color:#495057;">Shipment Details</h4>
                <div class="detail-row"><div class="detail-label">Customer:</div><div class="detail-value">${assignment.customerName}</div></div>
                <div class="detail-row"><div class="detail-label">Email:</div><div class="detail-value">${assignment.customerEmail}</div></div>
                <div class="detail-row"><div class="detail-label">Product:</div><div class="detail-value">${firstItem.productName || 'N/A'}</div></div>
                <div class="detail-row"><div class="detail-label">Quantity:</div><div class="detail-value">${firstItem.quantity || 1}</div></div>
                <div class="detail-row"><div class="detail-label">Weight:</div><div class="detail-value">${firstItem.weight || 'N/A'} kg</div></div>
                <div class="detail-row"><div class="detail-label">Dimensions:</div><div class="detail-value">
                    ${firstItem.dimensions ? `${firstItem.dimensions.length}×${firstItem.dimensions.width}×${firstItem.dimensions.height} cm` : 'N/A'}
                    ${firstItem.volumetric_weight ? `<small style="color:#6c757d;"> (Vol: ${firstItem.volumetric_weight}kg)</small>` : ''}
                </div></div>
                <div class="detail-row"><div class="detail-label">Special Handling:</div><div class="detail-value">
                    ${firstItem.is_fragile ? '<span style="color:#dc3545;">Fragile</span>' : ''}
                    ${firstItem.is_hazardous ? '<span style="color:#dc3545;">Hazardous</span>' : ''}
                    ${firstItem.requires_cold_storage ? '<span style="color:#0d6efd;">Cold Storage</span>' : ''}
                    ${!firstItem.is_fragile && !firstItem.is_hazardous && !firstItem.requires_cold_storage ? 'Standard' : ''}
                </div></div>
                <div class="detail-row"><div class="detail-label">Order Value:</div><div class="detail-value">₹${assignment.totalAmount.toLocaleString()}</div></div>
                <div class="detail-row"><div class="detail-label">Delivery To:</div><div class="detail-value">${shippingAddr.city || 'N/A'}, ${shippingAddr.state || ''} ${shippingAddr.postal_code || ''}</div></div>
                <div class="detail-row"><div class="detail-label">Service Type:</div><div class="detail-value">${assignment.serviceType}</div></div>
                <div class="detail-row"><div class="detail-label">Requested:</div><div class="detail-value">${new Date(assignment.requestedAt).toLocaleString()}</div></div>
            </div>

            <div class="data-grid">
                <div class="data-section">
                    <h4>Full Request Payload</h4>
                    <div class="data-display"><pre>${JSON.stringify(orderData, null, 2)}</pre></div>
                </div>
                <div class="data-section">
                    <h4>Assignment Info</h4>
                    <div style="padding:15px; background:#f8f9fa; border-radius:6px;">
                        <p><strong>Assignment ID:</strong> ${assignment.id}</p>
                        <p><strong>Order ID:</strong> ${assignment.orderId}</p>
                        <p><strong>Status:</strong> ${assignment.status}</p>
                        <p><strong>Hours until expiry:</strong> ${assignment.hoursUntilExpiry || 'N/A'}</p>
                        <p style="margin-top:10px;"><strong>Suggested Price:</strong> ₹${Math.round(assignment.totalAmount * 0.15)}</p>
                        <p><strong>Estimated Days:</strong> 2–3 days</p>
                    </div>
                </div>
            </div>

            <div class="action-section">
                <div class="action-card">
                    <h4>Accept Assignment</h4>
                    <div class="input-group">
                        <label>Quoted Price (₹)</label>
                        <input type="number" id="quotedPrice-${assignment.id}" value="${Math.round(assignment.totalAmount * 0.15)}" step="0.01">
                    </div>
                    <div class="input-group">
                        <label>Delivery Days</label>
                        <input type="number" id="deliveryDays-${assignment.id}" value="2" min="1">
                    </div>
                    <div class="input-group">
                        <label>Service Type</label>
                        <select id="quoteServiceType-${assignment.id}">
                            <option value="standard" selected>Standard</option>
                            <option value="express">Express</option>
                            <option value="overnight">Overnight</option>
                        </select>
                    </div>
                    <button type="button" class="btn btn-accept" onclick="acceptAssignment('${assignment.id}')">
                        Accept & Create Shipment
                    </button>
                </div>
                <div class="action-card">
                    <h4>Reject Assignment</h4>
                    <div class="input-group">
                        <label>Rejection Reason</label>
                        <select id="rejectionReason-${assignment.id}">
                            <option value="weight_exceeded">Weight Exceeded</option>
                            <option value="route_not_serviceable">Route Not Serviceable</option>
                            <option value="at_capacity">At Capacity</option>
                            <option value="no_cold_storage">No Cold Storage Available</option>
                            <option value="fragile_handling_unavailable">Fragile Handling Unavailable</option>
                            <option value="pricing_not_viable">Pricing Not Viable</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Additional Message</label>
                        <input type="text" id="rejectionMessage-${assignment.id}" placeholder="Optional details…">
                    </div>
                    <button type="button" class="btn btn-reject" onclick="rejectAssignment('${assignment.id}')">
                        Reject Assignment
                    </button>
                </div>
            </div>

            <div id="responseDisplay-${assignment.id}" class="response-section"></div>
        </div>`;
    }).join('');
}

// ──────────── Accept / Reject ────────────

async function acceptAssignment(assignmentId) {
    const quotedPrice = parseFloat(document.getElementById(`quotedPrice-${assignmentId}`).value);
    const deliveryDays = parseInt(document.getElementById(`deliveryDays-${assignmentId}`).value, 10);
    const serviceType = document.getElementById(`quoteServiceType-${assignmentId}`).value;

    const acceptanceData = {
        carrierReferenceId: `${currentCarrier}-${Date.now()}`,
        trackingNumber: `${currentCarrier}-TRACK-${Date.now()}`,
        quotedPrice, price: quotedPrice, currency: 'INR',
        serviceLevel: serviceType,
        estimatedPickupTime: new Date(Date.now() + 2*60*60*1000).toISOString(),
        estimatedDeliveryTime: new Date(Date.now() + deliveryDays*24*60*60*1000).toISOString(),
        driver: {
            name: 'Driver',
            phone: '+91-9876543210',
            vehicleNumber: 'MH-01-AB-1234',
            vehicleType: 'Van'
        },
        additionalInfo: `Service Type: ${serviceType}, Quoted Price: ₹${quotedPrice}`
    };

    try {
        const result = await sendAuthenticatedRequest(
            `${API_BASE}/assignments/${assignmentId}/accept`, 'POST', acceptanceData
        );
        if (result.success) displayResponse(assignmentId, result.data, true);
        else throw new Error(result.error || 'Failed to accept assignment');
    } catch (error) {
        console.error('Error accepting assignment:', error);
        showActionError(assignmentId, `Accept failed: ${error.message}`);
    }
}

async function rejectAssignment(assignmentId) {
    const reason = document.getElementById(`rejectionReason-${assignmentId}`).value;
    const message = document.getElementById(`rejectionMessage-${assignmentId}`).value || getRejectionMessage(reason);

    try {
        const result = await sendAuthenticatedRequest(
            `${API_BASE}/assignments/${assignmentId}/reject`, 'POST', { reason, message }
        );
        if (result.success) displayResponse(assignmentId, result.data, false);
        else throw new Error(result.error || 'Failed to reject assignment');
    } catch (error) {
        console.error('Error rejecting assignment:', error);
        showActionError(assignmentId, `Reject failed: ${error.message}`);
    }
}

function showActionError(assignmentId, message) {
    const responseDiv = document.getElementById(`responseDisplay-${assignmentId}`);
    if (!responseDiv) return;
    responseDiv.className = 'response-section reject';
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = `
        <h4>Action Failed</h4>
        <p style="margin-bottom:10px; color:#721c24;">${message}</p>
        <p style="font-size:0.85em; color:#6c757d;">Refresh assignments and retry.</p>`;
}

function getRejectionMessage(reason) {
    const messages = {
        weight_exceeded: 'Shipment weight exceeds our capacity limits',
        route_not_serviceable: 'This route is not currently serviceable',
        at_capacity: 'We are at maximum capacity and cannot accept new shipments',
        no_cold_storage: 'Cold storage facilities not available',
        fragile_handling_unavailable: 'Fragile handling service unavailable on this route',
        pricing_not_viable: 'Unable to provide competitive pricing for this shipment'
    };
    return messages[reason] || 'Unable to accept this shipment';
}

function displayResponse(assignmentId, responseData, isAccepted) {
    const responseDiv = document.getElementById(`responseDisplay-${assignmentId}`);
    responseDiv.className = 'response-section ' + (isAccepted ? '' : 'reject');
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = `
        <h4>${isAccepted ? 'Assignment Accepted & Shipment Created!' : 'Assignment Rejected'}</h4>
        <p style="margin-bottom:15px; color:#495057;">Processed at ${new Date().toLocaleTimeString()}</p>
        ${isAccepted ? `
        <div style="background:#d4edda; border:2px solid #c3e6cb; padding:15px; border-radius:8px; margin-bottom:15px;">
            <h4 style="color:#155724; margin-bottom:10px;">Shipment Details</h4>
            <p><strong>Tracking Number:</strong> ${responseData.shipment?.trackingNumber || 'N/A'}</p>
            <p><strong>Status:</strong> ${responseData.shipment?.status || 'pending'}</p>
            <p><strong>Created:</strong> ${new Date(responseData.shipment?.createdAt || Date.now()).toLocaleString()}</p>
        </div>` : ''}
        <h4 style="margin-top:15px; color:#495057;">Response Data:</h4>
        <div class="data-display"><pre>${JSON.stringify(responseData, null, 2)}</pre></div>
        <p style="margin-top:15px; text-align:center; font-size:0.9em; color:#6c757d;">
            Refreshing in 3 seconds…
        </p>`;

    setTimeout(async () => {
        await loadPendingRequests();
        await loadMyShipments();
    }, 3000);
}

// ──────────── Shipments (Pending Pickup) ────────────

async function loadMyShipments() {
    try {
        // Resolve carrier UUID from stored details if not yet set
        if (!currentCarrierId) {
            currentCarrierId = carrierDetails[currentCarrier]?.id || null;
            if (!currentCarrierId) {
                shipmentRows = [];
                renderShipments('Could not resolve carrier ID for selected carrier.');
                return;
            }
        }

        const response = await fetch(`${API_BASE}/shipments?carrier_id=${currentCarrierId}`);
        const data = await response.json();

        if (!data.success || !Array.isArray(data.data)) {
            shipmentRows = [];
            renderShipments('Failed to read shipment data.');
            return;
        }

        shipmentRows = data.data;
        renderShipments();
    } catch (error) {
        console.error('Error loading shipments:', error);
        shipmentRows = [];
        renderShipments(error.message);
    }
}

function renderShipments(errorMessage = '') {
    const container = document.getElementById('shipmentsContainer');
    const rows = shipmentRows.filter((shipment) => {
        if (shipmentStatusFilter !== 'all' && shipment.status !== shipmentStatusFilter) return false;
        if (shipmentSearchText) {
            const haystack = `${shipment.trackingNumber || ''} ${shipment.orderNumber || ''}`.toLowerCase();
            if (!haystack.includes(shipmentSearchText)) return false;
        }
        return true;
    });

    shipmentsById = Object.fromEntries(rows.map((s) => [s.id, s]));
    renderShipmentStats(rows);

    if (rows.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>${errorMessage ? 'Unable to Load Shipments' : 'No Shipments Match Filter'}</h3>
                <p>${errorMessage || 'Try changing status/search filters or accept new assignments.'}</p>
            </div>`;
        return;
    }

    container.innerHTML = rows.map(shipment => `
        <div class="shipment-card">
            <div class="request-header">
                <h3>${shipment.trackingNumber}</h3>
                <span class="shipment-status ${shipment.status === 'in_transit' ? 'in-transit' : ''}">${shipment.status.toUpperCase()}</span>
            </div>
            <div class="shipment-details">
                <div class="detail-row"><span class="detail-label">Order Number:</span><span class="detail-value">${shipment.orderNumber || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Origin:</span><span class="detail-value">${shipment.origin?.city || 'N/A'}, ${shipment.origin?.state || ''}</span></div>
                <div class="detail-row"><span class="detail-label">Destination:</span><span class="detail-value">${shipment.destination?.city || 'N/A'}, ${shipment.destination?.state || ''}</span></div>
                <div class="detail-row"><span class="detail-label">Weight:</span><span class="detail-value">${shipment.weight} kg</span></div>
                <div class="detail-row"><span class="detail-label">SLA Deadline:</span><span class="detail-value">${new Date(shipment.slaDeadline).toLocaleString()}</span></div>
                <div class="detail-row"><span class="detail-label">Created:</span><span class="detail-value">${new Date(shipment.createdAt).toLocaleString()}</span></div>
            </div>
            <div style="margin-top:20px; padding:15px; background:${shipment.status === 'pending' ? '#fff3cd' : '#e9f7ff'}; border-left:4px solid ${shipment.status === 'pending' ? '#ffc107' : '#17a2b8'}; border-radius:4px;">
                <h4 style="margin-bottom:10px; color:${shipment.status === 'pending' ? '#856404' : '#0c5460'};">${shipment.status === 'pending' ? 'Action Required: Confirm Pickup' : 'Shipment Progress'}</h4>
                ${shipment.status === 'pending'
                    ? `<p style="margin-bottom:15px; color:#856404;">
                        This shipment is ready for pickup. Once you collect the package, click below.
                        <strong>SLA timer starts from confirmation.</strong>
                       </p>
                       <button class="btn-pickup" onclick="confirmPickup('${shipment.id}', '${shipment.trackingNumber}')">
                        Confirm Pickup - Start Transit
                       </button>`
                    : `<p style="margin-bottom:12px; color:#0c5460;">No pickup action needed. Current status: <strong>${shipment.status}</strong>.</p>
                       ${shipment.status !== 'delivered' && shipment.status !== 'returned' && shipment.status !== 'cancelled'
                        ? `<button class="btn btn-reject" style="max-width:260px;" onclick="reportShipmentException('${shipment.id}', '${shipment.trackingNumber}')">Report Exception</button>`
                        : ''}`}
            </div>
        </div>`).join('');
}

// ──────────── Confirm Pickup ────────────

async function confirmPickup(shipmentId, trackingNumber) {
    if (!confirm(`Confirm pickup of shipment ${trackingNumber}?\n\nThis will:\n✓ Mark shipment as IN TRANSIT\n✓ Update order status to SHIPPED\n✓ Start SLA timer (cannot be undone)`)) return;

    const shipment = shipmentsById[shipmentId] || null;
    const originCoords = shipment?.origin?.coordinates || null;
    const pickupData = {
        carrierId: currentCarrierId,
        pickupTimestamp: new Date().toISOString(),
        driverName: `${carrierNames[currentCarrier] || currentCarrier} Driver`,
        vehicleNumber: `MH-01-AB-${Math.floor(1000 + Math.random() * 9000)}`,
        gpsLocation: {
            lat: originCoords?.lat != null ? Number(originCoords.lat) : 20.5937,
            lon: originCoords?.lng != null ? Number(originCoords.lng) : 78.9629,
            city: shipment?.origin?.city || '',
            state: shipment?.origin?.state || ''
        },
        notes: `Package picked up by ${carrierNames[currentCarrier] || currentCarrier}`
    };

    try {
        const result = await sendAuthenticatedRequest(
            `${API_BASE}/shipments/${shipmentId}/confirm-pickup`, 'POST', pickupData
        );
        if (result.success) {
            console.info(`Pickup Confirmed!\n\nTracking: ${result.data.trackingNumber}\nStatus: ${result.data.status}\nOrder: ${result.data.orderStatus}\n\nSLA timer started.`);
            loadMyShipments();
        } else throw new Error(result.error || 'Failed to confirm pickup');
    } catch (error) {
        console.error('Error confirming pickup:', error);
        console.error('Error: ' + error.message);
    }
}

async function reportShipmentException(shipmentId, trackingNumber) {
    const reason = prompt('Enter exception reason (e.g. address issue, customer unavailable, damage):', 'address issue');
    if (!reason) return;

    try {
        const result = await sendAuthenticatedRequest(
            `${API_BASE}/shipments/${trackingNumber}/update-tracking`,
            'POST',
            {
                eventType: 'exception',
                location: { city: '', state: '' },
                description: reason,
            }
        );

        if (!result.success) {
            throw new Error(result.message || 'Failed to report exception');
        }

        await loadMyShipments();
    } catch (error) {
        console.error('Failed to report exception:', error.message);
    }
}

// ──────────── Update Shipment Status (real tracking API) ────────────

async function updateShipmentStatus() {
    const trackingNumber = document.getElementById('updateTrackingNumber').value.trim();
    const eventType = document.getElementById('updateEventType').value;
    const city = document.getElementById('updateCity').value.trim();
    const description = document.getElementById('updateDescription').value.trim();
    const resultDiv = document.getElementById('statusUpdateResult');

    if (!trackingNumber) { console.error('Please enter a tracking number.'); return; }
    if (!currentWebhookSecret || !currentCarrierId) {
        console.error('Please select a carrier first so the HMAC secret is loaded.');
        return;
    }

    const body = {
        eventType,
        location: city ? { city, state: '' } : undefined,
        description: description || `Status updated to ${eventType}`
    };

    try {
        const result = await sendAuthenticatedRequest(
            `${API_BASE}/shipments/${trackingNumber}/update-tracking`, 'POST', body
        );

        resultDiv.style.display = 'block';
        resultDiv.style.background = '#d4edda';
        resultDiv.style.border = '2px solid #28a745';
        resultDiv.style.color = '#155724';
        resultDiv.innerHTML = `<strong>Tracking updated!</strong><br>
            Tracking: <code>${trackingNumber}</code><br>
            Status: <strong>${result.data?.status || eventType}</strong><br>
            <small style="color:#6c757d; margin-top:8px; display:block;">
                Response: <pre style="margin:5px 0;">${JSON.stringify(result.data || result, null, 2)}</pre>
            </small>`;

        await loadMyShipments();
    } catch (err) {
        console.error('Error updating status:', err);
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#f8d7da';
        resultDiv.style.border = '2px solid #dc3545';
        resultDiv.style.color = '#721c24';
        resultDiv.innerHTML = `<strong>Error:</strong> ${err.message}`;
    }
}

// ──────────── Init ────────────

window.onload = async () => {
    setupFilters();
    await loadCarriers();
    setInterval(async () => {
        if (!currentCarrier) return;
        await loadPendingRequests();
        await loadMyShipments();
    }, 5000);
};
