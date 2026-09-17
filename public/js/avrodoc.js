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
    document.querySelectorAll("#list-pane li").forEach(function (li) {
      li.classList.remove("selected");
    });
    document.querySelectorAll("#list-pane a").forEach(function (a) {
      if (a.getAttribute("href") === hash) {
        var li = a.closest("li");
        if (li) li.classList.add("selected");
      }
    });
  }

  function findSection(hash) {
    return sectionByRoute.get(hash) || null;
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
  var isBackForward = false;

  window.addEventListener("popstate", function () {
    isBackForward = true;
  });

  window.addEventListener("hashchange", function (e) {
    var oldHash = e.oldURL ? new URL(e.oldURL).hash || "#/" : "#/";
    scrollPositions[oldHash] =
      document.documentElement.scrollTop || document.body.scrollTop || 0;

    dismissActivePopover();

    var restoredScroll;
    if (isBackForward) {
      restoredScroll = scrollPositions[window.location.hash || "#/"];
    }
    isBackForward = false;

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
