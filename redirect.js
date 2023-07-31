// Function to detect the device type
function detectDevice() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Checks for phones
  if (/iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile|Windows Phone|webOS/i.test(userAgent)) {
    return 'phone';
  } else if (/Tablet|iPad/i.test(userAgent)) {
    // Checks for tablets
    return 'tablet';
  } else {
    // Otherwise, it's likely a computer
    return 'computer';
  }
}

// Get the device type
const deviceType = detectDevice();

// Depending on the device type, load the appropriate HTML file
if (deviceType === 'phone') {
  window.location.href = "PhoneInterface/index.html"; // Path to the phone interface
} else {
  window.location.href = "ComputerTabletsInterface/index.html"; // Path to the computer/tablets interface
}
