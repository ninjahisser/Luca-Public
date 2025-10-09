// Assuming micInterface is already initialized and available globally

// Get the slider and label elements
const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityValue = document.getElementById('sensitivity-value');

// Set the initial sensitivity value
sensitivityValue.textContent = micInterface.sensitivity;

// Add an event listener to update sensitivity in real time
sensitivitySlider.addEventListener('input', function () {
    const newSensitivity = parseFloat(sensitivitySlider.value * 5);
    micInterface.setSensitivity(newSensitivity); // Update micInterface sensitivity
    sensitivityValue.textContent = newSensitivity; // Update displayed value
});
