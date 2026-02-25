/**
 * DOM Utility functions for creating structured UI elements without innerHTML
 */

/**
 * Creates an HTMLElement with attributes and children.
 * @param tagName The tag name of the element
 * @param attributes Key-value pairs for attributes. Use 'className' for class, 'textContent' for text.
 * @param children Array of strings or HTMLElements to append as children.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attributes: Record<string, string | number | boolean | object> = {},
    children: (string | Node)[] = []
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = String(value);
        } else if (key === 'textContent') {
            element.textContent = String(value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (typeof value === 'boolean') {
            if (value) element.setAttribute(key, '');
            // if false, do nothing (don't set attribute)
        } else {
            element.setAttribute(key, String(value));
        }
    });

    children.forEach((child) => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });

    return element;
}
