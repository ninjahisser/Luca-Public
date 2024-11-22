const elements = [
    {
        pos: [20, 35],
        scale: 70,
        image_url: "res/Cat/Body.png",

        html_element: null,
        updateTransform(micInterface){
            loudness = micInterface.getVolumePercent() * .01;
            this.html_element.style.transform = `scaleX(${loudness + 100}%) scaleY(${loudness*2 + 100}%)`;
        },
    },
    {
        pos: [10, 65],
        scale: 70,
        image_url: "res/Cat/Tail.png",

        html_element: null,

        rotation: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.02;
            if(loudness){
                this.rotation = lerp(this.rotation, loudness, .1);
                console.log("Rotating", this.rotation);
                this.html_element.style.transform = `rotateZ(${this.rotation + 180}deg) translateX(50%)`;
            }
        }
    }
]

function updateAllElements(){
    elements.forEach(function(element) {
        if(micInterface.initialized){
            element.updateTransform(micInterface);
        }
    });

    requestAnimationFrame(updateAllElements)
}

function load_scene(){
    elements.forEach(function(element) {
        var newElement = document.createElement("img");
        newElement.src = element.image_url;
        newElement.classList.add("element");

        var parent = document.getElementsByTagName("figure")[0];
        parent.appendChild(newElement);
        element.html_element = newElement;

        newElement.style.left = element.pos[0] + "%";
        newElement.style.top = element.pos[1] + "%";
        newElement.style.width = element.scale + "%";
    });
}

load_scene();

requestAnimationFrame(updateAllElements)