const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

// Keep these lists the same as on the get listed page.
const TRADES = ["Plumber", "Electrician", "Carpenter", "Painter", "Tiler", "Welder", "AC technician", "Mechanic"];
const AREAS = ["Rumuokoro", "Rumuola", "Rumuigbo", "Eliozu", "Diobu", "GRA", "Trans Amadi", "Mile 1", "Mile 3", "Ada George", "Woji", "Choba", "Alakahia"];
const PHOTO_BUCKET = "profile-photos";
const MAX_PHOTO_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const loginForm = document.getElementById("login-form");
const loginMsg = document.getElementById("login-msg");
const editForm = document.getElementById("edit-form");
const editMsg = document.getElementById("edit-msg");
const intro = document.getElementById("intro");
const who = document.getElementById("who");
const statusBadge = document.getElementById("status-badge");
const waLine = document.getElementById("wa-line");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");
const introText = intro.textContent;

// Your Paystack PUBLIC key (pk_test_... while testing, pk_live_... when real). Never put the secret key here.
const PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_ME";

// phone and PIN are kept only in memory while this page is open
let session = null;

// ---------- helpers ----------
function digitsOnly(phone) {
    return phone.replace(/\D/g, "").replace(/^234/, "0");
}

function showMessage(el, text, isError) {
    el.textContent = text;
    el.className = text ? (isError ? "msg error" : "msg success") : "msg";
}

function fillSelect(select, list, current) {
    select.innerHTML = '<option value="" disabled>Choose</option>';
    const items = current && list.indexOf(current) === -1 ? list.concat(current) : list;
    items.forEach(function (value) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
    select.value = current || "";
}

function setPreview(url) {
    photoPreview.style.backgroundImage = url ? 'url("' + url + '")' : "";
    photoPreview.classList.toggle("has-photo", Boolean(url));
}

function compressPhoto(file) {
    return new Promise(function (resolve) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
            const scale = Math.min(1, 600 / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(function (blob) { resolve(blob); }, "image/jpeg", 0.85);
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
}

async function uploadPhoto(blob, phone) {
    const path = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + ".jpg";
    const { error } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
        console.error("Could not upload photo:", error.message);
        return null;
    }
    return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- show / hide ----------
function showProfile(p) {
    who.textContent = p.name;
    statusBadge.textContent = p.verified ? "Verified" : "Verification pending";
    statusBadge.className = "badge " + (p.verified ? "ok" : "pending");
    waLine.textContent = "WhatsApp number: " + p.phone + " (this cannot be changed)";

    editForm.full_name.value = p.name || "";
    fillSelect(editForm.trade, TRADES, p.trade);
    fillSelect(editForm.area, AREAS, p.area);
    editForm.phone_call.value = p.call_phone || "";
    editForm.experience.value = p.years || 0;
    editForm.skills.value = (p.skills || []).join(", ");
    editForm.about.value = p.about || "";
    photoInput.value = "";
    setPreview(p.photo_url && p.photo_url.indexOf("https://") === 0 ? p.photo_url : "");

    showMessage(payMsg, "", false);
    loadListing();

    intro.textContent = "Check your details and change anything that is out of date.";
    loginForm.classList.add("is-hidden");
    editForm.classList.remove("is-hidden");
    showMessage(editMsg, "", false);
}

function logout(message) {
    session = null;
    editForm.reset();
    loginForm.reset();
    setPreview("");
    intro.textContent = introText;
    editForm.classList.add("is-hidden");
    loginForm.classList.remove("is-hidden");
    showMessage(loginMsg, message || "", false);
}

document.getElementById("logout").addEventListener("click", function () { logout(""); });

// ---------- log in ----------
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const phone = digitsOnly(loginForm.phone.value);
    const pin = loginForm.pin.value;

    button.disabled = true;
    showMessage(loginMsg, "Checking...", false);
    const { data, error } = await db.rpc("get_my_profile", { p_phone: phone, p_pin: pin });
    button.disabled = false;

    if (error || !data) {
        console.error("Login failed:", error && error.message);
        showMessage(loginMsg, "Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            locked: "Too many wrong tries. Wait 15 minutes and try again.",
            nopin: "This profile has no PIN yet. Tap \"Forgot your PIN, or no PIN yet?\" below to set one.",
            invalid: "Wrong phone number or PIN."
        };
        showMessage(loginMsg, reasons[data.reason] || reasons.invalid, true);
        return;
    }
    session = { phone: phone, pin: pin };
    showProfile(data.profile);
});

// ---------- new picture preview ----------
photoInput.addEventListener("change", function () {
    const file = photoInput.files[0];
    if (!file) return;
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
        photoInput.value = "";
        showMessage(editMsg, "Profile picture must be a JPG, PNG or WebP image.", true);
        return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        photoInput.value = "";
        showMessage(editMsg, "That picture is too big. Choose one under " + MAX_PHOTO_MB + "MB.", true);
        return;
    }
    showMessage(editMsg, "", false);
    setPreview(URL.createObjectURL(file));
});

