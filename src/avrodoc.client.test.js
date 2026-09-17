import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const clientScript = readFileSync("./public/js/avrodoc.js", "utf8");

function loadClient(markup, hash = "#/") {
  const { document, window: domWindow } = parseHTML(markup);
  const location = { hash };
  const history = { scrollRestoration: "auto" };
  const windowEvents = document.createElement("div");
  const window = {
    Event: domWindow.Event,
    history,
    location,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
  };
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

function dispatch(window, target, type) {
  const event = new window.Event(type, { bubbles: true });
  Object.defineProperty(event, "relatedTarget", { value: null });
  target.dispatchEvent(event);
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
  dispatch(window, document.getElementById("type-link"), "mouseover");
  await new Promise((resolve) => setTimeout(resolve, 130));

  assert.equal(createdPopovers(), 1);
});

test("restores each route scroll position through back and forward navigation", () => {
  const markup = `
    <nav id="list-pane"></nav>
    <div id="content-pane">
      <section data-route="#/schema/A" hidden><a id="to-b" href="#/schema/B">B</a></section>
      <section data-route="#/schema/B" hidden><a id="to-a" href="#/schema/A">A</a></section>
    </div>`;
  const { document, window } = loadClient(markup, "#/schema/A");
  const navigate = (hash, type) => {
    window.location.hash = hash;
    dispatch(window, window, type);
    dispatch(window, window, "hashchange");
  };

  document.documentElement.scrollTop = 1000;
  dispatch(window, window, "scroll");
  dispatch(window, document.getElementById("to-b"), "click");
  navigate("#/schema/B", "popstate");
  assert.equal(document.documentElement.scrollTop, 0);

  document.documentElement.scrollTop = 1500;
  dispatch(window, window, "scroll");
  navigate("#/schema/A", "popstate");
  assert.equal(document.documentElement.scrollTop, 1000);
  navigate("#/schema/B", "popstate");
  assert.equal(document.documentElement.scrollTop, 1500);

  dispatch(window, document.getElementById("to-a"), "click");
  navigate("#/schema/A", "popstate");
  assert.equal(document.documentElement.scrollTop, 0);
});
