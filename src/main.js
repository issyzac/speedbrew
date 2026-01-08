import './style.css';

let orders = JSON.parse(localStorage.getItem('espresso-orders') || '[]');
const container = document.getElementById('orders-container');
const btnAdd = document.getElementById('btn-customer-in');
const elWarning = document.getElementById('limit-warning');

// NEW: History Container
const historyContainer = document.getElementById('history-container');

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
            name: '', // Name field
            tag: 'Dine-in', // Default tag
            enteredAt: Date.now(),
            orderedAt: null,
            paidAt: null,
            deliveredAt: null,
            status: 'queue' // queue, payment, prep, done
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
    if (order) {
        order.tag = newTag;
        save();
    }
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
        case 'payment': return 'Ordering/Paying';
        case 'prep': return 'Preparing';
        case 'done': return 'Served';
    }
};

const advanceOrder = (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const now = Date.now();
    if (order.status === 'queue') {
        order.orderedAt = now;
        order.status = 'payment';
    } else if (order.status === 'payment') {
        order.paidAt = now;
        order.status = 'prep';
    } else if (order.status === 'prep') {
        order.deliveredAt = now;
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

            // Calc current stage for UI
            const isQueue = order.status === 'queue' || order.orderedAt;
            const isPay = order.status === 'payment' || order.paidAt;
            const isPrep = order.status === 'prep' || order.deliveredAt;

            let btnText = 'Mark Ordered';
            if (order.status === 'payment') btnText = 'Mark Paid';
            if (order.status === 'prep') btnText = 'Complete Order';

            const btnClass = order.status === 'prep' ? 'action-btn finish' : 'action-btn';

            // Select Options
            const tags = ['Dine-in', 'Takeaway', 'Delivery', 'Pickup'];
            const options = tags.map(t => `<option value="${t}" ${order.tag === t ? 'selected' : ''}>${t}</option>`).join('');

            card.innerHTML = `
                <div class="order-header">
                    <div class="order-header-left">
                        <span class="order-id">#${order.id}</span>
                        <input type="text" class="input-name" placeholder="Name" value="${order.name || ''}" data-id="${order.id}">
                        <select class="tag-select" data-id="${order.id}">${options}</select>
                    </div>
                    <span class="total-time" id="timer-${order.id}">00:00</span>
                </div>
                <div class="progress-track">
                    <div class="step-dot ${isQueue ? 'completed' : ''} ${order.status === 'queue' ? 'active' : ''}" title="Queue"></div>
                    <div class="step-dot ${isPay ? 'completed' : ''} ${order.status === 'payment' ? 'active' : ''}" title="Payment"></div>
                    <div class="step-dot ${isPrep ? 'completed' : ''} ${order.status === 'prep' ? 'active' : ''}" title="Prep"></div>
                </div>
                <div class="current-action">
                    <span class="status-label">${getStatusLabel(order.status)}</span>
                    <button class="${btnClass}" data-btn-id="${order.id}">
                        ${btnText}
                    </button>
                </div>
            `;
            container.appendChild(card);

            // Event Listeners
            const btn = card.querySelector(`button[data-btn-id="${order.id}"]`);
            btn.addEventListener('click', () => advanceOrder(order.id));

            const input = card.querySelector('input.input-name');
            input.addEventListener('input', (e) => updateName(order.id, e.target.value));

            const select = card.querySelector('select.tag-select');
            select.addEventListener('change', (e) => updateTag(order.id, e.target.value));
        });
    }
};

const renderHistory = () => {
    if (!historyContainer) return;

    // Add Legend
    const getLegend = () => `
        <div class="legend-container">
            <div class="legend-item"><div class="legend-dot seg-queue"></div> Queue</div>
            <div class="legend-item"><div class="legend-dot seg-pay"></div> Pay</div>
            <div class="legend-item"><div class="legend-dot seg-prep"></div> Prep</div>
        </div>
    `;

    // Get completed orders, sorted newest first
    const history = orders.filter(o => o.status === 'done').sort((a, b) => b.deliveredAt - a.deliveredAt);
    historyContainer.innerHTML = '';

    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="empty-text" style="text-align:center; color: var(--text-muted); opacity:0.6;">No history yet.</p>';
        return;
    }

    // Add legend at top of history
    historyContainer.innerHTML = getLegend();

    history.forEach(order => {
        const totalTime = order.deliveredAt - order.enteredAt;
        const queueTime = (order.orderedAt - order.enteredAt);
        const payTime = (order.paidAt - order.orderedAt);
        const prepTime = (order.deliveredAt - order.paidAt);

        const pQueue = (queueTime / totalTime) * 100;
        const pPay = (payTime / totalTime) * 100;
        const pPrep = (prepTime / totalTime) * 100;

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
            <div class="breakdown-bar" title="Queue: ${formatTime(queueTime)}, Pay: ${formatTime(payTime)}, Prep: ${formatTime(prepTime)}">
                <div class="breakdown-segment seg-queue" style="width: ${pQueue}%"></div>
                <div class="breakdown-segment seg-pay" style="width: ${pPay}%"></div>
                <div class="breakdown-segment seg-prep" style="width: ${pPrep}%"></div>
            </div>
        `;
        historyContainer.appendChild(div);
    });
};

const updateStats = () => {
    if (!elAvgTime || !elBottleneck) return;

    // Calculate stats based on ALL orders (including history)
    const completedOrders = orders.filter(o => o.status === 'done' || o.deliveredAt);

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

    completedOrders.forEach(o => {
        if (o.enteredAt && o.deliveredAt) {
            totalFull += (o.deliveredAt - o.enteredAt);
            count++;

            // Bottleneck breakdown
            if (o.orderedAt) totalQueue += (o.orderedAt - o.enteredAt);
            if (o.paidAt && o.orderedAt) totalPay += (o.paidAt - o.orderedAt);
            if (o.deliveredAt && o.paidAt) totalPrep += (o.deliveredAt - o.paidAt);
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
