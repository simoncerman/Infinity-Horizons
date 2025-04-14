export function getUserPosition() {
    return new Promise((resolve, reject) => {
        const savedLatitude = localStorage.getItem('latitude');
        const savedLongitude = localStorage.getItem('longitude');

        if (savedLatitude && savedLongitude) {
            resolve({
                latitude: parseFloat(savedLatitude),
                longitude: parseFloat(savedLongitude)
            });
        } else if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser.'));
        } else {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    saveUserPosition(latitude, longitude);
                    resolve({ latitude, longitude });
                },
                (error) => reject(handleGeolocationError(error))
            );
        }
    });
}

export function saveUserPosition(latitude, longitude) {
    localStorage.setItem('latitude', latitude);
    localStorage.setItem('longitude', longitude);
}

function handleGeolocationError(error) {
    switch (error.code) {
        case 1:
            return new Error('Permission denied. Please allow location access.');
        case 2:
            return new Error('Position unavailable. Please check your device settings.');
        case 3:
            return new Error('Timeout while retrieving location. Please try again.');
        default:
            return new Error('An unknown error occurred while retrieving location.');
    }
}
