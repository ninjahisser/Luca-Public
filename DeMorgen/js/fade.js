function fade(element) {
    var op = 1;  // initial opacity
    var timer = setInterval(function () {
        if (op <= 0.1){
            clearInterval(timer);
            element.style.display = 'none';
        }
        element.style.opacity = op;
        element.style.filter = 'alpha(opacity=' + op * 100 + ")";
        op -= op * 0.5;
    }, 50);
}

function fade_in(element) {
    var op = 0;  // initial opacity
    element.style.display = ''; // Ensure the element is visible before fading in
    var timer = setInterval(function () {
        if (op >= 1) {
            clearInterval(timer); // Stop the interval when fully visible
            element.style.opacity = 1; // Ensure opacity is exactly 1
        } else {
            element.style.opacity = op;
            element.style.filter = 'alpha(opacity=' + op * 100 + ")";
            op += 0.1; // Increment opacity gradually
        }
    }, 50);
}
