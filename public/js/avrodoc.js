/* global bootstrap:false */

// eslint-disable-next-line
function AvroDoc() {
  // Kept for backward compatibility -- all rendering is now server-side.
}

(function () {
  var showTimer = null;
  var hideTimer = null;
  var activePopover = null;
  var activeTrigger = null;
  var activeTip = null;
  var sectionByRoute = new Map();

  function dismissActivePopover() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (activePopover) {
      activePopover.hide();
      activePopover = null;
      activeTrigger = null;
      activeTip = null;
    }
  }

  function scheduleHide() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      var trigHovered = activeTrigger && activeTrigger.matches(":hover");
      var tipHovered = activeTip && activeTip.matches(":hover");
      if (!trigHovered && !tipHovered && activePopover) {
        activePopover.hide();
        activePopover = null;
        activeTrigger = null;
        activeTip = null;
      }
    }, 150);
  }

  function createPopover(el) {
    var existing = bootstrap.Popover.getInstance(el);
    if (existing) return existing;

    var section = findSection(el.getAttribute("href") || "");
    if (!section) return null;

    var nsEl = section.querySelector("h2.namespace");
    var nameEl = section.querySelector("h1.type-name");
    var titleHtml = "";
    if (nsEl)
      titleHtml += '<span class="namespace">' + nsEl.innerHTML + ".</span>";
    if (nameEl)
      titleHtml += '<span class="type-name">' + nameEl.innerHTML + "</span>";

    var detailsEl = section.querySelector(".type-details");
    var popover = new bootstrap.Popover(el, {
      trigger: "manual",
      animation: false,
      placement: "bottom",
      container: "body",
      title: titleHtml,
      content: function () {
        return detailsEl ? detailsEl.innerHTML : section.innerHTML;
      },
      html: true,
      sanitize: false,
      customClass: "avrodoc-named-type",
    });

    el.addEventListener("shown.bs.popover", function () {
      var tipId = el.getAttribute("aria-describedby");
      var tip = tipId ? document.getElementById(tipId) : null;
      if (tip && !tip._avrodocHooked) {
        tip._avrodocHooked = true;
        tip.addEventListener("mouseleave", scheduleHide);
      }
      activeTip = tip || null;
    });
    return popover;
  }

  function setupPopovers(section) {
    if (section._avrodocPopoversHooked) return;
    section._avrodocPopoversHooked = true;

    section.addEventListener("mouseover", function (event) {
      var el = event.target.closest?.('a[href^="#/schema/"]');
      if (!el || !section.contains(el) || el.contains(event.relatedTarget))
        return;

      var popover = createPopover(el);
      if (!popover) return;

      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      if (activePopover && activePopover !== popover) activePopover.hide();
      showTimer = setTimeout(function () {
        activePopover = popover;
        activeTrigger = el;
        popover.show();
      }, 120);
    });

    section.addEventListener("mouseout", function (event) {
      var el = event.target.closest?.('a[href^="#/schema/"]');
      if (!el || !section.contains(el) || el.contains(event.relatedTarget))
        return;
      scheduleHide();
    });
  }

  function updateSidebarSelection(hash) {
    var segments = hash.split("/");
    var sidebarHash = segments.length === 4 ? "#/schema/" + segments[3] : hash;
    document.querySelectorAll("#list-pane li").forEach(function (li) {
      li.classList.remove("selected");
    });
    document.querySelectorAll("#list-pane a").forEach(function (a) {
      if (a.getAttribute("href") === sidebarHash) {
        var li = a.closest("li");
        if (li) li.classList.add("selected");
      }
    });
  }

  function findSection(hash) {
    var section = sectionByRoute.get(hash);
    if (section) return section;

    var segments = hash.split("/");
    if (segments.length !== 4) return null;
    try {
      var filename = decodeURIComponent(segments[2]);
      if (!filename.startsWith("/schemata/")) return null;
      var alias =
        "#/schema/" +
        encodeURIComponent(filename.slice("/schemata/".length)) +
        "/" +
        segments[3];
      return sectionByRoute.get(alias) || null;
    } catch {
      return null;
    }
  }

  function handleRoute(savedScrollY) {
    var hash = window.location.hash || "#/";
    var section = findSection(hash);
    if (!section) {
      window.location.hash = "#/";
      return;
    }
    document.querySelectorAll("#content-pane > section").forEach(function (s) {
      s.hidden = true;
    });
    section.hidden = false;
    if (savedScrollY !== undefined) {
      window.scrollTo(0, savedScrollY);
    } else {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }
    updateSidebarSelection(hash);
    setupPopovers(section);
  }

  var scrollPositions = {};
  var currentHash = window.location.hash || "#/";
  var isLinkNavigation = false;
  var isHistoryNavigation = false;

  if (window.history && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  function scrollY() {
    return document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function rememberScrollPosition() {
    scrollPositions[currentHash] = scrollY();
  }

  window.addEventListener("scroll", rememberScrollPosition, { passive: true });

  document.addEventListener("click", function (event) {
    var link = event.target.closest?.('a[href^="#/"]');
    if (!link || link.getAttribute("href") === currentHash) return;
    rememberScrollPosition();
    isLinkNavigation = true;
  });

  window.addEventListener("popstate", function () {
    isHistoryNavigation = !isLinkNavigation;
  });

  window.addEventListener("hashchange", function () {
    dismissActivePopover();

    var nextHash = window.location.hash || "#/";
    var restoredScroll = isHistoryNavigation
      ? scrollPositions[nextHash]
      : undefined;
    currentHash = nextHash;
    isLinkNavigation = false;
    isHistoryNavigation = false;

    handleRoute(restoredScroll);
  });

  document.addEventListener("DOMContentLoaded", function () {
    document
      .querySelectorAll("#content-pane > section[data-route]")
      .forEach(function (section) {
        sectionByRoute.set(section.getAttribute("data-route"), section);
      });
    handleRoute();
    setupSearch();
  });

  function setupSearch() {
    var searchInput = document.getElementById("search-schemas");
    var showNamespaceCheckbox = document.getElementById("showNamespace");
    if (!searchInput || !showNamespaceCheckbox) return;

    searchInput.addEventListener("keyup", function () {
      search(searchInput.value, showNamespaceCheckbox.checked);
    });
    showNamespaceCheckbox.addEventListener("change", function () {
      search(searchInput.value, showNamespaceCheckbox.checked);
    });
  }

  function search(text, showNamespace) {
    text = text.toLowerCase();
    document
      .querySelectorAll("#list-pane .schema")
      .forEach(function (schemaEl) {
        var name = (schemaEl.getAttribute("data-schema") || "").toLowerCase();
        var nsEl = schemaEl.closest("li[data-namespace]");
        if (!nsEl) return;
        var nsSchemas = (nsEl.getAttribute("data-schemas") || "").toLowerCase();
        var nsName = (nsEl.getAttribute("data-namespace") || "").toLowerCase();

        var nsMatches = nsSchemas.includes(text) || nsName.includes(text);
        if (nsMatches) {
          nsEl.style.display = "";
          if (showNamespace || name.includes(text)) {
            schemaEl.style.display = "";
          } else {
            schemaEl.style.display = "none";
          }
        } else {
          nsEl.style.display = "none";
          schemaEl.style.display = "none";
        }
      });
  }
})();
