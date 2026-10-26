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
// Workers come from profiles created on the get listed page.
// This is the only function that reads them, so it is the one to swap for a database later.
function getWorkers() {
    try {
        return JSON.parse(localStorage.getItem("sabi-workers")) || [];
    } catch (error) {
        return [];
    }
}

// ---------- helpers ----------
function escapeText(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    const parts = name.trim().split(" ");
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

    const list = getWorkers().filter(function (worker) {
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
    const callNumber = worker.callPhone || worker.phone;
    const yearsText = worker.years === 1 ? "1 year" : worker.years + " years";

    return '<article class="card">' +
        '<div class="card-head">' +
            '<div class="avatar" style="background-color:' + color + '">' + escapeText(getInitials(worker.name)) + '</div>' +
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
    const total = getWorkers().length;

    if (total === 0) {
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

showWorkers();