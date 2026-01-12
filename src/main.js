import './style.css';
import { supabase } from './supabaseClient';

let orders = [];

const fetchOrders = async () => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('entered_at', { ascending: true });

    if (error) {
        console.error('Error loading orders:', error);
        return;
    }

    orders = data || [];
    render();
};

fetchOrders();

const container = document.getElementById('orders-container');
const btnAdd = document.getElementById('btn-customer-in');
const elWarning = document.getElementById('limit-warning');

// History & Tabs
const historyStd = document.getElementById('history-container-std');
const historyDine = document.getElementById('history-container-dinein');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Location
// Location
const welcomeView = document.getElementById('welcome-view');
const mainView = document.getElementById('main-view');
const btnLocations = document.querySelectorAll('.btn-location');
const currentLocationBadge = document.getElementById('current-location-badge');
const btnChangeLocation = document.getElementById('btn-change-location');

// Default to Mbezi if element missing, though logic assumes element exists
let currentLocation = 'Mbezi';

// Handle Start Screen Selection
btnLocations.forEach(btn => {
    btn.addEventListener('click', () => {
        const loc = btn.dataset.loc;
        currentLocation = loc;

        // Update Header Badge
        if (currentLocationBadge) currentLocationBadge.innerText = `📍 ${loc}`;

        // Switch Views
        welcomeView.classList.add('hidden');
        mainView.classList.remove('hidden');

        render();
    });
});

const datePicker = document.getElementById('date-picker');

// Helper: Get 'YYYY-MM-DD' from a timestamp (uses Local Time)
const getDateString = (ts) => {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getTodayString = () => {
    return getDateString(Date.now());
};

// Date State
let selectedDate = getTodayString(); // Default Today 'YYYY-MM-DD'

if (datePicker) {
    datePicker.value = selectedDate;
    datePicker.max = selectedDate; // Prevent selecting future dates if needed, though user said "users should be able to select a different day"

    datePicker.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        render(); // Re-render with new filter
    });
}

// Handle Change Location (Back to Start)
if (btnChangeLocation) {
    btnChangeLocation.addEventListener('click', () => {
        // Switch Views back to Welcome
        mainView.classList.add('hidden');
        welcomeView.classList.remove('hidden');
    });
}

// New state for selected stats filter (defaults to 'std' aka Takeaway)
let currentTab = 'std';

// Tab Switching Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked
        btn.classList.add('active');
        const targetId = `tab-${btn.dataset.tab}`;
        document.getElementById(targetId).classList.add('active');

        // Update stats context
        currentTab = btn.dataset.tab;
        updateStats();
    });
});

// Stats elements
const elAvgTime = document.getElementById('avg-time');
const elBottleneck = document.getElementById('bottleneck-stage');

// Check Limit
const checkLimit = () => {
    const today = getTodayString();
    const isToday = selectedDate === today;

    if (!isToday) {
        // Disable everything if not viewing today
        btnAdd.disabled = true;
        btnAdd.style.opacity = '0.5';
        btnAdd.style.cursor = 'not-allowed';
        // Hide warning as it's not relevant
        elWarning.classList.remove('visible');
        return;
    }

    // Reset styles
    btnAdd.style.opacity = '1';
    btnAdd.style.cursor = 'pointer';

    // Check against active orders (not done) OF CURRENT LOCATION
    const activeCount = orders.filter(o => o.status !== 'done' && (o.location === currentLocation || (!o.location && currentLocation === 'Mbezi'))).length;

    if (activeCount >= 5) {
        btnAdd.disabled = true;
        elWarning.classList.add('visible');
    } else {
        btnAdd.disabled = false;
        elWarning.classList.remove('visible');
    }
};

