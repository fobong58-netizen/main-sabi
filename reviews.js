// Loaded AFTER script.js. Uses db, escapeText, profileBody from script.js.

const ratings = {}; // artisan id -> { avg, count }
let reviewWorker = null;

// ---------- small storage helpers (this device only) ----------
function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}
function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}
function deviceId() {
    let id = lsGet("sabi_device", "");
    if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "d" + Date.now() + Math.random().toString(36).slice(2);
        lsSet("sabi_device", id);
    }
    return id;
}
function hasContacted(id) { return lsGet("sabi_contacted", []).indexOf(String(id)) !== -1; }
function hasReviewed(id) { return lsGet("sabi_reviewed", []).indexOf(String(id)) !== -1; }
function remember(key, id) {
    const list = lsGet(key, []);
    if (list.indexOf(String(id)) === -1) { list.push(String(id)); lsSet(key, list); }
}

// ---------- ratings on cards ----------
async function loadRatings() {
    const { data, error } = await db.rpc("get_ratings");
    if (error) { console.error("Could not load ratings:", error.message); return; }
    data.forEach(function (r) {
        ratings[r.artisan_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
    });
}

function ratingLine(id) {
    const r = ratings[id];
    if (!r) return '<p class="rating muted">No reviews yet</p>';
    return '<p class="rating"><span class="star">★</span> <strong>' + r.avg.toFixed(1) + '</strong> ' +
        '<span class="muted">(' + r.count + (r.count === 1 ? " review" : " reviews") + ')</span></p>';
}

// ---------- track who contacted a worker ----------
document.addEventListener("click", function (event) {
    const link = event.target.closest("[data-contact]");
    if (!link) return;
    const id = link.dataset.contact;
    remember("sabi_contacted", id);
    if (reviewWorker && String(reviewWorker.id) === id) renderReviewForm();
});

// ---------- reviews inside the profile popup ----------
function renderReviewSection(worker) {
    reviewWorker = worker;
    const box = document.createElement("div");
    box.className = "pm-section";
    box.innerHTML = '<h4>Reviews</h4><div id="reviewSummary"></div><div id="reviewFormBox"></div><ul class="review-list" id="reviewList"></ul>';
    profileBody.appendChild(box);
    renderReviewForm();
    loadReviews(worker.id);
}

function renderReviewForm() {
    const box = document.getElementById("reviewFormBox");
    if (!box || !reviewWorker) return;
    const id = reviewWorker.id;

    if (hasReviewed(id)) {
        box.innerHTML = '<p class="hint-text">Thank you. You have reviewed this worker.</p>';
        return;
    }
    if (!hasContacted(id)) {
        box.innerHTML = '<p class="hint-text">Called or messaged this worker? Tap Call or WhatsApp below, then come back here to leave a review.</p>';
        return;
    }
    let stars = "";
    for (let i = 5; i >= 1; i--) {
        stars += '<input type="radio" name="rating" id="star' + i + '" value="' + i + '" required>' +
                 '<label for="star' + i + '" title="' + i + ' star' + (i > 1 ? "s" : "") + '">★</label>';
    }
    box.innerHTML =
        '<form class="review-form" id="reviewForm">' +
            '<p class="rf-title">How was the service?</p>' +
            '<div class="star-input" role="radiogroup" aria-label="Rating">' + stars + '</div>' +
            '<input type="text" name="reviewer" placeholder="Your name" maxlength="60" required>' +
            '<textarea name="comment" rows="3" maxlength="400" placeholder="Tell others about the work (optional)"></textarea>' +
            '<p class="msg" id="reviewMsg" role="status"></p>' +
            '<button type="submit" class="view-btn">Submit review</button>' +
        '</form>';
}

async function loadReviews(id) {
    const list = document.getElementById("reviewList");
    const summary = document.getElementById("reviewSummary");
    if (!list) return;
    const { data, error } = await db.rpc("get_reviews", { p_artisan_id: id });
    if (!document.getElementById("reviewList") || String(reviewWorker.id) !== String(id)) return;
    if (error) { summary.innerHTML = '<p class="hint-text">Could not load reviews.</p>'; return; }

    if (data.length === 0) {
        summary.innerHTML = '<p class="hint-text">No reviews yet.</p>';
        list.innerHTML = "";
        return;
    }
    const avg = data.reduce(function (s, r) { return s + r.rating; }, 0) / data.length;
    summary.innerHTML = '<p class="rating"><span class="star">★</span> <strong>' + avg.toFixed(1) +
        '</strong> <span class="muted">(' + data.length + (data.length === 1 ? " review" : " reviews") + ')</span></p>';
    list.innerHTML = data.map(function (r) {
        const date = new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
        return '<li class="review">' +
            '<div class="review-top"><strong>' + escapeText(r.reviewer_name) + '</strong>' +
            '<span class="star" aria-label="' + r.rating + ' out of 5">' + "★".repeat(r.rating) + "☆".repeat(5 - r.rating) + '</span></div>' +
            (r.comment ? '<p>' + escapeText(r.comment) + '</p>' : "") +
            '<p class="muted review-date">' + date + '</p></li>';
    }).join("");
}

profileBody.addEventListener("submit", async function (event) {
    if (event.target.id !== "reviewForm") return;
    event.preventDefault();
    const form = event.target;
    const msg = document.getElementById("reviewMsg");
    const button = form.querySelector("button[type=submit]");
    const id = reviewWorker.id;

    button.disabled = true;
    msg.textContent = "Saving...";
    msg.className = "msg success";

    const { data, error } = await db.rpc("submit_review", {
        p_artisan_id: id,
        p_device_id: deviceId(),
        p_name: form.reviewer.value.trim(),
        p_rating: Number(form.rating.value),
        p_comment: form.comment.value.trim()
    });
    button.disabled = false;

    if (error || !data) {
        msg.textContent = "Could not save your review. Check your internet and try again.";
        msg.className = "msg error";
        return;
    }
    if (!data.ok) {
        const reasons = {
            duplicate: "You have already reviewed this worker.",
            limit: "Too many reviews today. Try again tomorrow.",
            badname: "Enter your name.",
            badrating: "Choose a star rating."
        };
        if (data.reason === "duplicate") remember("sabi_reviewed", id);
        msg.textContent = reasons[data.reason] || "Your review could not be saved.";
        msg.className = "msg error";
        if (data.reason === "duplicate") renderReviewForm();
        return;
    }
    remember("sabi_reviewed", id);
    await loadRatings();
    renderReviewForm();
    loadReviews(id);
    showWorkers(); // refresh the star line on the cards
});