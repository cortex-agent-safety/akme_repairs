import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const handlers = new Map();
const revealElements = [createRevealElement(), createRevealElement()];

function createRevealElement() {
  const classes = new Set();
  return {
    classList: {
      add(name) {
        classes.add(name);
      },
      contains(name) {
        return classes.has(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  };
}

function eventTarget(name, value = "") {
  return {
    name,
    value,
    attributes: new Map(),
    classList: createRevealElement().classList,
    addEventListener(type, handler) {
      handlers.set(`${name}:${type}`, handler);
    },
    getAttribute(attribute) {
      return this.attributes.get(attribute) ?? null;
    },
    setAttribute(attribute, valueToSet) {
      this.attributes.set(attribute, valueToSet);
    },
  };
}

const menuButton = eventTarget("menu");
menuButton.setAttribute("aria-expanded", "false");
const navigation = eventTarget("navigation");
navigation.querySelectorAll = () => [eventTarget("navigation-link")];
const estimateForm = eventTarget("form");
estimateForm.values = new Map([
  ["name", "Jane Doe"],
  ["email", "jane@example.com"],
  ["job", "Repair the front door"],
]);
const year = { textContent: "" };

let observerCallback;
const unobserved = [];
class IntersectionObserver {
  constructor(callback) {
    observerCallback = callback;
  }

  observe() {}

  unobserve(element) {
    unobserved.push(element);
  }
}

class FormData {
  constructor(form) {
    this.values = form.values;
  }

  get(name) {
    return this.values.get(name);
  }
}

const window = { location: { href: "" } };
const document = {
  body: createRevealElement(),
  querySelector(selector) {
    return {
      ".menu-toggle": menuButton,
      "#site-nav": navigation,
      "#estimate-form": estimateForm,
      "#year": year,
    }[selector];
  },
  querySelectorAll(selector) {
    return selector === ".reveal" ? revealElements : [];
  },
};

vm.runInNewContext(source, { document, FormData, IntersectionObserver, window });

assert.equal(typeof observerCallback, "function", "IntersectionObserver callback was not registered");
observerCallback(revealElements.map((target) => ({ isIntersecting: true, target })));
for (const element of revealElements) {
  assert.equal(element.classList.contains("visible"), true, "Visible content was not revealed");
}
assert.equal(unobserved.length, revealElements.length, "Revealed content was not unobserved");

let prevented = false;
handlers.get("form:submit")({
  currentTarget: estimateForm,
  preventDefault() {
    prevented = true;
  },
});

assert.equal(prevented, true, "Estimate form submission was not intercepted");
assert.match(
  window.location.href,
  /^mailto:contact@akmerepairs\.com\?subject=Estimate%20request%20from%20Jane%20Doe&body=/,
  "Estimate form did not target the monitored Akme mailbox",
);
assert.match(window.location.href, /jane%40example\.com/, "Estimate email omitted the visitor address");
assert.match(window.location.href, /Repair%20the%20front%20door/, "Estimate email omitted the repair details");

console.log("Website behavior tests passed.");
