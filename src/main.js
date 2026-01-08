import './style.css';

let orders = JSON.parse(localStorage.getItem('espresso-orders') || '[]');
const container = document.getElementById('orders-container');
const btnAdd = document.getElementById('btn-customer-in');
const elWarning = document.getElementById('limit-warning');

// History & Tabs
const historyStd = document.getElementById('history-container-std');
const historyDine = document.getElementById('history-container-dinein');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

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

// Generate ID
const getNextId = () => {
    if (orders.length === 0) return 1;
    const max = orders.reduce((m, o) => Math.max(m, o.id), 0);
    return max + 1;
};

// Check Limit
const checkLimit = () => {
    const activeCount = orders.filter(o => o.status !== 'done').length;
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
    btnAdd.addEventListener('click', () => {
        const activeCount = orders.filter(o => o.status !== 'done').length;
        if (activeCount >= 5) return;

        const order = {
            id: getNextId(),
            name: '',
            tag: 'Dine-in', // Default to Dine-in
            enteredAt: Date.now(),
            orderedAt: null,
            paidAt: null,
            deliveredAt: null,
            status: 'queue'
        };
        orders.push(order);
        save();
        render();
    });
}

const save = () => {
    localStorage.setItem('espresso-orders', JSON.stringify(orders));
};

const updateName = (id, newName) => {
    const order = orders.find(o => o.id === id);
    if (order) {
        order.name = newName;
        save();
    }
}

const updateTag = (id, newTag) => {
    const order = orders.find(o => o.id === id);
    if (order && order.status === 'queue') {
        order.tag = newTag;
        save();
        render();
    }
}

// DELETE/CANCEL ORDER
const cancelOrder = (id) => {
    if (!confirm('Cancel this order?')) return;
    orders = orders.filter(o => o.id !== id);
    save();
    render();
}

const formatTime = (ms) => {
    if (isNaN(ms)) return "00:00";
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 1000 / 60));
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'queue': return 'Waiting to Order';
        case 'payment': return 'Expected Payment';
        case 'prep': return 'Preparing';
        case 'served': return 'Served / Eating';
        case 'done': return 'Completed';
    }
};

// --- CORE LOGIC: ADVANCE ORDER ---
const advanceOrder = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const now = Date.now();
    const isDineIn = order.tag === 'Dine-in';

    if (order.status === 'queue') {
        order.orderedAt = now;
        if (isDineIn) {
            order.status = 'prep'; // Queue -> Prep
        } else {
            order.status = 'payment'; // Queue -> Payment
        }
    }
    else if (order.status === 'payment') {
        order.paidAt = now;
        order.status = 'prep';
    }
    else if (order.status === 'prep') {
        order.deliveredAt = now;
        if (isDineIn) {
            order.status = 'served';
        } else {
            order.status = 'done';
        }
    }
    else if (order.status === 'served') {
        order.paidAt = now;
        order.status = 'done';
    }

    save();
    render();
};

const render = () => {
    checkLimit();
    renderActive();
    renderHistory();
    updateStats();
};

