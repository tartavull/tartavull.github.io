const root = document.getElementById("root");
const deck = document.getElementById("deck");
const hint = document.getElementById("hint");
const labels = Array.from(document.querySelectorAll(".topt"));
const toggle = document.getElementById("toggle");
const blogLinks = Array.from(document.querySelectorAll(".post-list a"));
const cards = Object.fromEntries(
  Array.from(deck.querySelectorAll(".card")).map((card) => [card.dataset.card, card]),
);

const POSTS = Object.fromEntries(
  JSON.parse(document.getElementById("post-data").textContent).map((post) => [post.slug, post]),
);

let active = "bio";
let hintShown = true;
let downX = 0;
let downY = 0;
let blogExpanded = false;
let blogOverlay = null;
const BLOG_ACTIVATION_DELAY = 650;
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const OVERLAY_TRANSITION_MS = REDUCED_MOTION ? 0 : 360;
const CONTENT_TRANSITION_MS = REDUCED_MOTION ? 0 : 140;
let blogReadyAt = 0;
let pointerDownActive = active;

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function resetTilt() {
  root.style.setProperty("--hlx", "0px");
  root.style.setProperty("--hly", "-1.7px");
  root.style.setProperty("--shx", "0px");
  root.style.setProperty("--shy", "1.7px");

  Object.values(cards).forEach((card) => {
    card.style.transition = "";
    card.style.transform = card === cards[active] ? "rotateX(0deg) rotateY(0deg)" : "";
  });
}

function hideHint() {
  if (!hintShown) return;
  hint.style.opacity = "0";
  hintShown = false;
}

function setOverlayTransform(overlay, rect) {
  overlay.style.setProperty("--overlay-x", rect.left + "px");
  overlay.style.setProperty("--overlay-y", rect.top + "px");
  overlay.style.setProperty("--overlay-scale-x", rect.width / window.innerWidth);
  overlay.style.setProperty("--overlay-scale-y", rect.height / window.innerHeight);
}

function clearBlogSelection() {
  blogLinks.forEach((link) => link.classList.remove("selected"));
}

function finishOverlayRemoval(overlay) {
  overlay.remove();
  if (blogOverlay === overlay) blogOverlay = null;
  root.classList.remove("blog-expanded");
  clearBlogSelection();
  resetTilt();
}

function collapseBlog() {
  if (!blogExpanded) return;

  blogExpanded = false;

  if (!blogOverlay) {
    root.classList.remove("blog-expanded");
    clearBlogSelection();
    resetTilt();
    return;
  }

  const overlay = blogOverlay;
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    finishOverlayRemoval(overlay);
  }

  overlay.classList.add("closing");
  overlay.classList.remove("content-visible");

  setTimeout(() => {
    const target = cards.blog.getBoundingClientRect();
    setOverlayTransform(overlay, target);

    function finishOnTransform(event) {
      if (event.target !== overlay || event.propertyName !== "transform") return;
      overlay.removeEventListener("transitionend", finishOnTransform);
      finish();
    }

    overlay.addEventListener("transitionend", finishOnTransform);
    overlay.classList.remove("expanded");
    setTimeout(finish, OVERLAY_TRANSITION_MS + 150);
  }, CONTENT_TRANSITION_MS);
}


function postForLink(link) {
  return POSTS[link.dataset.post];
}

function nextPostLink(overlay, sourceLink) {
  const links = Array.from(overlay.querySelectorAll(".post-list a"));
  const currentIndex = links.findIndex((link) => link.dataset.post === sourceLink.dataset.post);
  return links[(currentIndex + 1) % links.length];
}

function showPostInOverlay(overlay, sourceLink) {
  if (overlay.classList.contains("closing") || overlay.classList.contains("switching")) return;

  overlay.classList.add("switching");
  overlay.classList.remove("content-visible");

  setTimeout(() => {
    if (blogOverlay !== overlay || !blogExpanded) return;

    overlay.querySelectorAll(".post-list a").forEach((link) => {
      link.classList.toggle("selected", link.dataset.post === sourceLink.dataset.post);
    });
    renderPostDetail(overlay, sourceLink);

    requestAnimationFrame(() => {
      if (blogOverlay !== overlay || !blogExpanded) return;
      overlay.classList.remove("switching");
      overlay.classList.add("content-visible");
    });
  }, CONTENT_TRANSITION_MS);
}

