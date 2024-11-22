const elements = [
    {
        pos: [20, 35],
        scale: 70,
        image_url: "res/Cat/Body.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            loudness = micInterface.getVolumePercent() * 0.02;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                console.log("Size:", this.size);
                this.html_element.style.transform = `scaleX(${this.size + 100}%) scaleY(${this.size * 2 + 100}%)`;
            }
        },
    },
    {
        pos: [10, 63],
        scale: 90,
        image_url: "res/Cat/Tail.png",

        html_element: null,

        rotation: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.02;
            if(loudness){
                this.rotation = lerp(this.rotation, loudness, .1);
                this.html_element.style.transform = `rotateZ(${this.rotation - 180}deg) translateX(50%)`;
            }
        }
    },
    {
        pos: [40, 32],
        scale: 15,
        image_url: "res/Cat/ear_left.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size}%)`;

            }
        }    
    },
    {
        pos: [58, 32],
        scale: 15,
        image_url: "res/Cat/ear_right.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size}%)`;

            }
        }    
    },
    {
        pos: [52, 40],
        scale: 8,
        image_url: "res/Cat/pupil.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size}%) scale(${100 - this.size * 0.3}%)`;
            }
        }    
    },
    {
        pos: [65, 40],
        scale: 8,
        image_url: "res/Cat/pupil.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size}%) scale(${100 - this.size * 0.3}%)`;
            }
        }    
    },
    {
        pos: [55, 40],
        scale: 2,
        image_url: "res/Cat/eyePupil.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size + (CursorPos.y+.1)*150}%) translateX(${CursorPos.x*250}%)`;
            }
        }    
    },
    {
        pos: [67, 40],
        scale: 2,
        image_url: "res/Cat/eyePupil.png",

        html_element: null,

        size: 0,
        updateTransform(micInterface){
            let loudness = micInterface.getVolumePercent() * 0.1;
            if(loudness){
                this.size = lerp(this.size, loudness, .1);
                this.html_element.style.transform = `translateY(${-1 * this.size + (CursorPos.y+.1)*150}%) translateX(${CursorPos.x*250}%)`;
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