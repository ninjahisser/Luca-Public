
const CursorPos = { x : 0, y : 0 };

const saveCursorPosition = function(x, y) {
    CursorPos.x = (x / window.innerWidth) - 0.5;
    CursorPos.y = (y / window.innerHeight)- 0.5;
    document.documentElement.style.setProperty('--cursorX', x-5 + "px");
    document.documentElement.style.setProperty('--cursorY', y-5 + "px");
}

document.addEventListener('mousemove', e => { saveCursorPosition(e.clientX, e.clientY); })