const renderActive = () => {
    const activeOrders = orders.filter(o => o.status !== 'done').sort((a, b) => a.enteredAt - b.enteredAt);

    if (!container) return;
    container.innerHTML = '';

    if (activeOrders.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No active orders. Tap "+" when a customer enters.</p>
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
            } else if (order.status === 'payment') {
                btnText = 'Mark Paid';
            } else if (order.status === 'prep') {
                btnText = isDineIn ? 'Mark Served' : 'Mark Served & Done';
                btnClass = isDineIn ? 'action-btn' : 'action-btn finish';
            } else if (order.status === 'served') {
                btnText = 'Mark Paid & Done';
                btnClass = 'action-btn finish';
            }

            // Determine Progress Dots
            let dot1Idx = 0, dot2Idx = 0, dot3Idx = 0;

            if (isDineIn) {
                if (order.status === 'queue') { dot1Idx = 1; }
                else if (order.status === 'prep') { dot1Idx = 2; dot2Idx = 1; }
                else if (order.status === 'served') { dot1Idx = 2; dot2Idx = 2; dot3Idx = 1; }
            } else {
                if (order.status === 'queue') { dot1Idx = 1; }
                else if (order.status === 'payment') { dot1Idx = 2; dot2Idx = 1; }
                else if (order.status === 'prep') { dot1Idx = 2; dot2Idx = 2; dot3Idx = 1; }
            }

            const getDotClass = (idx) => {
                if (idx === 2) return 'step-dot completed';
                if (idx === 1) return 'step-dot active';
                return 'step-dot';
            }

            const t1 = 'Queue';
            const t2 = isDineIn ? 'Prep' : 'Pay';
            const t3 = isDineIn ? 'Served' : 'Prep';

            const tags = ['Dine-in', 'Takeaway', 'Delivery', 'Pickup'];
            const options = tags.map(t => `<option value="${t}" ${order.tag === t ? 'selected' : ''}>${t}</option>`).join('');

            const isSelectDisabled = order.status !== 'queue';

            // Cancel button only if status is queue
            const cancelBtnHTML = order.status === 'queue'
                ? `<button class="btn-cancel" data-cancel-id="${order.id}" title="Cancel Order">✕</button>`
                : '';

            card.innerHTML = `
                <div class="order-header">
                    <div class="order-header-left">
                        <span class="order-id">#${order.id}</span>
                        <input type="text" class="input-name" placeholder="Name" value="${order.name || ''}" data-id="${order.id}">
                        <select class="tag-select" data-id="${order.id}" ${isSelectDisabled ? 'disabled' : ''}>${options}</select>
                    </div>
                    <div class="order-header-right">
                        <span class="total-time" id="timer-${order.id}">00:00</span>
                        ${cancelBtnHTML}
                    </div>
                </div>
                <div class="progress-track">
                    <div class="${getDotClass(dot1Idx)}" title="${t1}"></div>
                    <div class="${getDotClass(dot2Idx)}" title="${t2}"></div>
                    <div class="${getDotClass(dot3Idx)}" title="${t3}"></div>
                </div>
                <div class="current-action">
                    <span class="status-label">${getStatusLabel(order.status)}</span>
                    <button class="${btnClass}" data-btn-id="${order.id}">
                        ${btnText}
                    </button>
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
        });
    }
};

const renderHistory = () => {
    if (!historyStd || !historyDine) return;

    // Get completed orders
    const history = orders.filter(o => o.status === 'done').sort((a, b) => b.deliveredAt - a.deliveredAt);

    historyStd.innerHTML = '';
    historyDine.innerHTML = '';

    const createHistoryItem = (order) => {
        const isDineIn = order.tag === 'Dine-in';
        const safeSub = (a, b) => (a && b) ? (a - b) : 0;

        // Calculate durations
        let totalTime = 0, queueTime = 0, payTime = 0, prepTime = 0;

        if (isDineIn) {
            totalTime = safeSub(order.paidAt, order.enteredAt);
            queueTime = safeSub(order.orderedAt, order.enteredAt);
            prepTime = safeSub(order.deliveredAt, order.orderedAt);
            payTime = safeSub(order.paidAt, order.deliveredAt);
        } else {
            totalTime = safeSub(order.deliveredAt, order.enteredAt);
            queueTime = safeSub(order.orderedAt, order.enteredAt);
            payTime = safeSub(order.paidAt, order.orderedAt);
            prepTime = safeSub(order.deliveredAt, order.paidAt);
        }

        const pQueue = (queueTime / totalTime) * 100;
        const pPay = (payTime / totalTime) * 100;
        const pPrep = (prepTime / totalTime) * 100;

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
                    <span class="history-tag">${order.tag || 'Dine-in'}</span>
                </div>
                <div class="history-stats">
                    <span class="stat-pill" title="Total Time">⏱ ${formatTime(totalTime)}</span>
                </div>
            </div>
            <div class="breakdown-bar">
                ${barHTML}
            </div>
        `;
        return div;
    };

    const stdHistory = history.filter(h => h.tag !== 'Dine-in');
    const dineHistory = history.filter(h => h.tag === 'Dine-in');

    const empty = '<p class="empty-text" style="padding:1rem; opacity:0.6;">No history yet.</p>';

    if (stdHistory.length === 0) historyStd.innerHTML = empty;
    else stdHistory.forEach(order => historyStd.appendChild(createHistoryItem(order)));

    if (dineHistory.length === 0) historyDine.innerHTML = empty;
    else dineHistory.forEach(order => historyDine.appendChild(createHistoryItem(order)));
};

const updateStats = () => {
    if (!elAvgTime || !elBottleneck) return;

    // Filter completed orders based on current tab
    // currentTab can be 'std' (Standard) or 'dinein'
    const completedOrders = orders.filter(o => {
        if (o.status !== 'done') return false;

        if (currentTab === 'dinein') {
            return o.tag === 'Dine-in';
        } else {
            return o.tag !== 'Dine-in';
        }
    });

    if (completedOrders.length === 0) {
        elAvgTime.innerText = '--:--';
        elBottleneck.innerText = 'No Data';
        return;
    }

    let totalQueue = 0;
    let totalPay = 0;
    let totalPrep = 0;
    let totalFull = 0;
    let count = 0;

    const safeSub = (a, b) => (a && b) ? (a - b) : 0;

    completedOrders.forEach(o => {
        const isDineIn = o.tag === 'Dine-in';
        let tFull, tQueue, tPay, tPrep;

        if (isDineIn) {
            tFull = safeSub(o.paidAt, o.enteredAt);
            tQueue = safeSub(o.orderedAt, o.enteredAt);
            tPrep = safeSub(o.deliveredAt, o.orderedAt);
            tPay = safeSub(o.paidAt, o.deliveredAt);
        } else {
            tFull = safeSub(o.deliveredAt, o.enteredAt);
            tQueue = safeSub(o.orderedAt, o.enteredAt);
            tPay = safeSub(o.paidAt, o.orderedAt);
            tPrep = safeSub(o.deliveredAt, o.paidAt);
        }

        if (tFull > 0) {
            totalFull += tFull;
            totalQueue += tQueue;
            totalPay += tPay;
            totalPrep += tPrep;
            count++;
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
    }
};

// Live Timer Loop
setInterval(() => {
    const activeOrders = orders.filter(o => o.status !== 'done');
    const now = Date.now();
    activeOrders.forEach(o => {
        const el = document.getElementById(`timer-${o.id}`);
        if (el) {
            el.innerText = formatTime(now - o.enteredAt);
        }
    });
}, 1000);

// Initial Render
render();
