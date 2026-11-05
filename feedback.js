const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

// The developer's WhatsApp number, international format (no + or spaces).
const DEV_WHATSAPP = "2347062812735";

const form = document.getElementById("feedback-form");
const msg = document.getElementById("msg");
const counter = document.getElementById("counter");
const submitButton = form.querySelector('button[type="submit"]');

// same device id as reviews.js, so one device can't flood the inbox
function deviceId() {
    try {
        let id = JSON.parse(localStorage.getItem("sabi_device"));
        if (!id) {
            id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "d" + Date.now() + Math.random().toString(36).slice(2);
            localStorage.setItem("sabi_device", JSON.stringify(id));
        }
        return id;
    } catch (e) {
        return "unknown";
    }
}

function showMessage(text, isError) {
    msg.textContent = text;
    msg.className = isError ? "msg error" : "msg success";
}

form.message.addEventListener("input", function () {
    counter.textContent = form.message.value.length;
});

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    // bots fill the hidden field; pretend it worked
    if (form.website.value) {
        form.reset();
        showMessage("Thank you. Your feedback was sent.", false);
        return;
    }

    const message = form.message.value.trim();
    if (message.length < 10) {
        showMessage("Please write at least 10 characters.", true);
        return;
    }

    const rating = form.elements["rating"].value; // "" when none chosen
    const kind = form.elements["kind"].value;
    const name = form.name.value.trim();
    const contact = form.contact.value.trim();
    const pageName = form.page.value;

    submitButton.disabled = true;
    showMessage("Sending...", false);

    // 1) keep a copy in the database so nothing gets lost
    try {
        const { error } = await db.rpc("submit_feedback", {
            p_kind: kind,
            p_message: message,
            p_name: name,
            p_contact: contact,
            p_rating: rating ? Number(rating) : 0,
            p_page: pageName,
            p_device_id: deviceId()
        });
        if (error) console.error("Could not save feedback:", error.message);
    } catch (e) {
        console.error("Could not save feedback:", e);
    }

    // 2) open WhatsApp with the message ready to send to the developer
    const lines = [
        "*sabi feedback: " + kind + "*",
        "",
        message,
        ""
    ];
    if (rating) lines.push("Rating: " + rating + "/5");
    if (pageName) lines.push("Page: " + pageName);
    if (name) lines.push("From: " + name);
    if (contact) lines.push("Contact: " + contact);

    const link = "https://wa.me/" + DEV_WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n").trim());

    form.reset();
    counter.textContent = "0";
    submitButton.disabled = false;
    showMessage("Almost done. WhatsApp is opening. Tap Send there to deliver your message.", false);
    window.location.href = link;
});