// ---------- save changes ----------
editForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!session) return;

    const skills = editForm.skills.value
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
    if (skills.length === 0) { showMessage(editMsg, "Add at least one skill.", true); return; }
    if (skills.length > 6) { showMessage(editMsg, "You can add up to 6 skills. Remove " + (skills.length - 6) + ".", true); return; }

    const button = editForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(editMsg, "Saving...", false);

    let photoUrl = null;
    const file = photoInput.files[0];
    if (file) {
        const blob = await compressPhoto(file);
        photoUrl = blob ? await uploadPhoto(blob, session.phone) : null;
        if (!photoUrl) {
            showMessage(editMsg, "Could not upload your picture. Try another photo or check your internet.", true);
            button.disabled = false;
            return;
        }
    }

    const years = Number(editForm.experience.value);
    const { data, error } = await db.rpc("update_my_profile", {
        p_phone: session.phone,
        p_pin: session.pin,
        p_name: editForm.full_name.value.trim(),
        p_trade: editForm.trade.value,
        p_area: editForm.area.value,
        p_call_phone: editForm.phone_call.value.trim(),
        p_years: isNaN(years) ? 0 : years,
        p_skills: skills,
        p_about: editForm.about.value.trim(),
        p_photo_url: photoUrl
    });
    button.disabled = false;

    if (error || !data) {
        console.error("Could not save:", error && error.message);
        showMessage(editMsg, "Something went wrong and your changes were not saved. Please try again.", true);
        return;
    }
    if (!data.ok) {
        logout("Please log in again to save your changes.");
        return;
    }

    who.textContent = editForm.full_name.value.trim();
    if (photoUrl) { photoInput.value = ""; setPreview(photoUrl); }
    showMessage(editMsg, "Your changes are saved. Customers will see them on the find a service page.", false);
});

// ---------- forgot PIN / first PIN for old profiles ----------
// Put the WhatsApp number that artisans should message, in international format (no + or spaces).
const SUPPORT_WHATSAPP = "2347062812735";

const resetForm = document.getElementById("reset-form");
const resetMsg = document.getElementById("reset-msg");
const codeBox = document.getElementById("code-box");
const codeValue = document.getElementById("code-value");

function showOnly(card) {
    [loginForm, resetForm, editForm, codeBox].forEach(function (c) {
        c.classList.toggle("is-hidden", c !== card);
    });
}

document.getElementById("show-reset").addEventListener("click", function () {
    resetForm.phone.value = loginForm.phone.value;
    showMessage(resetMsg, "", false);
    showOnly(resetForm);
});

document.getElementById("back-login").addEventListener("click", function () {
    showOnly(loginForm);
});

// builds the WhatsApp link with the typed phone number when tapped
document.getElementById("wa-help").addEventListener("click", function () {
    const text = "Hello sabi, I need a code to set or reset my PIN. My number is " + (resetForm.phone.value || "(your number)") + ".";
    this.href = "https://wa.me/" + SUPPORT_WHATSAPP + "?text=" + encodeURIComponent(text);
});

resetForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const pin = resetForm.pin.value;
    if (!/^[0-9]{6}$/.test(pin)) { showMessage(resetMsg, "Your PIN must be exactly 6 digits.", true); return; }
    if (pin !== resetForm.pin_confirm.value) { showMessage(resetMsg, "The two PINs do not match.", true); return; }

    const button = resetForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(resetMsg, "Saving...", false);
    const { data, error } = await db.rpc("reset_pin", {
        p_phone: digitsOnly(resetForm.phone.value),
        p_code: resetForm.code.value,
        p_new_pin: pin
    });
    button.disabled = false;

    if (error || !data) {
        console.error("Reset failed:", error && error.message);
        showMessage(resetMsg, "Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            locked: "Too many wrong tries. Wait 15 minutes and try again.",
            badpin: "Your PIN must be exactly 6 digits.",
            invalid: "Wrong phone number or code, or the code has expired. Message us on WhatsApp to get a new one."
        };
        showMessage(resetMsg, reasons[data.reason] || reasons.invalid, true);
        return;
    }
    resetForm.reset();
    codeValue.textContent = data.recovery_code;
    showOnly(codeBox);
});