// Add Order
if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
        // Check limit for current location
        const activeCount = orders.filter(o => o.status !== 'done' && (o.location === currentLocation || (!o.location && currentLocation === 'Mbezi'))).length;
        if (activeCount >= 5) return;

        const newOrder = {
            name: '',
            tag: 'Pending', // Order type to be determined later
            location: currentLocation, // Tag with current location
            entered_at: Date.now(),
            ordered_at: null,
            paid_at: null,
            delivered_at: null,
            status: 'queue',
            comments: ''
        };

        const { data, error } = await supabase
            .from('orders')
            .insert(newOrder)
            .select()
            .single();

        if (error) {
            console.error('Error adding order:', error);
            return;
        }

        if (data) {
            orders.push(data);
            render();
        }
    });
}

const updateName = async (id, newName) => {
    const order = orders.find(o => o.id === id);
    if (order) {
        order.name = newName;
        // Optimistic update done above, now sync
        await supabase.from('orders').update({ name: newName }).eq('id', id);
    }
}

const updateTag = async (id, newTag) => {
    const order = orders.find(o => o.id === id);
    if (order && order.status !== 'done') {
        order.tag = newTag;
        render(); // Re-render for UI update
        await supabase.from('orders').update({ tag: newTag }).eq('id', id);
    }
}

const formatTime = (ms) => {
    if (isNaN(ms)) return "00:00";
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 1000 / 60));
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '--:--';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const parseComments = (raw) => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        return [{ text: raw, timestamp: null }];
    } catch (e) {
        return [{ text: raw, timestamp: null }];
    }
};

const addComment = async (id, text) => {
    if (!text || !text.trim()) return;

    const order = orders.find(o => o.id === id);
    if (order) {
        const existing = parseComments(order.comments);
        const newComment = {
            text: text.trim(),
            timestamp: Date.now()
        };
        const updated = [...existing, newComment];

        // Update local
        order.comments = JSON.stringify(updated);
        render(); // Re-render to show new list

        // Sync to DB
        await supabase.from('orders').update({ comments: order.comments }).eq('id', id);
    }
}

const renderCommentsHTML = (order) => {
    const comments = parseComments(order.comments);
    const listHTML = comments.map(c => `
        <div class="comment-item">
            <span class="comment-text">${c.text}</span>
            <span class="comment-meta">${c.timestamp ? formatTimestamp(c.timestamp) : ''}</span>
        </div>
    `).join('');

    return `
        <div class="comments-container">
            <div class="comments-list">${listHTML}</div>
            <div class="add-comment-row">
                <input type="text" 
                    class="input-new-comment" 
                    placeholder="Add comment..." 
                    data-id="${order.id}">
                <button class="btn-add-comment" data-id="${order.id}">+</button>
            </div>
        </div>
    `;
};

// DELETE/CANCEL ORDER
const cancelOrder = async (id) => {
    // Store the ID of the order to cancel
    pendingCancelId = id;
    // Show custom modal
    if (confirmModal) confirmModal.classList.remove('hidden');
};

// Global variable to keep track of which order is being cancelled
let pendingCancelId = null;

// Modal elements
const confirmModal = document.getElementById('confirm-modal');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalConfirmBtn = document.getElementById('modal-confirm');

if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => {
        // Hide modal without doing anything
        if (confirmModal) confirmModal.classList.add('hidden');
        pendingCancelId = null;
    });
}

if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', async () => {
        if (pendingCancelId === null) return;
        // Optimistic UI update
        orders = orders.filter(o => o.id !== pendingCancelId);
        render();
        // Delete from Supabase
        const { error } = await supabase.from('orders').delete().eq('id', pendingCancelId);
        if (error) console.error('Error deleting order:', error);
        // Hide modal and reset state
        if (confirmModal) confirmModal.classList.add('hidden');
        pendingCancelId = null;
    });
}




const getStatusLabel = (status) => {
    switch (status) {
        case 'queue': return 'Waiting to Order';
        case 'prep': return 'Preparing';
        case 'served': return 'Served / Eating';
        case 'done': return 'Completed';
    }
};

