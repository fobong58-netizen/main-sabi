const { createClient } = supabase;
const db = createClient(
    "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
    "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
);

const form = document.getElementById("listed-form");
const msg = document.getElementById("msg");
const submitButton = form.querySelector('button[type="submit"]');
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");

const PHOTO_BUCKET = "profile-photos";
const MAX_PHOTO_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

let lastRecoveryCode = "";

// Saved through a database function so the PIN is hashed on the server and never stored as plain text.
async function saveWorker(worker, pin) {
    const { data, error } = await db.rpc("create_artisan", {
        p_pin: pin,
        p_name: worker.name,
        p_trade: worker.trade,
        p_area: worker.area,
        p_phone: worker.phone,
        p_call_phone: worker.call_phone,
        p_years: worker.years,
        p_skills: worker.skills,
        p_about: worker.about,
        p_photo_url: worker.photo_url
    });
    lastRecoveryCode = error ? "" : data;
    return error; // null when it worked
}

async function uploadPhoto(blob, phone) {
    const path = phone + "-" + Date.now() + ".jpg";
    const { error } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

    if (error) {
        console.error("Could not upload photo:", error.message);
        return null;
    }
    return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- helpers ----------
// Shrinks the photo to max 600px and converts to JPEG, so uploads are fast on slow data.
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
        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

function clearPhotoPreview() {
    photoPreview.style.backgroundImage = "";
    photoPreview.classList.remove("has-photo");
}

photoInput.addEventListener("change", function () {
    const file = photoInput.files[0];
    clearPhotoPreview();
    if (!file) return;

    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
        photoInput.value = "";
        showMessage("Profile picture must be a JPG, PNG or WebP image.", true);
        return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        photoInput.value = "";
        showMessage("That picture is too big. Choose one under " + MAX_PHOTO_MB + "MB.", true);
        return;
    }
    msg.textContent = "";
    msg.className = "msg";
    photoPreview.style.backgroundImage = "url(" + URL.createObjectURL(file) + ")";
    photoPreview.classList.add("has-photo");
});

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

    const photoFile = photoInput.files[0];
    if (!photoFile) {
        showMessage("Add a profile picture.", true);
        return;
    }

    const pin = form.pin.value;
    if (!/^[0-9]{6}$/.test(pin)) {
        showMessage("Your PIN must be exactly 6 digits.", true);
        return;
    }
    if (pin !== form.pin_confirm.value) {
        showMessage("The two PINs do not match.", true);
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

    showMessage("Uploading your picture...", false);
    const photoBlob = await compressPhoto(photoFile);
    const photoUrl = photoBlob ? await uploadPhoto(photoBlob, phone) : null;
    if (!photoUrl) {
        showMessage("Could not upload your picture. Try another photo or check your internet.", true);
        submitButton.disabled = false;
        return;
    }

    const error = await saveWorker({
        photo_url: photoUrl,
        name: form.full_name.value.trim(),
        trade: form.trade.value,
        area: form.area.value,
        phone: phone,
        call_phone: form.phone_call.value.trim(),
        years: isNaN(years) ? 0 : years,
        skills: skills,
        about: form.about.value.trim(),
        verified: false
    }, pin);

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
    clearPhotoPreview();
    showMessage("Your profile is created. Customers can now find you on the find a service page. Your recovery code is " + lastRecoveryCode + ". Write it down or take a screenshot now, because it is shown only once. You need it if you forget your PIN. Use the my profile page to edit your profile.", false);
});