function renderPostDetail(overlay, sourceLink) {
  const post = postForLink(sourceLink);
  const stage = overlay.querySelector(".blog-stage");
  const existing = stage.querySelector(".post-detail");
  if (existing) existing.remove();

  const detail = document.createElement("section");
  detail.className = "post-detail pressed";

  const header = document.createElement("div");
  header.className = "post-detail-header";

  const title = document.createElement("h1");
  title.textContent = post.title;
  if (post.title.length > 48) title.classList.add("long-title");
  if (post.title.length > 72) title.classList.add("extra-long-title");

  const summary = document.createElement("p");
  summary.textContent = post.summary;

  header.append(title, summary);

  const body = document.createElement("div");
  body.className = "post-detail-body";

  if (post.media.length) {
    const media = document.createElement("div");
    media.className = "post-media";
    if (post.media.length > 1) media.classList.add("multiple");

    post.media.forEach((item) => {
      if (item.type === "image") {
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.alt;
        image.loading = "lazy";
        image.decoding = "async";
        media.appendChild(image);
        return;
      }

      const video = document.createElement("video");
      video.src = item.src;
      video.poster = item.poster;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      media.appendChild(video);
    });

    body.appendChild(media);
  }

  post.paragraphs.forEach((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    body.appendChild(node);
  });

  if (post.source) {
    const source = document.createElement("p");
    source.className = "post-source";
    const sourceAnchor = document.createElement("a");
    sourceAnchor.href = post.source;
    sourceAnchor.target = "_blank";
    sourceAnchor.rel = "noopener noreferrer";
    sourceAnchor.textContent = post.source;
    source.appendChild(sourceAnchor);
    body.appendChild(source);
  }

  const nextLink = nextPostLink(overlay, sourceLink);
  const nextPost = postForLink(nextLink);
  const next = document.createElement("button");
  next.className = "post-next";
  next.type = "button";
  next.setAttribute("aria-label", `Read next entry: ${nextPost.title}`);

  const nextLabel = document.createElement("span");
  nextLabel.className = "post-next-label";
  nextLabel.textContent = "Next entry";
  const nextArrow = document.createElement("span");
  nextArrow.className = "post-next-arrow";
  nextArrow.setAttribute("aria-hidden", "true");
  nextArrow.textContent = "\u2193";
  const nextTitle = document.createElement("strong");
  nextTitle.textContent = nextPost.title;
  next.append(nextLabel, nextArrow, nextTitle);

  if (nextPost.dateLabel) {
    const nextDate = document.createElement("small");
    nextDate.textContent = nextPost.dateLabel;
    next.appendChild(nextDate);
  }

  next.addEventListener("click", () => showPostInOverlay(overlay, nextLink));
  body.appendChild(next);

  detail.append(header, body);
  stage.appendChild(detail);
}
function show(cardName) {
  if (blogExpanded) collapseBlog();

  active = cardName;
  blogReadyAt = cardName === "blog" ? performance.now() + BLOG_ACTIVATION_DELAY : 0;

  Object.entries(cards).forEach(([name, card]) => {
    card.classList.toggle("up", name === cardName);
  });

  toggle.className = "toggle " + cardName;
  labels.forEach((label) => {
    label.classList.toggle("on", label.dataset.card === cardName);
  });

  resetTilt();
  hideHint();
}

function blogCanOpenEntry() {
  return active === "blog" && cards.blog.classList.contains("up") && performance.now() >= blogReadyAt;
}

function createBlogOverlay(sourceLink) {
  const rect = cards.blog.getBoundingClientRect();
  const overlay = cards.blog.cloneNode(true);
  overlay.classList.add("blog-overlay");
  overlay.removeAttribute("tabindex");
  overlay.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  overlay.querySelectorAll(".post-list a").forEach((link) => {
    link.classList.toggle("selected", link.dataset.post === sourceLink.dataset.post);
    link.addEventListener("click", (event) => {
      if (!overlay.classList.contains("expanded")) event.preventDefault();
    });
  });

  const close = overlay.querySelector(".expand-close");
  close.addEventListener("click", collapseBlog);
  renderPostDetail(overlay, sourceLink);

  setOverlayTransform(overlay, rect);
  document.body.appendChild(overlay);
  overlay.getBoundingClientRect();

  return overlay;
}

