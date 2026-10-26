const form = document.getElementById("listed-form");
const msg = document.getElementById("msg");

// ---------- storage ----------
// getWorkers and saveWorker are the only two functions that touch storage.
// When you add a real database, only these two need to change.
function getWorkers() {
    try {
        return JSON.parse(localStorage.getItem("sabi-workers")) || [];
    } catch (error) {
        return [];
    }
}

function saveWorker(worker) {
    const workers = getWorkers();
    workers.push(worker);
    localStorage.setItem("sabi-workers", JSON.stringify(workers));
}

// ---------- helpers ----------
function digitsOnly(phone) {
    return phone.replace(/\D/g, "").replace(/^234/, "0");
}

function showMessage(text, isError) {
    msg.textContent = text;
    msg.className = isError ? "msg error" : "msg success";
}

// ---------- submit ----------
form.addEventListener("submit", function (event) {
    event.preventDefault();

    const skills = form.skills.value
        .split(",")
        .map(function (skill) { return skill.trim(); })
        .filter(function (skill) { return skill !== ""; });

    if (skills.length === 0) {
        showMessage("Add at least one skill.", true);
        return;
    }
    if (skills.length > 6) {
        showMessage("You can add up to 6 skills. Remove " + (skills.length - 6) + ".", true);
        return;
    }

    const phone = digitsOnly(form.phone.value);
    const alreadyListed = getWorkers().some(function (worker) {
        return digitsOnly(worker.phone) === phone;
    });
    if (alreadyListed) {
        showMessage("This number is already listed.", true);
        return;
    }

    saveWorker({
        id: Date.now(),
        name: form.full_name.value.trim(),
        trade: form.trade.value,
        area: form.area.value,
        phone: form.phone.value.trim(),
        callPhone: form.phone_call.value.trim(),
        years: Number(form.experience.value),
        skills: skills,
        about: form.about.value.trim(),
        verified: false
    });

    form.reset();
    showMessage("Your profile is created. Customers can now find you on the find a service page.", false);
});