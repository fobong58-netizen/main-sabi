const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

const form = document.getElementById("job-form");
const msg = document.getElementById("msg");
const submitButton = form.querySelector('button[type="submit"]');

function digitsOnly(phone) {
    return phone.replace(/\D/g, "").replace(/^234/, "0");
}

function showMessage(text, isError) {
    msg.textContent = text;
    msg.className = isError ? "msg error" : "msg success";
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const pin = form.pin.value;
    if (!/^[0-9]{6}$/.test(pin)) {
        showMessage("Your PIN must be exactly 6 digits.", true);
        return;
    }
    if (pin !== form.pin_confirm.value) {
        showMessage("The two PINs do not match.", true);
        return;
    }

    const callRaw = form.phone_call.value.trim();

    // stop double clicks while we talk to the database
    submitButton.disabled = true;
    showMessage("Posting your job...", false);

    const { data, error } = await db.rpc("create_job", {
        p_pin: pin,
        p_title: form.job_title.value.trim(),
        p_trade: form.trade.value,
        p_area: form.area.value,
        p_job_type: form.job_type.value,
        p_pay: form.pay.value.trim(),
        p_description: form.description.value.trim(),
        p_poster: form.poster_name.value.trim(),
        p_phone: digitsOnly(form.phone.value),
        p_call_phone: callRaw ? digitsOnly(callRaw) : ""
    });

    submitButton.disabled = false;

    if (error || !data) {
        console.error("Could not post job:", error && error.message);
        showMessage("Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            limit: "You have posted 3 jobs today with this number. Try again tomorrow.",
            badpin: "Your PIN must be exactly 6 digits.",
            invalid: "Some details are too short or too long. Please check the form and try again."
        };
        showMessage(reasons[data.reason] || "Something went wrong and your job was not posted. Please try again.", true);
        return;
    }

    form.reset();
    showMessage("Your job is posted. Workers can now see it on the jobs page and contact you. It stays listed for 30 days. Remember your PIN, you need it to close the job once it is filled.", false);
});