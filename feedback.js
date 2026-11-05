const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

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

    submitButton.disabled = true;
    showMessage("Sending...", false);

    // saving the row triggers the SMS to the developer (done on the server)
    const { data, error } = await db.rpc("submit_feedback", {
        p_kind: form.elements["kind"].value,
        p_message: message,
        p_name: form.name.value.trim(),
        p_contact: form.contact.value.trim(),
        p_rating: rating ? Number(rating) : 0,
        p_page: form.page.value,
        p_device_id: deviceId()
    });

    submitButton.disabled = false;

    if (error || !data) {
        console.error("Could not send feedback:", error && error.message);
        showMessage("Could not send your feedback. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            limit: "You have sent a lot of feedback today. Please try again tomorrow.",
            invalid: "Your message is too short or too long. Please check it and try again."
        };
        showMessage(reasons[data.reason] || "Something went wrong and your feedback was not sent.", true);
        return;
    }

    form.reset();
    counter.textContent = "0";
    showMessage("Thank you. Your feedback was sent to the sabi team.", false);
});