// --- CORE LOGIC: ADVANCE ORDER ---
const advanceOrder = async (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const now = Date.now();
    const isDineIn = order.tag === 'Dine-in';

    // Calculate new state
    const updates = {};

    if (order.status === 'queue') {
        updates.ordered_at = now;
        updates.status = 'prep';
    }
    else if (order.status === 'prep') {
        updates.delivered_at = now;
        if (isDineIn) {
            updates.status = 'served';
        } else {
            updates.status = 'done';
        }
    }
    else if (order.status === 'served') {
        updates.status = 'done';
    }

    // Apply locally
    Object.assign(order, updates);
    render();

    // Sync to DB
    const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);

    if (error) console.error('Error updating status:', error);
};

// --- MARK PAYMENT (OPTIONAL) ---
const markPaid = async (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const now = Date.now();
    const updates = { paid_at: now };

    // Apply locally
    Object.assign(order, updates);
    render();

    // Sync to DB
    const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);

    if (error) console.error('Error updating payment:', error);
};

const render = () => {
    checkLimit();
    renderActive();
    renderHistory();
    updateStats();
};

const renderActive = () => {
    const today = getTodayString();
    // Filter active orders by LOCATION and DATE
    const activeOrders = orders.filter(o =>
        (o.status !== 'done') &&
        (o.location === currentLocation || (!o.location && currentLocation === 'Mbezi')) &&
        getDateString(o.entered_at) === selectedDate
    ).sort((a, b) => a.entered_at - b.entered_at);

    if (!container) return;
    container.innerHTML = '';

    // Hide active section title or something? No, just show empty state if none.
    // If not today, maybe change empty text.

    const isToday = selectedDate === today;

    if (activeOrders.length === 0) {
        const msg = isToday
            ? `No active orders for ${currentLocation}.<br>Tap "+" when a customer enters.`
            : `No active orders found for ${selectedDate}.`;

        container.innerHTML = `
          <div class="empty-state">
            <p>${msg}</p>
          </div>`;
    } else {
        activeOrders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';

            const isDineIn = order.tag === 'Dine-in';
            let btnText = 'Next';
            let btnClass = 'action-btn';

            if (order.status === 'queue') {
                btnText = 'Mark Ordered';
            } else if (order.status === 'prep') {
                btnText = isDineIn ? 'Mark Served' : 'Mark Done';
                btnClass = isDineIn ? 'action-btn' : 'action-btn finish';
            } else if (order.status === 'served') {
                btnText = 'Mark Done';
                btnClass = 'action-btn finish';
            }

            // Determine Progress Dots (simplified to 3 steps: Queue → Prep → Served/Done)
            let dot1Idx = 0, dot2Idx = 0, dot3Idx = 0;

            if (isDineIn) {
                if (order.status === 'queue') { dot1Idx = 1; }
                else if (order.status === 'prep') { dot1Idx = 2; dot2Idx = 1; }
                else if (order.status === 'served') { dot1Idx = 2; dot2Idx = 2; dot3Idx = 1; }
            } else {
                if (order.status === 'queue') { dot1Idx = 1; }
                else if (order.status === 'prep') { dot1Idx = 2; dot2Idx = 1; }
            }

            const getDotClass = (idx) => {
                if (idx === 2) return 'step-dot completed';
                if (idx === 1) return 'step-dot active';
                return 'step-dot';
            }

            const t1 = 'Queue';
            const t2 = 'Prep';
            const t3 = isDineIn ? 'Served' : 'Done';

            const tags = ['Pending', 'Dine-in', 'Takeaway', 'Delivery'];
            const options = tags.map(t => `<option value="${t}" ${order.tag === t ? 'selected' : ''}>${t}</option>`).join('');

            const isSelectDisabled = order.status === 'done';

            // Cancel button only if status is queue
            const cancelBtnHTML = order.status === 'queue'
                ? `<button class="btn-cancel" data-cancel-id="${order.id}" title="Cancel Order">✕</button>`
                : '';

            // Payment button (optional metric)
            const isPaid = order.paid_at !== null;
            const paymentBtnHTML = order.status !== 'queue' && order.status !== 'done'
                ? `<button class="btn-payment ${isPaid ? 'paid' : ''}" data-pay-id="${order.id}" title="${isPaid ? 'Paid ✓' : 'Mark as Paid'}">
                     ${isPaid ? '💰 Paid' : '💰 Mark Paid'}
                   </button>`
                : '';

            card.innerHTML = `
                <div class="order-header">
                    <div class="order-header-left">
                        <span class="order-id">#${order.id}</span>
                        <input type="text" class="input-name" placeholder="Name" value="${order.name || ''}" data-id="${order.id}">
                        <select class="tag-select" data-id="${order.id}" ${isSelectDisabled ? 'disabled' : ''}>${options}</select>
                    </div>
                    <div class="order-header-right">
                        <span class="entry-time" title="Entry Time">🕐 ${formatTimestamp(order.entered_at)}</span>
                        <span class="total-time" id="timer-${order.id}">00:00</span>
                        ${cancelBtnHTML}
                    </div>
                </div>
                <div class="progress-track">
                    <div class="${getDotClass(dot1Idx)}" title="${t1}"></div>
                    <div class="${getDotClass(dot2Idx)}" title="${t2}"></div>
                    <div class="${getDotClass(dot3Idx)}" title="${t3}"></div>
                </div>
                ${order.status === 'served' ? `
                ${order.status === 'served' ? renderCommentsHTML(order) : ''}` : ''}
                <div class="current-action">
                    <span class="status-label">${getStatusLabel(order.status)}</span>
                    <div class="action-buttons">
                        ${paymentBtnHTML}
                        <button class="${btnClass}" data-btn-id="${order.id}">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);

            const btn = card.querySelector(`button[data-btn-id="${order.id}"]`);
            btn.addEventListener('click', () => advanceOrder(order.id));
            const input = card.querySelector('input.input-name');
            input.addEventListener('input', (e) => updateName(order.id, e.target.value));
            const select = card.querySelector('select.tag-select');
            select.addEventListener('change', (e) => updateTag(order.id, e.target.value));

            // Cancel listener
            const btnCancel = card.querySelector(`button[data-cancel-id="${order.id}"]`);
            if (btnCancel) {
                btnCancel.addEventListener('click', () => cancelOrder(order.id));
            }

            // Payment listener
            const btnPayment = card.querySelector(`button[data-pay-id="${order.id}"]`);
            if (btnPayment && !isPaid) {
                btnPayment.addEventListener('click', () => markPaid(order.id));
            }

            // Comments listener
            // Comments listener
            const btnAdd = card.querySelector(`.btn-add-comment[data-id="${order.id}"]`);
            const inputAdd = card.querySelector(`.input-new-comment[data-id="${order.id}"]`);

            if (btnAdd && inputAdd) {
                const submit = () => {
                    addComment(order.id, inputAdd.value);
                    inputAdd.value = '';
                };
                btnAdd.addEventListener('click', submit);
                inputAdd.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') submit();
                });
            }
        });
    }
};

const renderHistory = () => {
    if (!historyStd || !historyDine) return;

    // Get completed orders filtered by LOCATION and DATE
    const history = orders.filter(o =>
        o.status === 'done' &&
        (o.location === currentLocation || (!o.location && currentLocation === 'Mbezi')) &&
        getDateString(o.entered_at) === selectedDate
    ).sort((a, b) => (b.delivered_at || 0) - (a.delivered_at || 0));

    historyStd.innerHTML = '';
    historyDine.innerHTML = '';

    const createHistoryItem = (order) => {
        const isDineIn = order.tag === 'Dine-in';
        const safeSub = (a, b) => (a && b) ? (a - b) : 0;

        let totalTime = 0, queueTime = 0, payTime = 0, prepTime = 0;

        if (isDineIn) {
            totalTime = safeSub(order.paid_at, order.entered_at);
            queueTime = safeSub(order.ordered_at, order.entered_at);
            prepTime = safeSub(order.delivered_at, order.ordered_at);
            payTime = safeSub(order.paid_at, order.delivered_at);
        } else {
            totalTime = safeSub(order.delivered_at, order.entered_at);
            queueTime = safeSub(order.ordered_at, order.entered_at);
            prepTime = safeSub(order.delivered_at, order.ordered_at);
            payTime = 0;
        }

        const pQueue = totalTime > 0 ? (queueTime / totalTime) * 100 : 0;
        const pPay = totalTime > 0 ? (payTime / totalTime) * 100 : 0;
        const pPrep = totalTime > 0 ? (prepTime / totalTime) * 100 : 0;

        let barHTML = '';
        if (isDineIn) {
            barHTML = `
                <div class="breakdown-segment seg-queue" style="width: ${pQueue}%" title="Queue"></div>
                <div class="breakdown-segment seg-prep" style="width: ${pPrep}%" title="Prep/Serve"></div>
                <div class="breakdown-segment seg-pay" style="width: ${pPay}%" title="Eat/Pay"></div>
             `;
        } else {
            barHTML = `
                <div class="breakdown-segment seg-queue" style="width: ${pQueue}%" title="Queue"></div>
                <div class="breakdown-segment seg-pay" style="width: ${pPay}%" title="Pay"></div>
                <div class="breakdown-segment seg-prep" style="width: ${pPrep}%" title="Prep"></div>
             `;
        }

        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-top">
                <div class="history-info">
                    <span class="history-id">#${order.id}</span>
                    <span class="history-name">${order.name || 'Anonymous'}</span>
                    <span class="history-tag">${order.tag || 'Pending'}</span>
                    <span class="history-entry-time" title="Entry Time">🕐 ${formatTimestamp(order.entered_at)}</span>
                </div>
                <div class="history-stats">
                    <span class="stat-pill" title="Total Time">⏱ ${formatTime(totalTime)}</span>
                </div>
            </div>
            ${renderCommentsHTML(order)}
            <div class="breakdown-bar">
                ${barHTML}
            </div>
        `;

        const btnAdd = div.querySelector(`.btn-add-comment[data-id="${order.id}"]`);
        const inputAdd = div.querySelector(`.input-new-comment[data-id="${order.id}"]`);

        if (btnAdd && inputAdd) {
            const submit = () => {
                addComment(order.id, inputAdd.value);
                inputAdd.value = '';
            };
            btnAdd.addEventListener('click', submit);
            inputAdd.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit();
            });
        }

        return div;
    };

    const stdHistory = history.filter(h => h.tag !== 'Dine-in');
    const dineHistory = history.filter(h => h.tag === 'Dine-in');

    const getLegend = (type) => {
        const labels = type === 'Dine-in'
            ? { r: 'Queue', g: 'Prep & Serve', o: 'Eat & Pay' }
            : { r: 'Queue', o: 'Payment', g: 'Preparation' };

        return `
        <div class="legend-container" style="border-top:none; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:0.5rem; margin-bottom:0.5rem; margin-top:0;">
            <div class="legend-item"><div class="legend-dot seg-queue"></div> ${labels.r}</div>
            ${type === 'Dine-in'
                ? `<div class="legend-item"><div class="legend-dot seg-prep"></div> ${labels.g}</div>
                   <div class="legend-item"><div class="legend-dot seg-pay"></div> ${labels.o}</div>`
                : `<div class="legend-item"><div class="legend-dot seg-pay"></div> ${labels.o}</div>
                   <div class="legend-item"><div class="legend-dot seg-prep"></div> ${labels.g}</div>`
            }
        </div>
        `;
    };

    const empty = '<p class="empty-text" style="padding:1rem; opacity:0.6;">No history yet.</p>';

    if (stdHistory.length === 0) {
        historyStd.innerHTML = empty;
    } else {
        historyStd.innerHTML = getLegend('std');
        stdHistory.forEach(order => historyStd.appendChild(createHistoryItem(order)));
    }

    if (dineHistory.length === 0) {
        historyDine.innerHTML = empty;
    } else {
        historyDine.innerHTML = getLegend('Dine-in');
        dineHistory.forEach(order => historyDine.appendChild(createHistoryItem(order)));
    }
};

