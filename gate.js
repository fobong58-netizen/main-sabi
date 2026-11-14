// Replaces the earlier gate.js. Load after the other scripts on index.html and jobs.html:
//   <script src="/gate.js"></script>
// Phone numbers are no longer on the page. Tapping Call or WhatsApp asks the server
// (reveal_contact), which checks the customer's session, logs the contact and returns the number.

(function () {
    const KEY = "sabi_customer";
    const client = window.supabase.createClient(
        "https://bxxoxnsrqgtfnzfhjqlv.supabase.co",
        "sb_publishable_83Wn3F18p59ChfH4340LjQ_-MVuRkc6"
    );

    function session() {
        try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
    }

    function waDigits(phone) {
        const d = String(phone || "").replace(/\D/g, "");
        return d.startsWith("234") ? d : "234" + d.replace(/^0/, "");
    }

    function notice(text, goToAccount) {
        let box = document.getElementById("gateNotice");
        if (!box) {
            box = document.createElement("div");
            box.id = "gateNotice";
            box.setAttribute("role", "alert");
            box.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:50;" +
                "width:min(420px,calc(100% - 24px));padding:14px 16px;border-radius:10px;" +
                "background:#0e1941;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.35);font-weight:500";
            document.body.appendChild(box);
        }
        box.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = text;
        box.appendChild(p);
        if (goToAccount) {
            const a = document.createElement("a");
            a.href = "/customer.html";
            a.textContent = "Create or sign in to your account";
            a.style.cssText = "display:inline-block;margin-top:8px;color:#ffc20e;font-weight:600";
            box.appendChild(a);
        }
        clearTimeout(box._t);
        box._t = setTimeout(function () { box.remove(); }, 8000);
    }

    document.addEventListener("click", async function (event) {
        const link = event.target.closest("a.call-btn, a.wa-btn");
        if (!link) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (link.dataset.busy) return;

        const s = session();
        if (!s || !s.token) {
            notice("Sign in as a customer to contact artisans. It is free and keeps artisans safe.", true);
            return;
        }

        const isWhatsApp = link.classList.contains("wa-btn");
        const artisanId = link.dataset.contact;
        const jobId = link.dataset.job;

        link.dataset.busy = "1";
        // open the tab now so popup blockers allow it; we point it at WhatsApp once the server says yes
        const tab = isWhatsApp ? window.open("", "_blank") : null;

        const { data, error } = await client.rpc("reveal_contact", {
            p_token: s.token,
            p_target_type: artisanId ? "artisan" : "job",
            p_target_id: Number(artisanId || jobId),
            p_kind: isWhatsApp ? "whatsapp" : "call"
        });
        delete link.dataset.busy;

        if (error || !data || !data.ok) {
            if (tab) tab.close();
            const reason = data && data.reason;
            if (reason === "nosession" || reason === "suspended") {
                try { localStorage.removeItem(KEY); } catch (e) {}
            }
            const messages = {
                nosession: "Your sign-in expired. Please sign in again.",
                suspended: "Your account is suspended. Message us on WhatsApp if you think this is a mistake.",
                limit: "You have reached today's contact limit. Try again tomorrow.",
                notfound: "This listing is no longer available."
            };
            notice(error || !data ? "Could not reach the server. Check your internet and try again."
                                  : (messages[reason] || "This contact could not be made."),
                   reason === "nosession");
            return;
        }

        // lets reviews.js show the review form for this worker
        if (artisanId) {
            try {
                const list = JSON.parse(localStorage.getItem("sabi_contacted")) || [];
                if (list.indexOf(String(artisanId)) === -1) {
                    list.push(String(artisanId));
                    localStorage.setItem("sabi_contacted", JSON.stringify(list));
                }
                if (typeof renderReviewForm === "function") renderReviewForm();
            } catch (e) {}
        }

        if (isWhatsApp) {
            const url = "https://wa.me/" + waDigits(data.phone) + "?text=" + encodeURIComponent(link.dataset.waText || "");
            if (tab) tab.location.href = url; else window.location.href = url;
        } else {
            window.location.href = "tel:" + (data.call_phone || data.phone);
        }
    }, true);
})();