
const pos = { x : 0, y : 0 };

const saveCursorPosition = function(x, y) {
    pos.x = (x / window.innerWidth) - 0.5;
    pos.y = (y / window.innerHeight)- 0.5;
    document.documentElement.style.setProperty('--cursorX', pos.x);
    document.documentElement.style.setProperty('--cursorY', pos.y);
}

document.addEventListener('mousemove', e => { saveCursorPosition(e.clientX, e.clientY); })
