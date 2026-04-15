const header = document.querySelector(".site-header");
const revealItems = document.querySelectorAll(".reveal");
const leadForm = document.querySelector("#lead-form");
const formNote = document.querySelector("#form-note");
const submitButton = leadForm?.querySelector('button[type="submit"]');

const syncHeader = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -60px 0px",
    }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 70, 420)}ms`;
    revealObserver.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const setFormState = (message, state = "idle") => {
  if (!formNote) {
    return;
  }

  formNote.textContent = message;
  formNote.classList.remove("is-error", "is-success", "is-loading");

  if (state === "error") {
    formNote.classList.add("is-error");
  }

  if (state === "success") {
    formNote.classList.add("is-success");
  }

  if (state === "loading") {
    formNote.classList.add("is-loading");
  }
};

if (leadForm && formNote && submitButton) {
  const defaultButtonLabel = submitButton.textContent;

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(leadForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
    };

    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
    setFormState("Enviando seu pedido de diagnostico...", "loading");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Nao foi possivel enviar sua solicitacao.");
      }

      setFormState(result.message, "success");
      leadForm.reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel enviar sua solicitacao.";

      setFormState(message, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = defaultButtonLabel;
    }
  });
}