const updateStats = () => {
    if (!elAvgTime || !elBottleneck) return;

    // Filter completed orders based on current tab AND LOCATION AND DATE
    const completedOrders = orders.filter(o => {
        if (o.status !== 'done') return false;

        // Location check
        if (!(o.location === currentLocation || (!o.location && currentLocation === 'Mbezi'))) return false;

        // Date check
        if (getDateString(o.entered_at) !== selectedDate) return false;

        // Tab check
        if (currentTab === 'dinein') {
            return o.tag === 'Dine-in';
        } else {
            return o.tag !== 'Dine-in';
        }
    });

    if (completedOrders.length === 0) {
        elAvgTime.innerText = '--:--';
        elBottleneck.innerText = 'No Data';
        // Reset new stats
        const elTotal = document.getElementById('total-orders');
        const elBest = document.getElementById('best-time');
        const elWorst = document.getElementById('worst-time');
        if (elTotal) elTotal.innerText = '0';
        if (elBest) elBest.innerText = '--:--';
        if (elWorst) elWorst.innerText = '--:--';
        return;
    }

    let totalQueue = 0;
    let totalPay = 0;
    let totalPrep = 0;
    let totalFull = 0;
    let count = 0;

    let minTime = Infinity;
    let maxTime = 0;

    const safeSub = (a, b) => (a && b) ? (a - b) : 0;

    completedOrders.forEach(o => {
        const isDineIn = o.tag === 'Dine-in';
        let tFull, tQueue, tPay, tPrep;

        if (isDineIn) {
            tFull = safeSub(o.paid_at, o.entered_at);
            tQueue = safeSub(o.ordered_at, o.entered_at);
            tPrep = safeSub(o.delivered_at, o.ordered_at);
        } else {
            tFull = safeSub(o.delivered_at, o.entered_at);
            tQueue = safeSub(o.ordered_at, o.entered_at);
            tPrep = safeSub(o.delivered_at, o.ordered_at);
            tPay = 0;
        }

        if (tFull > 0) {
            totalFull += tFull;
            totalQueue += tQueue;
            totalPay += tPay;
            totalPrep += tPrep;
            count++;

            if (tFull < minTime) minTime = tFull;
            if (tFull > maxTime) maxTime = tFull;
        }
    });

    if (count > 0) {
        elAvgTime.innerText = formatTime(totalFull / count);

        const avgQueue = totalQueue / count;
        const avgPay = totalPay / count;
        const avgPrep = totalPrep / count;

        let bottle = 'Queue';
        let max = avgQueue;

        if (avgPay > max) { bottle = 'Payment'; max = avgPay; }
        if (avgPrep > max) { bottle = 'Prep'; max = avgPrep; }

        elBottleneck.innerText = bottle;

        // Update new stats
        const elTotal = document.getElementById('total-orders');
        const elBest = document.getElementById('best-time');
        const elWorst = document.getElementById('worst-time');

        if (elTotal) elTotal.innerText = count.toString();
        if (elBest) elBest.innerText = formatTime(minTime);
        if (elWorst) elWorst.innerText = formatTime(maxTime);
    }
};

// Live Timer Loop
setInterval(() => {
    const activeOrders = orders.filter(o => o.status !== 'done');
    const now = Date.now();
    activeOrders.forEach(o => {
        const el = document.getElementById(`timer-${o.id}`);
        if (el) {
            el.innerText = formatTime(now - o.entered_at);
        }
    });
}, 1000);

// Initial Render
render();
