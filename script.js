const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navAnchors = [...document.querySelectorAll(".nav-link")];
const revealItems = document.querySelectorAll(".reveal");
const sections = [...document.querySelectorAll("main section[id]")];

if (header) {
  const updateHeader = () => header.classList.toggle("scrolled", window.scrollY > 12);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

if (menuToggle && navLinks) {
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    navLinks.classList.remove("open");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
    navLinks.classList.toggle("open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => revealObserver.observe(item));

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navAnchors.forEach((anchor) => {
        anchor.classList.toggle("active", anchor.hash === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-35% 0px -55% 0px" });

  sections.forEach((section) => sectionObserver.observe(section));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const downloadButton = document.querySelector("#download-portfolio");
if (downloadButton instanceof HTMLButtonElement) {
  const buttonLabel = downloadButton.querySelector(".button-label");
  let pdfLibrariesPromise;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load PDF dependency: ${src}`));
    };
    document.head.append(script);
  });

  const loadPdfLibraries = () => {
    if (!pdfLibrariesPromise) {
      pdfLibrariesPromise = (async () => {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.2/jspdf.umd.min.js");

        if (typeof window.html2canvas !== "function" || typeof window.jspdf?.jsPDF !== "function") {
          throw new Error("The PDF dependencies did not initialize.");
        }
      })().catch((error) => {
        pdfLibrariesPromise = undefined;
        throw error;
      });
    }

    return pdfLibrariesPromise;
  };

  const createPortfolioPdf = async () => {
    await loadPdfLibraries();

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-12000px",
      top: "0",
      width: "1200px",
      height: "900px",
      border: "0",
    });

    try {
      const sourceDocument = document.documentElement.cloneNode(true);
      const head = sourceDocument.querySelector("head");
      const base = document.createElement("base");
      const stylesheet = document.createElement("style");
      const baseUrl = new URL(window.location.href);
      baseUrl.hash = "";
      base.href = baseUrl.href;
      sourceDocument.querySelectorAll("script").forEach((script) => script.remove());
      stylesheet.textContent = `
        html, body { width: 1200px !important; min-width: 1200px !important; margin: 0 !important; }
        html { scroll-behavior: auto !important; }
        *, *::before, *::after { animation: none !important; transition: none !important; }
        .reveal { opacity: 1 !important; transform: none !important; }
        .site-header { position: absolute !important; top: 0 !important; }
        .skip-link, .download-button { display: none !important; }
      `;
      head.prepend(base, stylesheet);
      iframe.srcdoc = `<!doctype html>${sourceDocument.outerHTML}`;

      const frameLoaded = new Promise((resolve, reject) => {
        iframe.addEventListener("load", resolve, { once: true });
        iframe.addEventListener("error", () => reject(new Error("The portfolio preview could not be prepared.")), { once: true });
      });
      document.body.append(iframe);
      await frameLoaded;

      const previewDocument = iframe.contentDocument;
      if (!previewDocument?.body) {
        throw new Error("The portfolio preview is unavailable.");
      }

      await previewDocument.fonts.ready;
      await Promise.all([...previewDocument.images].map((image) => image.decode()));

      const pageWidth = 1200;
      const pageHeight = Math.max(previewDocument.documentElement.scrollHeight, previewDocument.body.scrollHeight);
      const scale = 1.5;
      const canvas = await window.html2canvas(previewDocument.body, {
        backgroundColor: "#111017",
        scale,
        useCORS: true,
        logging: false,
        width: pageWidth,
        height: pageHeight,
        windowWidth: pageWidth,
        windowHeight: 900,
        scrollX: 0,
        scrollY: 0,
      });

      const pdfWidth = canvas.width * 0.75;
      const pdfHeight = canvas.height * 0.75;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [pdfWidth, pdfHeight],
        compress: true,
      });
      pdf.setProperties({
        title: "Theodorus Wilson Wirahadisaputra — Portfolio",
        author: "Theodorus Wilson Wirahadisaputra",
      });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, pdfWidth, pdfHeight, "portfolio", "FAST");

      const linkScale = scale * 0.75;
      previewDocument.querySelectorAll("a[href]").forEach((link) => {
        const url = link.href;
        const bounds = link.getBoundingClientRect();
        if (
          !/^https?:|^mailto:/.test(url)
          || bounds.width <= 0
          || bounds.height <= 0
        ) {
          return;
        }

        pdf.link(
          bounds.left * linkScale,
          (bounds.top + previewDocument.defaultView.scrollY) * linkScale,
          bounds.width * linkScale,
          bounds.height * linkScale,
          { url },
        );
      });

      pdf.save("Theodorus-Wilson-Portfolio.pdf");
      canvas.width = 0;
      canvas.height = 0;
    } finally {
      iframe.remove();
    }
  };

  downloadButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    downloadButton.setAttribute("aria-busy", "true");
    if (buttonLabel) buttonLabel.textContent = "Preparing download...";

    try {
      await createPortfolioPdf();
    } catch (error) {
      console.error("Could not download the portfolio PDF.", error);
      window.alert("The portfolio PDF could not be generated. Please check your connection and try again.");
    } finally {
      downloadButton.disabled = false;
      downloadButton.removeAttribute("aria-busy");
      if (buttonLabel) buttonLabel.textContent = "Download Portfolio";
    }
  });
}
