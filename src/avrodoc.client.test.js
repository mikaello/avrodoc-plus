import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const clientScript = readFileSync("./public/js/avrodoc.js", "utf8");

function loadClient(markup, hash = "#/") {
  const { document, window } = parseHTML(markup);
  const location = { hash };
  let createdPopovers = 0;
  let routeIndexCount = 0;
  const popovers = new WeakMap();
  const querySelectorAll = document.querySelectorAll.bind(document);

  document.querySelectorAll = (selector) => {
    if (selector === "#content-pane > section[data-route]") routeIndexCount++;
    return querySelectorAll(selector);
  };

  class Popover {
    constructor(element) {
      this.element = element;
      createdPopovers++;
      popovers.set(element, this);
    }

    static getInstance(element) {
      return popovers.get(element) || null;
    }

    show() {
      this.element.dispatchEvent(new window.Event("shown.bs.popover"));
    }

    hide() {}
  }

  Object.defineProperty(window, "location", { value: location });
  window.scrollTo = (_x, y) => {
    document.documentElement.scrollTop = y;
  };

  vm.runInNewContext(clientScript, {
    bootstrap: { Popover },
    clearTimeout,
    console,
    document,
    Map,
    setTimeout,
    URL,
    window,
  });

  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  return {
    document,
    window,
    createdPopovers: () => createdPopovers,
    routeIndexCount: () => routeIndexCount,
  };
}

test("indexes routes once and creates popovers only on first interaction", async () => {
  const markup = `
    <nav id="list-pane"></nav>
    <div id="content-pane">
      <section data-route="#/" hidden><a id="type-link" href="#/schema/Example">Example</a></section>
      <section data-route="#/schema/Example" hidden>
        <h1 class="type-name">Example</h1>
        <div class="type-details">Details</div>
      </section>
    </div>`;
  const { document, window, createdPopovers, routeIndexCount } =
    loadClient(markup);

  assert.equal(createdPopovers(), 0);
  assert.equal(routeIndexCount(), 1);
  const event = new window.Event("mouseover", { bubbles: true });
  Object.defineProperty(event, "relatedTarget", { value: null });
  document.getElementById("type-link").dispatchEvent(event);
  await new Promise((resolve) => setTimeout(resolve, 130));

  assert.equal(createdPopovers(), 1);
});
