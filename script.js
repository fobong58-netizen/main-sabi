const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

// ---------- page elements ----------
const findForm = document.getElementById("find");
const tradeSelect = document.getElementById("trade");
const areaSelect = document.getElementById("area");
const skillInput = document.getElementById("skill");
const sortSelect = document.getElementById("sort");
const countText = document.getElementById("count");
const results = document.getElementById("results");

const avatarColors = ["#2a3d99", "#0b6e44", "#9b3d12", "#6b2f8f", "#14707a", "#a12a4d"];

// ---------- storage ----------
// Workers now live in the Supabase "artisans" table, so every visitor sees the same list.
// They are fetched once when the page loads and kept here, so typing in the
// filters does not hit the database on every keystroke.
let allWorkers = [];

async function getWorkers() {
    const { data, error } = await db
        .from("artisans")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Could not load artisans:", error.message);
        return null; // null means "failed", [] means "nobody listed yet"
    }

    // Turn database column names into the names the rest of this file uses.
    return data.map(function (row) {
        return {
            id: row.id,
            name: row.name || "",
            trade: row.trade || "",
            area: row.area || "",
            skills: row.skills || [],
            years: row.years || 0,
            about: row.about || "",
            phone: row.phone || "",
            callPhone: row.call_phone || "",
            photo: row.photo_url || "",
            verified: row.verified === true
        };
    });
}

// ---------- helpers ----------
function escapeText(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

function whatsappNumber(phone) {
    // 08012345678 or +2348012345678 -> 2348012345678
    const digits = phone.replace(/\D/g, "");
    return digits.startsWith("234") ? digits : "234" + digits.replace(/^0/, "");
}

// ---------- filter + sort ----------
function filterWorkers() {
    const trade = tradeSelect.selectedIndex === 0 ? "" : tradeSelect.value;
    const area = areaSelect.selectedIndex === 0 ? "" : areaSelect.value;
    const query = skillInput.value.trim().toLowerCase();

    const list = allWorkers.filter(function (worker) {
        if (trade && worker.trade !== trade) return false;
        if (area && worker.area !== area) return false;
        if (query) {
            const text = (worker.name + " " + worker.skills.join(" ")).toLowerCase();
            if (!text.includes(query)) return false;
        }
        return true;
    });

    if (sortSelect.value === "experience") {
        list.sort(function (a, b) { return b.years - a.years; });
    } else {
        list.sort(function (a, b) { return b.id - a.id; });
    }
    return list;
}

// ---------- build the cards ----------
function buildCard(worker, index) {
    const color = avatarColors[index % avatarColors.length];
    const badge = worker.verified
        ? '<span class="badge ok">Verified</span>'
        : '<span class="badge pending">Verification pending</span>';
    const chips = worker.skills.map(function (skill) {
        return "<li>" + escapeText(skill) + "</li>";
    }).join("");
    const about = worker.about
        ? '<p class="about">' + escapeText(worker.about) + "</p>"
        : "";
    const photoOk = worker.photo.indexOf("https://") === 0;
    const avatarInner = photoOk
        ? '<img src="' + worker.photo.replace(/"/g, "%22") + '" alt="" loading="lazy">'
        : escapeText(getInitials(worker.name));
    const callNumber = worker.callPhone || worker.phone;
    const yearsText = worker.years === 1 ? "1 year" : worker.years + " years";

    return '<article class="card">' +
        '<div class="card-head">' +
            '<div class="avatar" style="background-color:' + color + '">' + avatarInner + '</div>' +
            '<div class="card-id">' +
                '<h3>' + escapeText(worker.name) + '</h3>' +
                '<p class="sub">' + escapeText(worker.trade) + ' in ' + escapeText(worker.area) + '</p>' +
            '</div>' +
            badge +
        '</div>' +
        '<p class="muted">' + yearsText + ' of experience</p>' +
        '<ul class="chips">' + chips + '</ul>' +
        about +
        '<div class="actions">' +
            '<a class="call-btn" href="tel:' + escapeText(callNumber) + '">Call</a>' +
            '<a class="wa-btn" href="https://wa.me/' + whatsappNumber(worker.phone) + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '</div>' +
    '</article>';
}

// ---------- show the results ----------
function showWorkers() {
    const list = filterWorkers();

    if (allWorkers.length === 0) {
        countText.textContent = "Workers";
        results.innerHTML = '<div class="empty"><h3>No one is listed yet</h3><p>Be the first. Create your profile and customers will find you here.</p><a class="empty-link" href="/listed.html">Get listed free</a></div>';
        return;
    }

    countText.textContent = list.length === 1 ? "1 worker found" : list.length + " workers found";

    if (list.length === 0) {
        results.innerHTML = '<div class="empty"><h3>No workers match yet</h3><p>Try another trade or area, or clear the name or skill.</p></div>';
        return;
    }

    results.innerHTML = list.map(buildCard).join("");
}

// ---------- load from the database, then show ----------
async function loadAndShow() {
    countText.textContent = "Loading workers...";
    results.innerHTML = "";

    const workers = await getWorkers();

    if (workers === null) {
        countText.textContent = "Workers";
        results.innerHTML = '<div class="empty"><h3>Could not load workers</h3><p>Check your internet connection and refresh the page.</p></div>';
        return;
    }

    allWorkers = workers;
    showWorkers();
}

// ---------- events ----------
findForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showWorkers();
    document.querySelector(".profile-space").scrollIntoView({ behavior: "smooth" });
});

tradeSelect.addEventListener("change", showWorkers);
areaSelect.addEventListener("change", showWorkers);
sortSelect.addEventListener("change", showWorkers);
skillInput.addEventListener("input", showWorkers);

loadAndShow();