/* global bootstrap:false */

// eslint-disable-next-line
function AvroDoc() {
  // Kept for backward compatibility -- all rendering is now server-side.
}

(function () {
  var popoverData = {};

  function loadPopoverData() {
    var el = document.getElementById("popover-data");
    if (el) {
      try {
        popoverData = JSON.parse(el.textContent || "{}");
      } catch {
        /* ignore */
      }
    }
  }

  var showTimer = null;
  var hideTimer = null;
  var activePopover = null;
  var activeTrigger = null;
  var activeTip = null;

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

  function setupPopovers() {
    document
      .querySelectorAll('#content-pane a[href^="#/schema/"]')
      .forEach(function (el) {
        if (bootstrap.Popover.getInstance(el)) return;

        var href = el.getAttribute("href") || "";
        var urlSegments = href.split("/");
        if (urlSegments.length < 4) return;
        var schemaPopovers = popoverData[decodeURIComponent(urlSegments[2])];
        if (!schemaPopovers) return;
        var popover = schemaPopovers[decodeURIComponent(urlSegments[3])];
        if (!popover) return;

        var bsPopover = new bootstrap.Popover(el, {
          trigger: "manual",
          animation: false,
          placement: "bottom",
          container: "body",
          title: function () {
            return popover.title;
          },
          content: function () {
            return popover.content;
          },
          html: true,
          sanitize: false,
          customClass: "avrodoc-named-type",
        });

        el.addEventListener("mouseenter", function () {
          clearTimeout(hideTimer);
          clearTimeout(showTimer);
          if (activePopover && activePopover !== bsPopover) {
            activePopover.hide();
          }
          showTimer = setTimeout(function () {
            activePopover = bsPopover;
            activeTrigger = el;
            bsPopover.show();
          }, 120);
        });

        el.addEventListener("mouseleave", scheduleHide);

        el.addEventListener("shown.bs.popover", function () {
          var tipId = el.getAttribute("aria-describedby");
          var tip = tipId ? document.getElementById(tipId) : null;
          if (tip && !tip._avrodocHooked) {
            tip._avrodocHooked = true;
            tip.addEventListener("mouseleave", scheduleHide);
          }
          activeTip = tip || null;
        });
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
    var sections = document.querySelectorAll(
      "#content-pane > section[data-route]",
    );
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getAttribute("data-route") === hash) return sections[i];
    }
    return null;
  }

  function handleRoute() {
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
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    updateSidebarSelection(hash);
    setupPopovers();
  }

  window.addEventListener("hashchange", handleRoute);

  document.addEventListener("DOMContentLoaded", function () {
    loadPopoverData();
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
