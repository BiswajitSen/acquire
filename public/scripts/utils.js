const elements = [
  "div",
  [
    ["h1", "hello"],
    ["div",
      [["h1", "hello"]],
      { class: "hello", id: "check" }
    ]
  ],
  { class: "hello", id: "check" }
];

const generateComponent = ([tagName, children, attributes = {}]) => {
  const element = document.createElement(tagName);

  Object.entries(attributes)
    .forEach(attribute => element.setAttribute(...attribute));

  if (Array.isArray(children)) {
    element.append(...children.map(child => generateComponent(child)));
    return element;
  }

  if (typeof children === "object") element.innerHTML = children.innerHTML;
  else element.innerText = children;

  return element;
};