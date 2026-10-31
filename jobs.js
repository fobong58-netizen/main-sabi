const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

// Keep these lists the same as on the other pages.
const TRADES = ["Plumber", "Electrician", "Carpenter", "Painter", "Tiler", "Welder", "AC technician", "Mechanic"];
const AREAS = ["Rumuokoro", "Rumuola", "Rumuigbo", "Eliozu", "Diobu", "GRA", "Trans Amadi", "Mile 1", "Mile 3", "Ada George", "Woji", "Choba"];

const tradeSelect = document.getElementById("trade");
const areaSelect = document.getElementById("area");
const queryInput = document.getElementById("query");
const countText = document.getElementById("count");
const list = document.getElementById("jobs");
const closeModal = document.getElementById("closeModal");
const closeForm = document.getElementById("close-form");
const closeMsg = document.getElementById("close-msg");

let allJobs = [];
let closingId = null;

// ---------- helpers ----------
function escapeText(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function fillSelect(select, items, firstLabel) {
    select.innerHTML = "<option>" + firstLabel + "</option>" +
        items.map(function (item) { return "<option>" + escapeText(item) + "</option>"; }).join("");
}

function whatsappNumber(phone) {
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("234") ? digits : "234" + digits.replace(/^0/, "");
}

function whatsappLink(job) {
    const text = "Hello, I saw your job \"" + job.title + "\" on sabi and I am interested.";
    return "https://wa.me/" + whatsappNumber(job.phone) + "?text=" + encodeURIComponent(text);
}

function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "Posted today";
    if (days === 1) return "Posted yesterday";
    return "Posted " + days + " days ago";
}

// ---------- load ----------
async function getJobs() {
    const { data, error } = await db.rpc("get_jobs");
    if (error) {
        console.error("Could not load jobs:", error.message);
        return null; // null = failed, [] = no jobs yet
    }
    return data;
}

// ---------- build cards ----------
function buildJob(job) {
    const callNumber = job.call_phone || job.phone;
    const pay = job.pay ? '<p class="pay">' + escapeText(job.pay) + "</p>" : "";
    const more = job.description.length > 180
        ? '<button type="button" class="link-btn more">Read more</button>'
        : "";

    return '<article class="card job">' +
        '<div class="job-head">' +
            "<div>" +
                "<h3>" + escapeText(job.title) + "</h3>" +
                '<p class="sub">' + escapeText(job.poster_name) + " &middot; " + escapeText(job.trade) + " in " + escapeText(job.area) + "</p>" +
            "</div>" +
            '<span class="badge type">' + escapeText(job.job_type) + "</span>" +
        "</div>" +
        pay +
        '<p class="job-desc">' + escapeText(job.description) + "</p>" +
        more +
        '<p class="muted">' + timeAgo(job.created_at) + "</p>" +
        '<div class="actions">' +
            '<a class="call-btn" href="tel:' + escapeText(callNumber) + '">Call</a>' +
            '<a class="wa-btn" href="' + whatsappLink(job) + '" target="_blank" rel="noopener">WhatsApp</a>' +
        "</div>" +
        '<button type="button" class="link-btn close-job" data-id="' + escapeText(String(job.id)) + '">Posted this job? Close it</button>' +
    "</article>";
}

// ---------- filter + show ----------
function showJobs() {
    const trade = tradeSelect.selectedIndex === 0 ? "" : tradeSelect.value;
    const area = areaSelect.selectedIndex === 0 ? "" : areaSelect.value;
    const query = queryInput.value.trim().toLowerCase();

    if (allJobs.length === 0) {
        countText.textContent = "Jobs";
        list.innerHTML = '<div class="empty"><h3>No jobs posted yet</h3><p>Need someone for a job? Post it and skilled workers will contact you.</p><a class="post-link" href="/post-job.html">Post a job</a></div>';
        return;
    }

    const found = allJobs.filter(function (job) {
        if (trade && job.trade !== trade) return false;
        if (area && job.area !== area) return false;
        if (query && !(job.title + " " + job.description + " " + job.poster_name).toLowerCase().includes(query)) return false;
        return true;
    });

    countText.textContent = found.length === 1 ? "1 job found" : found.length + " jobs found";

    if (found.length === 0) {
        list.innerHTML = '<div class="empty"><h3>No jobs match yet</h3><p>Try another trade or area, or clear the search.</p></div>';
        return;
    }
    list.innerHTML = found.map(buildJob).join("");
}

async function loadAndShow() {
    countText.textContent = "Loading jobs...";
    list.innerHTML = "";
    const jobs = await getJobs();
    if (jobs === null) {
        countText.textContent = "Jobs";
        list.innerHTML = '<div class="empty"><h3>Could not load jobs</h3><p>Check your internet connection and refresh the page.</p></div>';
        return;
    }
    allJobs = jobs;
    showJobs();
}

// ---------- events ----------
fillSelect(tradeSelect, TRADES, "Any trade");
fillSelect(areaSelect, AREAS, "Anywhere in Port Harcourt");

document.getElementById("filters").addEventListener("submit", function (e) { e.preventDefault(); });
tradeSelect.addEventListener("change", showJobs);
areaSelect.addEventListener("change", showJobs);
queryInput.addEventListener("input", showJobs);

list.addEventListener("click", function (event) {
    const moreBtn = event.target.closest(".more");
    if (moreBtn) {
        const desc = moreBtn.previousElementSibling;
        const open = desc.classList.toggle("open");
        moreBtn.textContent = open ? "Show less" : "Read more";
        return;
    }
    const closeBtn = event.target.closest(".close-job");
    if (closeBtn) {
        closingId = closeBtn.dataset.id;
        closeForm.reset();
        closeMsg.textContent = "";
        closeMsg.className = "msg";
        closeModal.showModal();
    }
});

document.getElementById("close-cancel").addEventListener("click", function () { closeModal.close(); });
closeModal.addEventListener("click", function (event) {
    if (event.target === closeModal) closeModal.close();
});

closeForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = closeForm.querySelector('button[type="submit"]');
    button.disabled = true;
    closeMsg.textContent = "Checking...";
    closeMsg.className = "msg success";

    const { data, error } = await db.rpc("close_job", {
        p_job_id: Number(closingId),
        p_pin: closeForm.elements["close-pin"].value
    });
    button.disabled = false;

    if (error || !data) {
        closeMsg.textContent = "Could not reach the server. Check your internet and try again.";
        closeMsg.className = "msg error";
        return;
    }
    if (!data.ok) {
        closeMsg.textContent = data.reason === "locked"
            ? "Too many wrong tries. Wait 15 minutes and try again."
            : "Wrong PIN, or this job is already closed.";
        closeMsg.className = "msg error";
        return;
    }
    closeModal.close();
    loadAndShow();
});

loadAndShow();