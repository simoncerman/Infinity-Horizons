export function getUserPosition(startingPosition) {
    return new Promise((resolve, reject) => {
        // Try to get the user's position from navigator.geolocation
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                saveUserPosition(latitude, longitude);
                resolve({ latitude : latitude, longitude : longitude });
            },
            (error) => {
                const savedLatitude = localStorage.getItem('latitude');
                const savedLongitude = localStorage.getItem('longitude');

                if (savedLatitude && savedLongitude && !isNaN(savedLatitude) && !isNaN(savedLongitude)) {
                    resolve({
                        latitude: parseFloat(savedLatitude),
                        longitude: parseFloat(savedLongitude)
                    });
                } else {
                    resolve(startingPosition);
                }
            }
        );
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
