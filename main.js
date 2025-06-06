const map = L.map('map').setView([0, 0], 2);

// Add Mapbox tile layer
const mapboxAccessToken = 'pk.eyJ1Ijoid2FiaW55YWkiLCJhIjoiY205c3YzNmh5MDJwMTJsc2Q1cHcyMjg1cyJ9.vhCgzcu2_zZOTEhBCvIfdw';
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: mapboxAccessToken
}).addTo(map);

// Function to fetch wind data with retry  
async function fetchWindData(attempt = 1, maxAttempts = 3) {
    const url = 'http://127.0.0.1:5000/api/wind';
    console.log(`Attempt ${attempt}: Fetching wind data from ${url}`);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        // Validate API response format
        if (!Array.isArray(data) || data.length !== 2 || !data[0].header || !data[1].header || !Array.isArray(data[0].data) || !Array.isArray(data[1].data)) {
            console.error('Unexpected API format: Expected array with two components (u, v) containing header and data');
            alert('Error: Invalid API response format. Please check the server logs.');
            return null;
        }
        
        return data;
    } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt < maxAttempts) {
            console.log(`Retrying... (${attempt + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
            return fetchWindData(attempt + 1, maxAttempts);
        } else {
            console.error('Max retries reached. Failed to fetch wind data:', error);
            alert('Error: Failed to fetch wind data after multiple attempts. Please check the server connection and ensure it’s running on http://192.168.18.6:5000.');
            return null;
        }
    }
}

// Fetch and display wind data
async function loadWindData() {
    const data = await fetchWindData();
    if (!data) return;

    const [uComponent, vComponent] = data;
    const { header: uHeader, data: uData } = uComponent;
    const { header: vHeader, data: vData } = vComponent;

    // Log headers and data for debugging
    console.log('U Component Header:', uHeader);
    console.log('V Component Header:', vHeader);
    console.log('U Data Length:', uData.length);
    console.log('V Data Length:', vData.length);

    // Validate grid dimensions and data length
    const { nx, ny } = uHeader;
    if (uData.length !== nx * ny || vData.length !== nx * ny) {
        console.error('Data length mismatch:', {
            uDataLength: uData.length,
            vDataLength: vData.length,
            expected: nx * ny
        });
        alert('Error: Wind data length mismatch. Please check the server configuration.');
        return;
    }

    // Check for meaningful wind data
    const hasWindData = uData.some(speed => speed !== 0) || vData.some(speed => speed !== 0);
    if (!hasWindData) {
        console.warn('No meaningful wind data found (all speeds are zero).');
        alert('Warning: No meaningful wind data available.');
        return;
    }

    // Construct wind data for leaflet-velocity
    const windData = [{
        header: {
            ...uHeader,
            parameterNumber: 2 // U-component
        },
        data: uData
    }, {
        header: {
            ...vHeader,
            parameterNumber: 3 // V-component
        },
        data: vData
    }];

    // Add velocity layer to the map
    const velocityLayer = L.velocityLayer({
        displayValues: true,
        displayOptions: {
            showCardinal: true,
            velocityType: 'Global Wind',
            position: 'bottomleft',
            emptyString: 'No velocity data',
            directionString: 'Direction',
            speedString: 'Speed',
            speedUnit: 'm/s',
            angleConvention: 'bearingCW'
        },
        data: windData,
        particleAge: 64,
        particleMultiplier: 0.003,
        particleLineWidth: 1,
        frameRate: 15,
        minVelocity: 0,
        maxVelocity: 10,
        velocityScale: 0.005,
        opacity: 0.97,
        colorScale: [
            "#0000ff", // 0 m/s - blue
            "#00ffff", // 2.5 m/s - cyan
            "#00ff00", // 5 m/s - green
            "#ffff00", // 7.5 m/s - yellow
            "#ff0000"  // 10 m/s - red
        ],
        onAdd: () => console.log('Velocity layer added to map'),
        onRemove: () => console.log('Velocity layer removed from map'),
        paneName: 'overlayPane'
    });

    velocityLayer.addTo(map);
    console.log('Wind visualization loaded successfully');
}

// Initialize the wind data loading
loadWindData();