document.getElementById("code-done").addEventListener("click", function () {
    codeValue.textContent = "";
    showOnly(loginForm);
    showMessage(loginMsg, "PIN saved. Log in with your new PIN.", false);
});


// ---------- listing fee (Paystack) ----------
const listingBox = document.getElementById("listing-box");
const listingText = document.getElementById("listing-text");
const payBtn = document.getElementById("pay-btn");
const payMsg = document.getElementById("pay-msg");

function naira(kobo) { return "\u20A6" + (kobo / 100).toLocaleString("en-NG"); }
function niceDate(iso) {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

async function loadListing() {
    if (!session) return;
    listingBox.classList.add("is-hidden");
    const { data, error } = await db.rpc("get_listing_state", { p_phone: session.phone, p_pin: session.pin });
    if (error || !data || !data.ok) return;

    const fee = naira(data.fee_kobo);
    listingBox.classList.remove("is-hidden", "live", "hidden-profile");
    payBtn.classList.add("is-hidden");

    if (data.paid) {
        listingBox.classList.add("live");
        const daysLeft = Math.ceil((new Date(data.paid_until) - Date.now()) / 86400000);
        listingText.textContent = "You are listed until " + niceDate(data.paid_until) + ". Renew before then to stay listed and keep viewing jobs.";
        if (daysLeft <= 30) {
            payBtn.textContent = "Renew for " + fee + " (adds 1 month)";
            payBtn.classList.remove("is-hidden");
        }
    } else if (data.free) {
        listingText.textContent = "Listing is free until " + niceDate(data.free_until) + ". After that it costs " + fee + " a month to stay listed and keep viewing jobs. If you pay now, your month starts after the free period, so nothing is wasted.";
        payBtn.textContent = "Pay " + fee + " for 1 month";
        payBtn.classList.remove("is-hidden");
    } else {
        listingBox.classList.add("hidden-profile");
        listingText.textContent = (data.paid_until ? "Your listing expired on " + niceDate(data.paid_until) + ". " : "") +
            "Your profile is saved but hidden from customers, and you cannot view jobs. Pay " + fee + " to go live for a month. Your details stay saved until you are ready.";
        payBtn.textContent = "Pay " + fee + " to go live";
        payBtn.classList.remove("is-hidden");
    }
    payBtn.dataset.fee = fee;
}

async function confirmPayment(reference) {
    showMessage(payMsg, "Confirming your payment...", false);
    const { data, error } = await db.functions.invoke("paystack", { body: { reference: reference } });
    if (error || !data || !data.ok) {
        console.error("Confirm failed:", error && error.message, data);
        showMessage(payMsg, "We could not confirm your payment yet. If money left your account, wait a minute and refresh this page. Your profile goes live automatically once the payment is confirmed.", true);
        payBtn.disabled = false;
        return;
    }
    showMessage(payMsg, "Payment received. Thank you, you are now listed.", false);
    payBtn.disabled = false;
    loadListing();
}

payBtn.addEventListener("click", async function () {
    if (!session) return;
    if (typeof PaystackPop === "undefined") {
        showMessage(payMsg, "Could not load the payment window. Check your internet and try again.", true);
        return;
    }
    payBtn.disabled = true;
    showMessage(payMsg, "Starting payment...", false);

    const { data, error } = await db.rpc("start_payment", { p_phone: session.phone, p_pin: session.pin });
    if (error || !data || !data.ok) {
        payBtn.disabled = false;
        if (data && data.reason === "already") { showMessage(payMsg, "You have already paid.", false); loadListing(); return; }
        if (data && !data.ok && data.reason !== "already" && data.reason !== "error") { logout("Please log in again to pay."); return; }
        showMessage(payMsg, "Could not start the payment. Check your internet and try again.", true);
        return;
    }
    showMessage(payMsg, "", false);

    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: data.email,
        amount: data.amount_kobo,
        currency: "NGN",
        ref: data.reference,
        callback: function (response) { confirmPayment(response.reference); },
        onClose: function () { payBtn.disabled = false; }
    });
    handler.openIframe();
});