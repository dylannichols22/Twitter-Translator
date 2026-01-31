export function clearElement(element: Element): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function setText(element: Element, text: string): void {
  element.textContent = text;
}
