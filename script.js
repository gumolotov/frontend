const header = document.querySelector(".site-header");
const revealItems = document.querySelectorAll(".reveal");
const leadForm = document.querySelector("#lead-form");
const formNote = document.querySelector("#form-note");

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

if (leadForm && formNote) {
  leadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    formNote.textContent = "Pedido enviado com sucesso. Agora é só conectar este formulário ao seu backend.";
    leadForm.reset();
  });
}