function expandBlogFromLink(sourceLink) {
  if (blogExpanded) return;

  if (active !== "blog") show("blog");
  resetTilt();

  blogLinks.forEach((link) => link.classList.toggle("selected", link === sourceLink));
  blogOverlay = createBlogOverlay(sourceLink);
  blogExpanded = true;
  root.classList.add("blog-expanded");
  const overlay = blogOverlay;

  requestAnimationFrame(() => {
    if (blogOverlay !== overlay || !blogExpanded) return;

    function revealContent(event) {
      if (event && (event.target !== overlay || event.propertyName !== "transform")) return;
      overlay.removeEventListener("transitionend", revealContent);
      if (blogOverlay !== overlay || !blogExpanded) return;
      overlay.classList.add("content-visible");
    }

    overlay.addEventListener("transitionend", revealContent);
    overlay.classList.add("expanded");
    setTimeout(revealContent, OVERLAY_TRANSITION_MS + 100);
  });

  hideHint();
}

function handleBlogEntryActivation(event) {
  const link = event.target.closest && event.target.closest(".post-list a");
  if (!link) return;

  event.preventDefault();
  event.stopPropagation();

  if (event.type === "auxclick") return;

  if (link.closest(".blog-overlay")) {
    showPostInOverlay(link.closest(".blog-overlay"), link);
    return;
  }

  const startedOnActiveBlog = event.detail === 0 || pointerDownActive === "blog";
  if (!startedOnActiveBlog || !blogCanOpenEntry()) {
    if (active !== "blog") show("blog");
    return;
  }

  expandBlogFromLink(link);
}

root.addEventListener("pointermove", (event) => {
  if (blogExpanded) return;

  const card = cards[active];
  const rect = card.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const motionX = clamp((event.clientX - centerX) / (rect.width / 2));
  const motionY = clamp((event.clientY - centerY) / (rect.height / 2) - 0.4);
  const offset = 1.9;

  root.style.setProperty("--hlx", (motionX * offset).toFixed(2) + "px");
  root.style.setProperty("--hly", (motionY * offset).toFixed(2) + "px");
  root.style.setProperty("--shx", (-motionX * offset).toFixed(2) + "px");
  root.style.setProperty("--shy", (-motionY * offset).toFixed(2) + "px");

  card.style.transition = "none";
  card.style.transform =
    "rotateX(" +
    (-motionY * 4).toFixed(2) +
    "deg) rotateY(" +
    (motionX * 4.5).toFixed(2) +
    "deg)";
  hideHint();
});

root.addEventListener("pointerleave", resetTilt);

setTimeout(() => {
  hint.style.opacity = "0";
  hintShown = false;
}, 5000);

labels.forEach((label) => {
  label.addEventListener("click", () => show(label.dataset.card));
});

document.addEventListener("click", handleBlogEntryActivation, true);
document.addEventListener("auxclick", handleBlogEntryActivation, true);

function isInteractive(target) {
  return target.closest && target.closest("a, button");
}

deck.addEventListener("pointerdown", (event) => {
  downX = event.clientX;
  downY = event.clientY;
  pointerDownActive = active;
});

deck.addEventListener("pointerup", (event) => {
  if (blogExpanded) return;
  if (isInteractive(event.target)) return;
  if (event.button !== 0) return;
  if (Math.hypot(event.clientX - downX, event.clientY - downY) >= 10) return;

  const card = event.target.closest(".card");
  if (!card) return;

  if (card.dataset.card !== active) {
    show(card.dataset.card);
  }
});

Object.values(cards).forEach((card) => {
  card.addEventListener("keydown", (event) => {
    if (blogExpanded) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    show(card.dataset.card);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") collapseBlog();
});

window.__cardSiteReady = true;
