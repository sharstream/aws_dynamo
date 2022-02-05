module.exports = {
    getSummary
}

function getSummary(messages){}

function _detect_cluster(messages, time_threshold_ms, cluster_threshold_diameter) {
    let window = [];
    createMatrix(messages);
    
}

function createMatrix(messages) {
    let matrix = [];
    for (let i = 0; i < messages.length - 1; i++) {
        matrix[i] = [];
        for (let j = 0; j < array.length; j++) {
            let distance_mi;
            let message = messages[i];
            distance_mi = calculate_harvesine_distance(
                message.position.lat,
                message.position.lng,
                messages[i + 1].position.lat,
                messages[i + 1].position.lng
            )

            matrix[i][j] = distance_mi;
        }
    }
    return matrix;
}

function calculate_harvesine_distance(lat, lng, cluster_lat, cluster_lng) {
    const R = 3959 // in miles
    const x1 = cluster_lat - lat;
    const x2 = cluster_lng - lng;
    const dLat = to_radians(x1);
    const dLng = to_radians(x2);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(to_radians(lat)) * Math.cos(to_radians(cluster_lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function to_radians(x) { return (x * Math.PI) / 180; }