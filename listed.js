const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

const form = document.getElementById("listed-form");
const msg = document.getElementById("msg");
const submitButton = form.querySelector('button[type="submit"]');

// ---------- storage ----------
// Profiles are saved in the Supabase "artisans" table, so every visitor can see them.
// Phone numbers are saved in one format (08012345678) so duplicates can be spotted.

async function phoneAlreadyListed(phone) {
    const { data, error } = await db
        .from("artisans")
        .select("id")
        .eq("phone", phone)
        .limit(1);

    if (error) {
        console.error("Could not check the number:", error.message);
        return null; // null means "could not check"
    }
    return data.length > 0;
}

async function saveWorker(worker) {
    const { error } = await db.from("artisans").insert([worker]);
    return error; // null when it worked
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
form.addEventListener("submit", async function (event) {
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
    const years = Number(form.experience.value);

    // stop double clicks while we talk to the database
    submitButton.disabled = true;
    showMessage("Saving your profile...", false);

    const listed = await phoneAlreadyListed(phone);
    if (listed === null) {
        showMessage("Could not reach the server. Check your internet and try again.", true);
        submitButton.disabled = false;
        return;
    }
    if (listed) {
        showMessage("This number is already listed.", true);
        submitButton.disabled = false;
        return;
    }

    const error = await saveWorker({
        name: form.full_name.value.trim(),
        trade: form.trade.value,
        area: form.area.value,
        phone: phone,
        call_phone: form.phone_call.value.trim(),
        years: isNaN(years) ? 0 : years,
        skills: skills,
        about: form.about.value.trim(),
        verified: false
    });

    submitButton.disabled = false;

    if (error) {
        console.error("Could not save profile:", error.message);
        // 23505 = the database's own "duplicate" rule caught it
        if (error.code === "23505") {
            showMessage("This number is already listed.", true);
        } else {
            showMessage("Something went wrong and your profile was not saved. Please try again.", true);
        }
        return;
    }

    form.reset();
    showMessage("Your profile is created. Customers can now find you on the find a service page.", false);
});