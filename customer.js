const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

const AREAS = ["Rumuokoro", "Rumuola", "Rumuigbo", "Eliozu", "Diobu", "GRA", "Trans Amadi", "Mile 1", "Mile 3", "Ada George", "Woji", "Choba", "Alakahia", "Aluu", "Rumuosi", "Ozuoba", "Iwofe", "Other"];
const KEY = "sabi_customer"; // { token, name, verified } - shared with gate.js

const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const accountBox = document.getElementById("account-box");
const signupMsg = document.getElementById("signup-msg");
const loginMsg = document.getElementById("login-msg");
const safety = document.getElementById("safety");
const intro = document.getElementById("intro");
const introText = intro.textContent;

// ---------- helpers ----------
function digitsOnly(phone) {
    return phone.replace(/\D/g, "").replace(/^234/, "0");
}

function showMessage(el, text, isError) {
    el.textContent = text;
    el.className = text ? (isError ? "msg error" : "msg success") : "msg";
}

function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
function saveSession(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
function clearSession() {
    try { localStorage.removeItem(KEY); } catch (e) {}
}

function showOnly(card) {
    [signupForm, loginForm, accountBox].forEach(function (c) {
        c.classList.toggle("is-hidden", c !== card);
    });
    safety.classList.toggle("is-hidden", card === accountBox);
}

function showAccount(s) {
    document.getElementById("who").textContent = s.name;
    const badge = document.getElementById("status-badge");
    badge.textContent = s.verified ? "Verified" : "Verification pending";
    badge.className = "badge " + (s.verified ? "ok" : "pending");
    intro.textContent = "You are signed in.";
    showOnly(accountBox);
}

// ---------- setup ----------
signupForm.area.innerHTML = '<option value="" disabled selected>Choose an area</option>' +
    AREAS.map(function (a) { return "<option>" + a + "</option>"; }).join("");

document.getElementById("to-login").addEventListener("click", function () { showOnly(loginForm); });
document.getElementById("to-signup").addEventListener("click", function () { showOnly(signupForm); });

// ---------- sign up ----------
signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const pin = signupForm.pin.value;
    if (!/^[0-9]{6}$/.test(pin)) { showMessage(signupMsg, "Your PIN must be exactly 6 digits.", true); return; }
    if (pin !== signupForm.pin_confirm.value) { showMessage(signupMsg, "The two PINs do not match.", true); return; }

    const button = signupForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(signupMsg, "Creating your account...", false);

    const { data, error } = await db.rpc("create_customer", {
        p_name: signupForm.name.value.trim(),
        p_phone: digitsOnly(signupForm.phone.value),
        p_area: signupForm.area.value,
        p_pin: pin
    });
    button.disabled = false;

    if (error || !data) {
        console.error("Sign up failed:", error && error.message);
        showMessage(signupMsg, "Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            exists: "This number already has an account. Tap \"Already have an account? Sign in\".",
            badpin: "Your PIN must be exactly 6 digits.",
            invalid: "Check your name and phone number and try again."
        };
        showMessage(signupMsg, reasons[data.reason] || "Something went wrong. Please try again.", true);
        return;
    }
    signupForm.reset();
    const s = { token: data.token, name: data.name, verified: data.verified };
    saveSession(s);
    showAccount(s);
});

// ---------- sign in ----------
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(loginMsg, "Checking...", false);

    const { data, error } = await db.rpc("customer_login", {
        p_phone: digitsOnly(loginForm.phone.value),
        p_pin: loginForm.pin.value
    });
    button.disabled = false;

    if (error || !data) {
        console.error("Sign in failed:", error && error.message);
        showMessage(loginMsg, "Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            locked: "Too many wrong tries. Wait 15 minutes and try again.",
            suspended: "This account has been suspended. Message us on WhatsApp if you think this is a mistake.",
            invalid: "Wrong phone number or PIN."
        };
        showMessage(loginMsg, reasons[data.reason] || reasons.invalid, true);
        return;
    }
    loginForm.reset();
    const s = { token: data.token, name: data.name, verified: data.verified };
    saveSession(s);
    showAccount(s);
});

// ---------- sign out ----------
document.getElementById("logout").addEventListener("click", async function () {
    const s = getSession();
    if (s) { try { await db.rpc("customer_logout", { p_token: s.token }); } catch (e) {} }
    clearSession();
    intro.textContent = introText;
    showMessage(loginMsg, "", false);
    showOnly(loginForm);
});

// ---------- already signed in on this device ----------
const existing = getSession();
if (existing && existing.token) showAccount(existing);