const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

const form = document.getElementById("report-form");
const msg = document.getElementById("msg");
const button = form.querySelector('button[type="submit"]');

function digitsOnly(phone) {
    return phone.replace(/\D/g, "").replace(/^234/, "0");
}
function showMessage(text, isError) {
    msg.textContent = text;
    msg.className = isError ? "msg error" : "msg success";
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    button.disabled = true;
    showMessage("Sending...", false);

    const { data, error } = await db.rpc("submit_customer_report", {
        p_phone: digitsOnly(form.my_phone.value),
        p_pin: form.pin.value,
        p_customer_phone: digitsOnly(form.cust_phone.value),
        p_reason: form.reason.value,
        p_details: form.details.value.trim()
    });
    button.disabled = false;

    if (error || !data) {
        console.error("Report failed:", error && error.message);
        showMessage("Could not reach the server. Check your internet and try again.", true);
        return;
    }
    if (!data.ok) {
        const reasons = {
            locked: "Too many wrong tries. Wait 15 minutes and try again.",
            nopin: "Set your PIN first on the My profile page.",
            invalid: "Wrong phone number or PIN.",
            nocontact: "We have no record of this customer contacting you through sabi. Check the number.",
            duplicate: "You have already reported this customer.",
            limit: "You have sent too many reports today. Try again tomorrow."
        };
        showMessage(reasons[data.reason] || "Your report could not be sent.", true);
        return;
    }
    form.reset();
    showMessage("Thank you. Your report was sent and we will look into it.", false);
});